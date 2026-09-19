import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { ensureCustomer, resolvePriceId, stripe, stripeConfigured } from '@/lib/billing/stripe'
import { membership } from '@/config/pricing'
import { track } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'
import { z } from 'zod'

const schema = z.object({ promoCode: z.string().trim().max(40).optional() })

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'checkout', auth.user.id)
  if (limited) return limited

  if (!stripeConfigured()) {
    return fail(
      'Payments are not configured on this installation yet. See README § Turning on payments.',
      503,
    )
  }

  const body = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(body ?? {})
  const promoCode = parsed.success ? parsed.data.promoCode : undefined

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: { subscription: true, profile: { select: { firstName: true } } },
  })
  if (!user) return fail('Account not found.', 404)

  if (user.subscription?.status === 'ACTIVE' || user.subscription?.status === 'TRIALING') {
    return fail('You already have an active membership.', 409)
  }

  const sdk = stripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const customerId = await ensureCustomer({
    userId: user.id,
    email: user.email,
    firstName: user.profile?.firstName,
    existingCustomerId: user.subscription?.stripeCustomerId,
  })

  const priceId = await resolvePriceId()

  // Resolve a promotion code by its human-facing code, not its id.
  let discounts: { promotion_code: string }[] | undefined
  if (promoCode) {
    const found = await sdk.promotionCodes.list({ code: promoCode, active: true, limit: 1 })
    if (found.data[0]) discounts = [{ promotion_code: found.data[0].id }]
    else logger.info('stripe.promo_not_found', { promoCode })
  }

  const session = await sdk.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Apple Pay and Google Pay appear automatically on supported devices once
    // the domain is registered in Stripe. No extra code is needed.
    payment_method_types: ['card'],
    allow_promotion_codes: discounts ? undefined : true,
    discounts,
    success_url: `${appUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/upgrade?cancelled=1`,
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id } },
    metadata: { userId: user.id },
    billing_address_collection: 'auto',
    automatic_tax: { enabled: false },
  })

  // Record the customer id now, so a webhook that arrives before the redirect
  // completes can still find this account.
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: 'INCOMPLETE',
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      priceCents: membership.priceCents,
      currency: membership.currency,
      interval: membership.interval,
    },
    update: { stripeCustomerId: customerId, stripePriceId: priceId },
  })

  await track('checkout_started', { userId: user.id, properties: { promoCode: !!promoCode } })

  return ok({ url: session.url, sessionId: session.id })
})
