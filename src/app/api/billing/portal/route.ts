import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { stripe, stripeConfigured } from '@/lib/billing/stripe'

/**
 * The Stripe Billing Portal handles cancellation, card updates and invoices.
 * Using Stripe's own portal means card details never touch our servers.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'checkout', auth.user.id)
  if (limited) return limited

  if (!stripeConfigured()) return fail('Payments are not configured on this installation.', 503)

  const subscription = await prisma.subscription.findUnique({
    where: { userId: auth.user.id },
    select: { stripeCustomerId: true },
  })
  if (!subscription?.stripeCustomerId) {
    return fail('You do not have a billing account yet.', 404)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/settings/membership`,
  })

  return ok({ url: session.url })
})
