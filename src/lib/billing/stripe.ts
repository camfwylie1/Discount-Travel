import 'server-only'
import Stripe from 'stripe'
import { membership } from '@/config/pricing'
import { logger } from '@/lib/observability/logger'

/**
 * STRIPE
 *
 * Real Stripe, in test mode. No fake checkout, and no database flag that
 * pretends a payment happened.
 *
 * The app runs perfectly well without Stripe keys — the upgrade page then
 * shows a clear "payments not configured" state rather than a broken button.
 * See README § "Turning on payments".
 */

let client: Stripe | null = null

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add your Stripe test key to .env — see README § Turning on payments.',
    )
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Pinning the version means a Stripe API change cannot silently alter
      // our behaviour. Bump it deliberately after reading their changelog.
      apiVersion: '2026-08-26.dahlia',
      typescript: true,
      appInfo: { name: 'Voyaj', version: '0.1.0' },
      maxNetworkRetries: 2,
      timeout: 20_000,
    })
  }
  return client
}

/**
 * Finds the configured price, or creates a matching test-mode product and
 * price on first use — so a founder can run a real checkout without first
 * learning the Stripe dashboard.
 */
export async function resolvePriceId(): Promise<string> {
  if (membership.stripePriceId) return membership.stripePriceId

  const sdk = stripe()
  const lookupKey = 'voyaj_membership_annual'

  const existing = await sdk.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })
  if (existing.data[0]) return existing.data[0].id

  logger.info('stripe.creating_price', { lookupKey })
  const product = await sdk.products.create({
    name: membership.productName,
    description: membership.productDescription,
  })
  const price = await sdk.prices.create({
    product: product.id,
    unit_amount: membership.priceCents,
    currency: membership.currency.toLowerCase(),
    recurring: { interval: membership.interval },
    lookup_key: lookupKey,
  })
  logger.info('stripe.price_created', { priceId: price.id })
  return price.id
}

/** Reuses an existing Stripe customer, or creates one. */
export async function ensureCustomer(params: {
  userId: string
  email: string
  firstName?: string | null
  existingCustomerId?: string | null
}): Promise<string> {
  const sdk = stripe()

  if (params.existingCustomerId) {
    try {
      const customer = await sdk.customers.retrieve(params.existingCustomerId)
      if (!customer.deleted) return customer.id
    } catch (error) {
      logger.warn('stripe.customer_missing', { error: String(error) })
    }
  }

  const customer = await sdk.customers.create({
    email: params.email,
    name: params.firstName ?? undefined,
    // The user id is how the webhook finds its way back to our record.
    metadata: { userId: params.userId },
  })
  return customer.id
}

/** Maps Stripe's subscription status onto ours. */
export function mapStatus(status: Stripe.Subscription.Status): string {
  const map: Record<Stripe.Subscription.Status, string> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    unpaid: 'UNPAID',
    paused: 'PAUSED',
  }
  return map[status] ?? 'NONE'
}

export function toDate(seconds: number | null | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null
}

/**
 * Apple Pay and Google Pay.
 *
 * Both work through Stripe Checkout with no extra code: Stripe shows the
 * button automatically when the customer's device and browser support it and
 * the domain is registered. The only step is registering the domain, which
 * requires the live account — see DEPLOYMENT.md § Apple Pay.
 */
export const WALLET_PAYMENT_METHODS = ['card'] as const
