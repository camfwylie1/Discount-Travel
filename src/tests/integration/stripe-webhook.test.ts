import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { hashPassword } from '@/lib/auth/password'
import { mapStatus, toDate } from '@/lib/billing/stripe'

/**
 * STRIPE WEBHOOK TESTS
 *
 * WHAT THESE PROVE: that signature verification is real, that a forged or
 * replayed request is rejected, and that a genuine event correctly grants,
 * changes and revokes membership.
 *
 * Signature verification needs only the webhook signing secret — no network
 * call — so this is a genuine test of the security-critical path, using a
 * throwaway secret.
 *
 * WHAT THESE DO NOT PROVE: that a real checkout session completes against
 * Stripe's live test servers. That needs API keys only the founder can
 * create. README § "Turning on payments" explains how to verify it.
 */

const WEBHOOK_SECRET = 'whsec_test_secret_for_signature_verification_only'
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

let userId: string
const CUSTOMER_ID = 'cus_test_voyaj_123'
const SUBSCRIPTION_ID = 'sub_test_voyaj_123'

/** Builds the `Stripe-Signature` header exactly as Stripe does. */
function signPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  return `t=${timestamp},v1=${signature}`
}

/** Calls the webhook route exactly as Stripe would. */
async function postWebhook(event: object, options: { secret?: string; timestamp?: number } = {}) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_signature_verification'
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET

  const { POST } = await import('@/app/api/webhooks/stripe/route')
  const payload = JSON.stringify(event)
  const signature = signPayload(payload, options.secret ?? WEBHOOK_SECRET, options.timestamp)

  const request = new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
    body: payload,
  })
  const response = await POST(request)
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

function subscriptionEvent(type: string, overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    type,
    data: {
      object: {
        id: SUBSCRIPTION_ID,
        object: 'subscription',
        customer: CUSTOMER_ID,
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        trial_end: null,
        metadata: { userId },
        items: {
          data: [
            {
              id: 'si_test',
              current_period_start: now,
              current_period_end: now + 365 * 86_400,
              price: {
                id: 'price_test_annual',
                unit_amount: 9900,
                currency: 'cad',
                recurring: { interval: 'year' },
              },
            },
          ],
        },
        ...overrides,
      },
    },
  }
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { emailNormalized: 'stripe@webhooktest.local' } })
  const user = await prisma.user.create({
    data: {
      email: 'stripe@webhooktest.local',
      emailNormalized: 'stripe@webhooktest.local',
      passwordHash: await hashPassword('CorrectHorseBattery9!'),
      status: 'ACTIVE',
      ageConfirmed18: true,
      onboardingComplete: true,
      profile: { create: { firstName: 'Stripe' } },
      privacy: { create: {} },
    },
  })
  userId = user.id
})

beforeEach(async () => {
  // Start each test from a known subscription state.
  await prisma.subscription.deleteMany({ where: { userId } })
  await prisma.subscription.create({
    data: { userId, status: 'INCOMPLETE', stripeCustomerId: CUSTOMER_ID },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { emailNormalized: 'stripe@webhooktest.local' } })
  await prisma.$disconnect()
})

describe('signature verification — the security boundary', () => {
  it('rejects a request with no signature at all', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_signature_verification'
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    const { POST } = await import('@/app/api/webhooks/stripe/route')
    const response = await POST(
      new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(subscriptionEvent('customer.subscription.updated')),
      }),
    )
    expect(response.status).toBe(400)
  })

  it('rejects a FORGED event signed with the wrong secret', async () => {
    // An attacker who knows our webhook URL but not the signing secret.
    const result = await postWebhook(subscriptionEvent('customer.subscription.updated'), {
      secret: 'whsec_the_attackers_guess',
    })
    expect(result.status).toBe(400)
    expect(result.body.error).toMatch(/invalid signature/i)

    // Critically: nothing was written.
    const subscription = await prisma.subscription.findUnique({ where: { userId } })
    expect(subscription?.status).toBe('INCOMPLETE')
  })

  it('rejects a REPLAYED event with an old timestamp', async () => {
    const result = await postWebhook(subscriptionEvent('customer.subscription.updated'), {
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    })
    expect(result.status).toBe(400)
  })

  it('rejects a tampered payload', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_signature_verification'
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
    const { POST } = await import('@/app/api/webhooks/stripe/route')

    const original = JSON.stringify(subscriptionEvent('customer.subscription.updated'))
    const signature = signPayload(original, WEBHOOK_SECRET)
    // Same signature, different body.
    const tampered = original.replace('"status":"active"', '"status":"trialing"')

    const response = await POST(
      new Request('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': signature },
        body: tampered,
      }),
    )
    expect(response.status).toBe(400)
  })

  it('accepts a correctly signed event', async () => {
    const result = await postWebhook(subscriptionEvent('customer.subscription.updated'))
    expect(result.status).toBe(200)
    expect(result.body.received).toBe(true)
  })
})

describe('membership is granted by the webhook, not by the browser redirect', () => {
  it('activates a membership on customer.subscription.created', async () => {
    const result = await postWebhook(subscriptionEvent('customer.subscription.created'))
    expect(result.status).toBe(200)

    const subscription = await prisma.subscription.findUnique({ where: { userId } })
    expect(subscription?.status).toBe('ACTIVE')
    expect(subscription?.stripeSubscriptionId).toBe(SUBSCRIPTION_ID)
    expect(subscription?.priceCents).toBe(9900)
    expect(subscription?.currency).toBe('CAD')
    expect(subscription?.interval).toBe('year')
    expect(subscription?.currentPeriodEnd).toBeTruthy()
    expect(subscription!.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now())
  })

  it('records a cancellation scheduled for the end of the period', async () => {
    await postWebhook(subscriptionEvent('customer.subscription.created'))
    await postWebhook(
      subscriptionEvent('customer.subscription.updated', { cancel_at_period_end: true }),
    )
    const subscription = await prisma.subscription.findUnique({ where: { userId } })
    // Still active — they paid for the period.
    expect(subscription?.status).toBe('ACTIVE')
    expect(subscription?.cancelAtPeriodEnd).toBe(true)
  })

  it('revokes membership when the subscription is deleted', async () => {
    await postWebhook(subscriptionEvent('customer.subscription.created'))
    await postWebhook(subscriptionEvent('customer.subscription.deleted', { status: 'canceled' }))
    const subscription = await prisma.subscription.findUnique({ where: { userId } })
    expect(subscription?.status).toBe('CANCELED')
  })

  it('marks a subscription past due when a payment fails, and warns the member', async () => {
    await postWebhook(subscriptionEvent('customer.subscription.created'))
    await postWebhook({
      id: 'evt_invoice_failed',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_test_failed',
          object: 'invoice',
          customer: CUSTOMER_ID,
          amount_paid: 0,
          amount_due: 9900,
          currency: 'cad',
          hosted_invoice_url: 'https://invoice.stripe.com/test',
          lines: { data: [{ description: 'Voyaj membership' }] },
        },
      },
    })

    const subscription = await prisma.subscription.findUnique({ where: { userId } })
    expect(subscription?.status).toBe('PAST_DUE')
    expect(subscription?.lastPaymentFailedAt).toBeTruthy()

    const notification = await prisma.notification.findFirst({
      where: { userId, kind: 'SUBSCRIPTION' },
      orderBy: { createdAt: 'desc' },
    })
    expect(notification?.title).toMatch(/did not go through/i)
  })

  it('records a successful payment for the member’s history', async () => {
    await postWebhook({
      id: 'evt_invoice_paid',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_test_paid_unique',
          object: 'invoice',
          customer: CUSTOMER_ID,
          amount_paid: 9900,
          amount_due: 9900,
          currency: 'cad',
          hosted_invoice_url: 'https://invoice.stripe.com/receipt',
          lines: { data: [{ description: 'Voyaj membership' }] },
        },
      },
    })
    const payment = await prisma.payment.findFirst({
      where: { userId, stripeInvoiceId: 'in_test_paid_unique' },
    })
    expect(payment?.status).toBe('paid')
    expect(payment?.amountCents).toBe(9900)
    expect(payment?.receiptUrl).toBe('https://invoice.stripe.com/receipt')
  })

  it('is idempotent — Stripe retries must not create duplicates', async () => {
    const event = subscriptionEvent('customer.subscription.created')
    await postWebhook(event)
    await postWebhook(event)
    await postWebhook(event)
    const count = await prisma.subscription.count({ where: { userId } })
    expect(count).toBe(1)
  })

  it('acknowledges an event type we deliberately ignore', async () => {
    const result = await postWebhook({
      id: 'evt_ignored',
      type: 'customer.updated',
      data: { object: { id: CUSTOMER_ID } },
    })
    // 200 so Stripe stops retrying, but clearly marked as unhandled.
    expect(result.status).toBe(200)
    expect(result.body.handled).toBe(false)
  })
})

describe('status mapping', () => {
  it('maps every Stripe status onto ours', () => {
    expect(mapStatus('active')).toBe('ACTIVE')
    expect(mapStatus('trialing')).toBe('TRIALING')
    expect(mapStatus('past_due')).toBe('PAST_DUE')
    expect(mapStatus('canceled')).toBe('CANCELED')
    expect(mapStatus('unpaid')).toBe('UNPAID')
    expect(mapStatus('incomplete')).toBe('INCOMPLETE')
    expect(mapStatus('paused')).toBe('PAUSED')
  })

  it('converts Stripe timestamps safely', () => {
    expect(toDate(1_700_000_000)?.toISOString()).toBe('2023-11-14T22:13:20.000Z')
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
  })
})
