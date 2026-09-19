import {
  clamp01,
  falloff,
  intensityToSigned,
  MISSING_ATTRIBUTE_WEIGHT_FACTOR,
  ratingToAffinity,
  signedToUnit,
  spectrumToUnit,
} from './affinity'
import { airportMatches, checkHardConstraints, type ConstraintContext } from './constraints'
import type {
  ComponentKey,
  DealMatchResult,
  DimensionMeta,
  MatchMismatch,
  MatchReason,
  ScoreComponent,
  ScoreableDeal,
  ScoreableUser,
} from './types'
import { ENGINE_VERSION } from './types'

/**
 * DEAL MATCH SCORE
 *
 *   MatchScore = Σ ( weightₖ · componentₖ ) / Σ weightₖ        → 0..1 → ×100
 *
 * Nine components, each normalised to 0..1. A component whose data is missing
 * gets a reduced weight rather than a guessed value, so the score degrades
 * gracefully instead of lying.
 *
 * Full worked examples and the rationale for each weight: RECOMMENDATIONS.md
 */

export const COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  interests: 0.20, // travel style + culture + food/drink dimensions
  activities: 0.14, // what you actually do on the trip
  social: 0.06, // group size, meeting people, nightlife
  accommodation: 0.05, // where you sleep and how comfortable it is
  style: 0.11, // the spectrum answers (pace, planning, comfort…)
  budget: 0.17,
  airport: 0.13,
  dates: 0.08,
  duration: 0.06,
}

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  interests: 'Interests',
  activities: 'Activities',
  social: 'Social style',
  accommodation: 'Accommodation',
  style: 'Travel style',
  budget: 'Budget',
  airport: 'Departure',
  dates: 'Dates',
  duration: 'Trip length',
}

/**
 * AVERSION PENALTY
 *
 * Category weights alone cannot express a dealbreaker. Someone who rates
 * Partying 1 ("actively avoid") should see a party-centric trip fall a long
 * way, even though the Social category carries only 6% of the score.
 *
 * So a strongly-violated aversion applies a direct penalty to the final
 * score, on top of its component contribution. This is the "negative
 * compatibility adjustment" the product requires.
 */
const AVERSION_PENALTY_PER_VIOLATION = 0.14
const MAX_AVERSION_PENALTY = 0.28
/** Only affinities at or below this count as a real aversion (rating 1 or 2). */
const AVERSION_THRESHOLD = -0.5

/** Which preference categories roll up into which score component. */
const CATEGORY_TO_COMPONENT: Record<string, ComponentKey> = {
  TRAVEL_STYLE: 'interests',
  CULTURE: 'interests',
  FOOD_DRINK: 'interests',
  ACTIVITY: 'activities',
  SOCIAL: 'social',
  ACCOMMODATION: 'accommodation',
}

const DAY_MS = 86_400_000

export interface ScoreDealOptions {
  dimensions: Map<string, DimensionMeta>
  airportCoords?: Map<string, { latitude: number | null; longitude: number | null }>
  /** Include deals that fail hard constraints (flagged), instead of dropping them. */
  includeFiltered?: boolean
  now?: Date
}

export function scoreDeal(
  user: ScoreableUser,
  deal: ScoreableDeal,
  options: ScoreDealOptions,
): DealMatchResult {
  const now = options.now ?? new Date()
  const ctx: ConstraintContext = {
    constraints: user.constraints,
    airports: user.airports,
    airportCoords: options.airportCoords,
  }

  const failures = checkHardConstraints(deal, ctx)
  const components: ScoreComponent[] = []
  const reasons: MatchReason[] = []
  const mismatches: MatchMismatch[] = []

  // ── 1-4. Preference-driven components, grouped by category ───────────────
  const attrById = new Map(deal.attributes.map((a) => [a.dimensionId, a]))
  const buckets = new Map<
    ComponentKey,
    { num: number; den: number; dataWeight: number; totalWeight: number }
  >()
  /** Accumulated strength of aversions this trip actively violates. */
  let aversionViolation = 0

  for (const pref of user.preferences) {
    const dim = options.dimensions.get(pref.dimensionId)
    if (!dim || dim.kind !== 'RATING') continue
    const component = CATEGORY_TO_COMPONENT[dim.category]
    if (!component) continue

    const affinity = ratingToAffinity(pref.rating)
    if (affinity === 0) continue // genuinely neutral — contributes nothing

    const weight = Math.abs(affinity) * (dim.engineWeight || 1)
    const attr = attrById.get(pref.dimensionId)

    const bucket = buckets.get(component) ?? { num: 0, den: 0, dataWeight: 0, totalWeight: 0 }
    bucket.totalWeight += weight

    if (!attr) {
      // No information about this dimension for this deal. Count it at a
      // reduced weight with a neutral contribution — we neither reward nor
      // punish a provider for not describing something.
      bucket.den += weight * MISSING_ATTRIBUTE_WEIGHT_FACTOR
      buckets.set(component, bucket)
      continue
    }

    const signed = intensityToSigned(attr.intensity, attr.confidence)
    const contribution = affinity * signed // ∈ [-1, 1]

    // The traveller asked to avoid this and the trip is built around it.
    if (affinity <= AVERSION_THRESHOLD && signed > 0) {
      aversionViolation += Math.abs(affinity) * signed
    }
    bucket.num += contribution * (dim.engineWeight || 1)
    bucket.den += weight
    bucket.dataWeight += weight
    buckets.set(component, bucket)

    // ── Collect explanation evidence
    const strength = Math.abs(contribution)
    if (contribution >= 0.45 && affinity > 0) {
      reasons.push({ key: dim.key, label: dim.label, kind: 'love', strength })
    } else if (contribution >= 0.45 && affinity < 0) {
      reasons.push({
        key: dim.key,
        label: `Very little ${dim.label.toLowerCase()}`,
        kind: 'love',
        strength,
      })
    } else if (contribution <= -0.45) {
      mismatches.push({
        key: dim.key,
        label:
          affinity > 0
            ? `Limited ${dim.label.toLowerCase()}`
            : `Strong ${dim.label.toLowerCase()} focus`,
        // A violated aversion is always reported as notable — it is the kind
        // of thing that ruins a trip, not a nuance.
        severity: affinity < 0 || contribution <= -0.7 ? 'notable' : 'minor',
      })
    }
  }

  for (const key of ['interests', 'activities', 'social', 'accommodation'] as const) {
    const bucket = buckets.get(key)
    if (!bucket || bucket.den === 0) {
      components.push({
        key,
        label: COMPONENT_LABELS[key],
        score: 0.5,
        weight: COMPONENT_WEIGHTS[key] * 0.25,
        detail: 'Not enough information to judge',
        neutral: true,
      })
      continue
    }
    const signedScore = bucket.num / bucket.den // ∈ [-1, 1]
    // Weight scales with how much of the traveller's stated importance was
    // actually backed by data about this deal.
    const coverage = bucket.totalWeight > 0 ? bucket.dataWeight / bucket.totalWeight : 0
    components.push({
      key,
      label: COMPONENT_LABELS[key],
      score: signedToUnit(signedScore),
      weight: COMPONENT_WEIGHTS[key] * (0.3 + 0.7 * clamp01(coverage)),
      detail: describeSigned(signedScore),
      neutral: coverage < 0.15,
    })
  }

  // ── 5. Spectrum / travel style ───────────────────────────────────────────
  components.push(scoreSpectrums(user, deal, options, attrById))

  // ── 6. Budget ────────────────────────────────────────────────────────────
  components.push(scoreBudget(user, deal, reasons, mismatches))

  // ── 7. Airport ───────────────────────────────────────────────────────────
  components.push(scoreAirport(user, deal, ctx, reasons, mismatches))

  // ── 8. Dates ─────────────────────────────────────────────────────────────
  components.push(scoreDates(user, deal, now, reasons, mismatches))

  // ── 9. Duration ──────────────────────────────────────────────────────────
  components.push(scoreDuration(user, deal, reasons, mismatches))

  // ── Wishlist bonus: a destination the traveller explicitly wants.
  let wishlistBonus = 0
  if (deal.destinationCountry && user.wishlistCountries?.includes(deal.destinationCountry)) {
    wishlistBonus = 0.04
    reasons.push({
      key: 'wishlist',
      label: 'On your travel wishlist',
      kind: 'love',
      strength: 1,
    })
  } else if (deal.destinationIds?.some((id) => user.wishlistDestinationIds?.includes(id))) {
    wishlistBonus = 0.03
    reasons.push({ key: 'wishlist', label: 'On your travel wishlist', kind: 'love', strength: 0.8 })
  }

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0)
  const base = totalWeight > 0 ? weighted / totalWeight : 0.5

  const aversionPenalty = Math.min(
    MAX_AVERSION_PENALTY,
    aversionViolation * AVERSION_PENALTY_PER_VIOLATION,
  )
  const score = clamp01(base + wishlistBonus - aversionPenalty)

  const dataWeight = components.filter((c) => !c.neutral).reduce((s, c) => s + c.weight, 0)
  const confidence = totalWeight > 0 ? clamp01(dataWeight / totalWeight) : 0

  reasons.sort((a, b) => b.strength - a.strength)
  mismatches.sort((a, b) => (a.severity === 'notable' ? -1 : 1) - (b.severity === 'notable' ? -1 : 1))

  return {
    dealId: deal.dealId,
    score: Math.round(score * 100),
    passed: failures.length === 0,
    failures,
    components,
    reasons: reasons.slice(0, 8),
    mismatches: mismatches.slice(0, 4),
    engineVersion: ENGINE_VERSION,
    confidence,
  }
}

function describeSigned(v: number): string {
  if (v >= 0.6) return 'Very strong fit'
  if (v >= 0.25) return 'Good fit'
  if (v >= -0.1) return 'Mixed fit'
  if (v >= -0.5) return 'Weak fit'
  return 'Poor fit'
}

// ─────────────────────────────────────────────────────────────────────────

function scoreSpectrums(
  user: ScoreableUser,
  _deal: ScoreableDeal,
  options: ScoreDealOptions,
  attrById: Map<string, { intensity: number; confidence: number }>,
): ScoreComponent {
  let num = 0
  let den = 0
  let matched = 0
  for (const pref of user.preferences) {
    const dim = options.dimensions.get(pref.dimensionId)
    if (!dim || dim.kind !== 'SPECTRUM') continue
    const attr = attrById.get(pref.dimensionId)
    if (!attr) continue
    const userValue = spectrumToUnit(pref.spectrum)
    const dealValue = clamp01(attr.intensity)
    // 1 when identical, 0 when at opposite poles.
    const fit = 1 - Math.abs(userValue - dealValue)
    const weight = (dim.engineWeight || 1) * clamp01(attr.confidence)
    num += fit * weight
    den += weight
    matched += 1
  }
  if (den === 0) {
    return {
      key: 'style',
      label: COMPONENT_LABELS.style,
      score: 0.5,
      weight: COMPONENT_WEIGHTS.style * 0.25,
      detail: 'Travel style not specified for this trip',
      neutral: true,
    }
  }
  const score = clamp01(num / den)
  return {
    key: 'style',
    label: COMPONENT_LABELS.style,
    score,
    weight: COMPONENT_WEIGHTS.style * clamp01(0.4 + matched / 8),
    detail:
      score >= 0.75
        ? 'Matches the pace and style you prefer'
        : score >= 0.5
          ? 'Broadly matches your travel style'
          : 'A different pace to your usual style',
    neutral: false,
  }
}

function scoreBudget(
  user: ScoreableUser,
  deal: ScoreableDeal,
  reasons: MatchReason[],
  mismatches: MatchMismatch[],
): ScoreComponent {
  const c = user.constraints
  const price = deal.salePriceCents
  if (price == null || (c.budgetMax == null && c.budgetPreferred == null)) {
    return {
      key: 'budget',
      label: COMPONENT_LABELS.budget,
      score: 0.5,
      weight: COMPONENT_WEIGHTS.budget * 0.25,
      detail: price == null ? 'Price not specified' : 'No budget set',
      neutral: true,
    }
  }

  const preferred = c.budgetPreferred ?? Math.round((c.budgetMax ?? 0) * 0.8)
  const max = c.budgetMax ?? Math.round(preferred * 1.35)
  const min = c.budgetMin ?? 0

  let score: number
  let detail: string

  if (price < min) {
    // Suspiciously cheap relative to what they said they'd spend — mild
    // discount, because cheap is not automatically good.
    score = 0.8
    detail = 'Below your usual spend'
  } else if (price <= preferred) {
    score = 1
    const headroom = preferred - price
    detail =
      headroom > preferred * 0.2
        ? `Comfortably inside your budget`
        : 'Right at your preferred budget'
  } else {
    score = falloff(price, preferred, max)
    detail = price <= max ? 'Above your preferred price but within your maximum' : 'Over budget'
  }

  if (score >= 0.95 && price <= preferred) {
    reasons.push({
      key: 'budget',
      label: 'Within your budget',
      kind: 'fit',
      strength: 0.9,
    })
  } else if (score < 0.5) {
    mismatches.push({
      key: 'budget',
      label: 'Pricier than you usually go',
      severity: score < 0.25 ? 'notable' : 'minor',
    })
  }

  return {
    key: 'budget',
    label: COMPONENT_LABELS.budget,
    score: clamp01(score),
    weight: COMPONENT_WEIGHTS.budget,
    detail,
    neutral: false,
  }
}

function scoreAirport(
  user: ScoreableUser,
  deal: ScoreableDeal,
  ctx: ConstraintContext,
  reasons: MatchReason[],
  mismatches: MatchMismatch[],
): ScoreComponent {
  if (user.airports.length === 0 || !deal.departureAirportIata) {
    return {
      key: 'airport',
      label: COMPONENT_LABELS.airport,
      score: 0.5,
      weight: COMPONENT_WEIGHTS.airport * 0.25,
      detail: deal.departureAirportIata ? 'No preferred airports set' : 'Departure not specified',
      neutral: true,
    }
  }

  const iatas = [deal.departureAirportIata, ...(deal.alternateDepartureIatas ?? [])]
  const ranked = user.airports
    .map((ua) => (iatas.includes(ua.iata) ? ua.rank : null))
    .filter((r): r is number => r !== null)

  if (ranked.length > 0) {
    const bestRank = Math.min(...ranked)
    // First choice = 1.0, second = 0.92, third = 0.86 …
    const score = clamp01(1 - (bestRank - 1) * 0.07)
    if (bestRank === 1) {
      reasons.push({
        key: 'airport',
        label: `Departs from ${deal.departureAirportIata}`,
        kind: 'fit',
        strength: 0.95,
      })
    }
    return {
      key: 'airport',
      label: COMPONENT_LABELS.airport,
      score,
      weight: COMPONENT_WEIGHTS.airport,
      detail: `Departs ${deal.departureAirportIata}, one of your airports`,
      neutral: false,
    }
  }

  if (airportMatches(deal, ctx)) {
    return {
      key: 'airport',
      label: COMPONENT_LABELS.airport,
      score: 0.72,
      weight: COMPONENT_WEIGHTS.airport,
      detail: `Departs ${deal.departureAirportIata}, near one of your airports`,
      neutral: false,
    }
  }

  mismatches.push({
    key: 'airport',
    label: `Departs from ${deal.departureAirportIata}`,
    severity: 'notable',
  })
  return {
    key: 'airport',
    label: COMPONENT_LABELS.airport,
    score: 0.1,
    weight: COMPONENT_WEIGHTS.airport,
    detail: `Departs ${deal.departureAirportIata}, not one of your airports`,
    neutral: false,
  }
}

function scoreDates(
  user: ScoreableUser,
  deal: ScoreableDeal,
  now: Date,
  reasons: MatchReason[],
  mismatches: MatchMismatch[],
): ScoreComponent {
  const c = user.constraints
  if (!deal.departureDate) {
    return {
      key: 'dates',
      label: COMPONENT_LABELS.dates,
      score: 0.5,
      weight: COMPONENT_WEIGHTS.dates * 0.3,
      detail: 'Departure date not specified',
      neutral: true,
    }
  }
  if (deal.departureDate.getTime() < now.getTime()) {
    return {
      key: 'dates',
      label: COMPONENT_LABELS.dates,
      score: 0,
      weight: COMPONENT_WEIGHTS.dates,
      detail: 'Departure date has passed',
      neutral: false,
    }
  }

  const hasWindow = c.earliestDeparture || c.latestReturn
  const hasMonths = (c.preferredMonths?.length ?? 0) > 0
  if (!hasWindow && !hasMonths) {
    return {
      key: 'dates',
      label: COMPONENT_LABELS.dates,
      score: 0.7,
      weight: COMPONENT_WEIGHTS.dates * 0.5,
      detail: 'You are flexible on dates',
      neutral: false,
    }
  }

  let score = 1
  const flexDays = c.dateFlexibilityDays ?? 7

  if (c.earliestDeparture) {
    const daysEarly = (c.earliestDeparture.getTime() - deal.departureDate.getTime()) / DAY_MS
    if (daysEarly > 0) score = Math.min(score, falloff(daysEarly, 0, Math.max(1, flexDays * 2)))
  }
  if (c.latestReturn) {
    const end = deal.returnDate ?? deal.departureDate
    const daysLate = (end.getTime() - c.latestReturn.getTime()) / DAY_MS
    if (daysLate > 0) score = Math.min(score, falloff(daysLate, 0, Math.max(1, flexDays * 2)))
  }
  if (hasMonths) {
    const month = deal.departureDate.getUTCMonth() + 1
    if (!c.preferredMonths!.includes(month)) {
      // Adjacent month is a near miss, not a failure.
      const adjacent = c.preferredMonths!.some(
        (m) => Math.abs(m - month) === 1 || Math.abs(m - month) === 11,
      )
      score = Math.min(score, adjacent ? 0.7 : 0.35)
    }
  }

  if (score >= 0.95) {
    reasons.push({ key: 'dates', label: 'Fits your travel dates', kind: 'fit', strength: 0.85 })
  } else if (score < 0.5) {
    mismatches.push({
      key: 'dates',
      label: 'Outside your usual travel window',
      severity: score < 0.3 ? 'notable' : 'minor',
    })
  }

  return {
    key: 'dates',
    label: COMPONENT_LABELS.dates,
    score: clamp01(score),
    weight: COMPONENT_WEIGHTS.dates,
    detail: score >= 0.95 ? 'Inside your travel window' : 'Partly outside your travel window',
    neutral: false,
  }
}

function scoreDuration(
  user: ScoreableUser,
  deal: ScoreableDeal,
  reasons: MatchReason[],
  mismatches: MatchMismatch[],
): ScoreComponent {
  const c = user.constraints
  const nights = deal.durationNights
  if (nights == null || (c.durationMin == null && c.durationMax == null && c.durationPreferred == null)) {
    return {
      key: 'duration',
      label: COMPONENT_LABELS.duration,
      score: 0.5,
      weight: COMPONENT_WEIGHTS.duration * 0.3,
      detail: nights == null ? 'Trip length not specified' : 'No preferred trip length set',
      neutral: true,
    }
  }

  const min = c.durationMin ?? 1
  const max = c.durationMax ?? 60
  const preferred = c.durationPreferred ?? Math.round((min + max) / 2)

  let score: number
  if (nights >= min && nights <= max) {
    // Inside the acceptable range; closeness to the sweet spot is a bonus.
    const spread = Math.max(1, Math.max(preferred - min, max - preferred))
    score = clamp01(1 - (Math.abs(nights - preferred) / spread) * 0.35)
  } else {
    const distance = nights < min ? min - nights : nights - max
    score = falloff(distance, 0, 7) * 0.6
  }

  if (score >= 0.9) {
    reasons.push({
      key: 'duration',
      label: `${nights} nights suits you`,
      kind: 'fit',
      strength: 0.7,
    })
  } else if (score < 0.45) {
    mismatches.push({
      key: 'duration',
      label: nights < min ? 'Shorter than you usually travel' : 'Longer than you usually travel',
      severity: score < 0.25 ? 'notable' : 'minor',
    })
  }

  return {
    key: 'duration',
    label: COMPONENT_LABELS.duration,
    score,
    weight: COMPONENT_WEIGHTS.duration,
    detail: `${nights} nights`,
    neutral: false,
  }
}
