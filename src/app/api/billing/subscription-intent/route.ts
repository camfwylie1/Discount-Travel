import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { ensureCustomer, resolvePriceId, stripe, stripeConfigured } from '@/lib/billing/stripe'
import { membership } from '@/config/pricing'
import { track } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'

/**
 * APPLE PAY / GOOGLE PAY — the annual membership, paid in-page
 *
 * Creates the subscription up front in an INCOMPLETE state and hands back the
 * client secret of its first invoice. The browser's Express Checkout Element
 * (the Apple Pay sheet) confirms that payment directly with Stripe, so no card
 * detail ever reaches Voyaj.
 *
 * `payment_behavior: 'default_incomplete'` is the important part: the
 * subscription exists but grants nothing until its first payment succeeds.
 *
 * ACCESS IS STILL GRANTED BY THE WEBHOOK, NOT BY THIS ROUTE, and not by the
 * browser reporting success. A confirmation that happens in the page is a
 * claim made by a client we do not control. The signed webhook is the only
 * thing that activates a membership — the same rule as the hosted checkout.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'checkout', auth.user.id)
  if (limited) return limited

  if (!stripeConfigured()) {
    return fail(
      'Payments are not configured on this installation yet. See DEPLOYMENT.md § Stripe.',
      503,
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: { subscription: true, profile: { select: { firstName: true } } },
  })
  if (!user) return fail('Account not found.', 404)

  if (user.subscription?.status === 'ACTIVE' || user.subscription?.status === 'TRIALING') {
    return fail('You already have an active membership.', 409)
  }

  const sdk = stripe()
  const customerId = await ensureCustomer({
    userId: user.id,
    email: user.email,
    firstName: user.profile?.firstName,
    existingCustomerId: user.subscription?.stripeCustomerId,
  })
  const priceId = await resolvePriceId()

  const subscription = await sdk.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
      // Left to the account's payment method settings so a wallet enabled in
      // the Stripe dashboard shows up here without a code change.
      payment_method_types: undefined,
    },
    collection_method: 'charge_automatically',
    metadata: { userId: user.id },
    expand: ['latest_invoice.confirmation_secret'],
  })

  // The shape of this expansion has moved between API versions, so read it
  // defensively and fail loudly rather than handing the browser `undefined`
  // and letting the Apple Pay sheet fail with nothing to report.
  const invoice = subscription.latest_invoice
  const clientSecret =
    invoice && typeof invoice !== 'string'
      ? ((invoice as { confirmation_secret?: { client_secret?: string } }).confirmation_secret
          ?.client_secret ?? null)
      : null

  if (!clientSecret) {
    logger.error('stripe.no_client_secret', {
      subscriptionId: subscription.id,
      invoiceType: typeof invoice,
    })
    return fail('We could not start that payment. Please try the card option.', 502)
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: 'INCOMPLETE',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      priceCents: membership.priceCents,
      currency: membership.currency,
      interval: membership.interval,
    },
    update: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
    },
  })

  await track('checkout_started', {
    userId: user.id,
    properties: { method: 'express_wallet' },
  })

  return ok({
    clientSecret,
    subscriptionId: subscription.id,
    amountCents: membership.priceCents,
    currency: membership.currency,
  })
})
