import type Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { stripe, stripeConfigured, mapStatus, toDate } from '@/lib/billing/stripe'
import { logger, captureException } from '@/lib/observability/logger'
import { track, audit } from '@/lib/analytics/events'

/**
 * STRIPE WEBHOOK
 *
 * The single source of truth for subscription state. The browser redirect
 * after checkout is a convenience; this is what actually grants membership,
 * because only the webhook is trustworthy.
 *
 * Every event is signature-verified. An unverified request is rejected before
 * any database work happens.
 */

export const dynamic = 'force-dynamic'

const HANDLED_EVENTS = new Set<string>([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
])

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return Response.json({ error: 'Payments are not configured.' }, { status: 503 })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    logger.error('stripe.webhook_secret_missing')
    return Response.json({ error: 'Webhook secret is not configured.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return Response.json({ error: 'Missing signature.' }, { status: 400 })

  // The RAW body is required — parsing it first would break verification.
  const payload = await request.text()

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret)
  } catch (error) {
    logger.warn('stripe.signature_invalid', { error: String(error) })
    return Response.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    // Acknowledge, so Stripe stops retrying something we deliberately ignore.
    return Response.json({ received: true, handled: false })
  }

  try {
    await handleEvent(event)
  } catch (error) {
    captureException(error, { eventType: event.type, eventId: event.id })
    // A 500 tells Stripe to retry, which is what we want for a transient fault.
    return Response.json({ error: 'Processing failed.' }, { status: 500 })
  }

  return Response.json({ received: true, handled: true })
}

async function handleEvent(event: Stripe.Event) {
  logger.info('stripe.webhook', { type: event.type, id: event.id })

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id ?? session.metadata?.userId
      if (!userId) {
        logger.error('stripe.no_user_reference', { sessionId: session.id })
        return
      }
      if (session.subscription) {
        const subscription = await stripe().subscriptions.retrieve(
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
        )
        await syncSubscription(userId, subscription)
      }
      await track('subscription_activated', { userId, properties: { sessionId: session.id } })
      await audit({
        actorId: userId,
        action: 'subscription.activated',
        entityType: 'Subscription',
        entityId: session.id,
      })
      return
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = await resolveUserId(subscription)
      if (!userId) return
      await syncSubscription(userId, subscription)
      if (event.type === 'customer.subscription.deleted') {
        await track('subscription_cancelled', { userId })
      }
      return
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      await recordPayment(invoice, 'paid')
      return
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await recordPayment(invoice, 'failed')

      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
      if (!customerId) return
      const record = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } })
      if (!record) return

      await prisma.subscription.update({
        where: { id: record.id },
        data: {
          status: 'PAST_DUE',
          lastPaymentFailedAt: new Date(),
          lastPaymentFailureReason: 'The payment was declined.',
        },
      })
      await prisma.notification.create({
        data: {
          userId: record.userId,
          kind: 'SUBSCRIPTION',
          title: 'Your membership payment did not go through',
          body: 'Update your payment method to keep your membership active.',
          linkUrl: '/settings/membership',
        },
      })
      logger.warn('stripe.payment_failed', { userId: record.userId })
      return
    }
  }
}

async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.userId
  if (fromMetadata) return fromMetadata

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  if (!customerId) return null

  const record = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })
  if (record) return record.userId

  // Last resort: the customer object itself carries the id we set at creation.
  const customer = await stripe().customers.retrieve(customerId)
  if (!customer.deleted && customer.metadata?.userId) return customer.metadata.userId

  logger.error('stripe.cannot_resolve_user', { customerId })
  return null
}

async function syncSubscription(userId: string, subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  // Stripe moved the period fields onto the subscription item.
  const periodStart = toDate(item?.current_period_start)
  const periodEnd = toDate(item?.current_period_end)

  const data = {
    status: mapStatus(subscription.status) as 'ACTIVE',
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.price?.id ?? null,
    priceCents: item?.price?.unit_amount ?? null,
    currency: (item?.price?.currency ?? 'cad').toUpperCase(),
    interval: item?.price?.recurring?.interval ?? 'year',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
    trialEndsAt: toDate(subscription.trial_end),
  }

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })

  logger.info('stripe.subscription_synced', {
    userId,
    status: data.status,
    periodEnd: periodEnd?.toISOString(),
  })
}

async function recordPayment(invoice: Stripe.Invoice, outcome: 'paid' | 'failed') {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  const record = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  })
  if (!record) return

  await prisma.payment.upsert({
    where: { stripeInvoiceId: invoice.id ?? `invoice_${Date.now()}` },
    create: {
      userId: record.userId,
      stripeInvoiceId: invoice.id ?? null,
      amountCents: invoice.amount_paid || invoice.amount_due || 0,
      currency: (invoice.currency ?? 'cad').toUpperCase(),
      status: outcome,
      description: invoice.lines.data[0]?.description ?? 'Voyaj membership',
      receiptUrl: invoice.hosted_invoice_url ?? null,
      paidAt: outcome === 'paid' ? new Date() : null,
      failureReason: outcome === 'failed' ? 'The payment was declined.' : null,
    },
    update: {
      status: outcome,
      paidAt: outcome === 'paid' ? new Date() : null,
      receiptUrl: invoice.hosted_invoice_url ?? null,
    },
  })
}
