/**
 * COMMERCIAL CONFIGURATION
 * The membership price is never hardcoded in a component. Everything reads
 * from here, which in turn reads from environment variables, so the price can
 * change without a code change.
 */
const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

export const membership = {
  priceCents: int(process.env.MEMBERSHIP_PRICE_CENTS, 9900),
  currency: (process.env.MEMBERSHIP_CURRENCY ?? 'CAD').toUpperCase(),
  interval: (process.env.MEMBERSHIP_INTERVAL ?? 'year') as 'year' | 'month',
  stripePriceId: process.env.STRIPE_PRICE_ID_ANNUAL || null,
  productName: 'Voyaj Membership',
  productDescription:
    'Unlimited personalised travel deals, traveller matching, circles and group trips.',
} as const

export const market = {
  country: process.env.DEFAULT_MARKET_COUNTRY ?? 'CA',
  currency: process.env.DEFAULT_CURRENCY ?? 'CAD',
  locale: 'en-CA',
} as const

/** Formats integer minor units for display. 9900 → "$99.00" */
export function formatMoney(
  cents: number | null | undefined,
  currency = market.currency,
  opts: { compact?: boolean } = {},
): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return 'Not specified'
  const value = cents / 100
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: opts.compact && value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: opts.compact && value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export function formatMoneyCompact(cents: number | null | undefined, currency = market.currency) {
  return formatMoney(cents, currency, { compact: true })
}
