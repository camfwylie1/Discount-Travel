import { clamp01 } from './affinity'

/**
 * DEAL VALUE — deliberately separate from personality match.
 *
 * A trip can be a 93% personality match AND poor value. Or a mediocre match
 * and an outstanding deal. Conflating the two is how travel sites mislead
 * people, so we never do.
 *
 * We only count a discount when we have evidence for the regular price. A
 * provider's own "was $X" banner is recorded but treated as WEAK evidence
 * unless we have observed that price ourselves in `DealPriceHistory`.
 */

export interface DealValueInput {
  salePriceCents: number | null
  regularPriceCents: number | null
  /** How many times we have independently observed a higher price. */
  observedHigherPriceCount?: number
  durationNights: number | null
  airfareIncluded: boolean | null
  accommodationIncluded: boolean | null
  mealsIncluded: boolean | null
  activitiesIncluded: boolean | null
  guideIncluded: boolean | null
  transportIncluded: boolean | null
  accommodationQuality: number | null
  /** 0..1 provider quality, from the Provider record. */
  providerQuality?: number | null
  spotsRemaining?: number | null
}

export interface DealValueComponent {
  key: string
  label: string
  score: number
  weight: number
  detail: string
}

export interface DealValueResult {
  /** 0..100, or null when we simply do not know enough to judge. */
  score: number | null
  band: 'exceptional' | 'great' | 'good' | 'fair' | 'unknown'
  components: DealValueComponent[]
  /** Verified discount percentage, or null when unsubstantiated. */
  verifiedDiscountPercent: number | null
  claimedDiscountPercent: number | null
  caveats: string[]
}

export function computeDealValue(input: DealValueInput): DealValueResult {
  const components: DealValueComponent[] = []
  const caveats: string[] = []

  // ── Discount, only where substantiated ───────────────────────────────────
  let claimedDiscount: number | null = null
  let verifiedDiscount: number | null = null
  if (input.salePriceCents != null && input.regularPriceCents != null && input.regularPriceCents > input.salePriceCents) {
    claimedDiscount =
      ((input.regularPriceCents - input.salePriceCents) / input.regularPriceCents) * 100
    if ((input.observedHigherPriceCount ?? 0) >= 1) {
      verifiedDiscount = claimedDiscount
    } else {
      caveats.push(
        'The original price is stated by the provider and has not been independently verified.',
      )
    }
    components.push({
      key: 'discount',
      label: 'Discount',
      // A discount we have not verified ourselves earns half credit. We adjust
      // the SCORE only and keep the weight fixed, so that verifying a price
      // can only ever raise the value rating, never lower it.
      score: clamp01(claimedDiscount / 45) * (verifiedDiscount ? 1 : 0.5),
      weight: 0.3,
      detail: verifiedDiscount
        ? `${Math.round(claimedDiscount)}% off the regular price we have observed`
        : `${Math.round(claimedDiscount)}% off the regular price stated by the provider`,
    })
  }

  // ── Inclusions: the single biggest driver of genuine value ───────────────
  const inclusionFlags = [
    { flag: input.airfareIncluded, weight: 0.4, label: 'Flights' },
    { flag: input.accommodationIncluded, weight: 0.25, label: 'Accommodation' },
    { flag: input.mealsIncluded, weight: 0.12, label: 'Meals' },
    { flag: input.activitiesIncluded, weight: 0.11, label: 'Activities' },
    { flag: input.guideIncluded, weight: 0.06, label: 'Guide' },
    { flag: input.transportIncluded, weight: 0.06, label: 'Ground transport' },
  ]
  const known = inclusionFlags.filter((f) => f.flag !== null && f.flag !== undefined)
  if (known.length > 0) {
    const gained = known.filter((f) => f.flag === true).reduce((s, f) => s + f.weight, 0)
    const possible = known.reduce((s, f) => s + f.weight, 0)
    const included = known.filter((f) => f.flag === true).map((f) => f.label)
    components.push({
      key: 'inclusions',
      label: 'What is included',
      score: clamp01(possible > 0 ? gained / possible : 0),
      weight: 0.32,
      detail: included.length > 0 ? `Includes ${included.join(', ').toLowerCase()}` : 'Few inclusions',
    })
    if (known.length < inclusionFlags.length) {
      caveats.push('Some inclusions are not specified by the provider.')
    }
  } else {
    caveats.push('The provider does not specify what is included.')
  }

  // ── Cost per night, benchmarked against the inclusion level ──────────────
  if (input.salePriceCents != null && input.durationNights && input.durationNights > 0) {
    const perNight = input.salePriceCents / input.durationNights / 100
    // Benchmark shifts with what you get: a flight-inclusive package at $260
    // per night is very different from a room-only rate at $260.
    const benchmark = input.airfareIncluded ? 400 : 260
    components.push({
      key: 'perNight',
      label: 'Cost per night',
      score: clamp01(1 - (perNight - benchmark * 0.4) / (benchmark * 1.4)),
      weight: 0.24,
      detail: `About $${Math.round(perNight)} per night${input.airfareIncluded ? ' including flights' : ''}`,
    })
  }

  // ── Accommodation standard for the money ─────────────────────────────────
  if (input.accommodationQuality != null) {
    components.push({
      key: 'quality',
      label: 'Accommodation standard',
      score: clamp01((input.accommodationQuality - 1) / 4),
      weight: 0.08,
      detail: `${input.accommodationQuality}-star standard`,
    })
  }

  // ── Provider quality ─────────────────────────────────────────────────────
  if (input.providerQuality != null) {
    components.push({
      key: 'provider',
      label: 'Provider',
      score: clamp01(input.providerQuality),
      weight: 0.06,
      detail: 'Based on provider track record',
    })
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0)
  // Not enough evidence to make a claim — say so rather than inventing a number.
  if (components.length < 2 || totalWeight < 0.3) {
    return {
      score: null,
      band: 'unknown',
      components,
      verifiedDiscountPercent: verifiedDiscount,
      claimedDiscountPercent: claimedDiscount,
      caveats: [...caveats, 'Not enough information to rate the value of this trip.'],
    }
  }

  const raw = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
  const score = Math.round(clamp01(raw) * 100)

  return {
    score,
    band: score >= 82 ? 'exceptional' : score >= 68 ? 'great' : score >= 50 ? 'good' : 'fair',
    components,
    verifiedDiscountPercent: verifiedDiscount,
    claimedDiscountPercent: claimedDiscount,
    caveats,
  }
}

export function valueBandLabel(band: DealValueResult['band']): string {
  switch (band) {
    case 'exceptional':
      return 'Exceptional value'
    case 'great':
      return 'Great value'
    case 'good':
      return 'Good value'
    case 'fair':
      return 'Fair value'
    default:
      return 'Value not rated'
  }
}
