import { clamp01, rangeOverlap, ratingToAffinity, spectrumToUnit, weightedAverage } from './affinity'
import type {
  DimensionMeta,
  MatchMismatch,
  MatchReason,
  ScoreComponent,
  ScoreableUser,
  TravelerMatchResult,
} from './types'
import { ENGINE_VERSION } from './types'

/**
 * TRAVELLER COMPATIBILITY
 *
 * A separate engine from deal matching, because "would I enjoy this trip?"
 * and "would I enjoy this trip WITH YOU?" are different questions.
 *
 * Two people are compatible when they want the same *kind* of trip, can
 * afford the same trip, and can actually go at the same time. Crucially, we
 * surface genuine conflicts rather than averaging them away: one person
 * rating nightlife 5 and the other rating it 1 is a real problem, and burying
 * it in a mean would be dishonest.
 *
 * Compatibility is computed from TRAVEL characteristics only. No sensitive
 * personal characteristic is ever inferred or used.
 */

export const TRAVELER_WEIGHTS = {
  interests: 0.3,
  activities: 0.16,
  social: 0.12,
  style: 0.14,
  budget: 0.13,
  duration: 0.06,
  destinations: 0.06,
  availability: 0.03,
} as const

export interface TravelerScoreOptions {
  dimensions: Map<string, DimensionMeta>
  /** Dimension keys the viewer marked as "extremely important" for people matching. */
  now?: Date
}

export function scoreTravelers(
  a: ScoreableUser,
  b: ScoreableUser,
  options: TravelerScoreOptions,
): TravelerMatchResult {
  const components: ScoreComponent[] = []
  const shared: MatchReason[] = []
  const conflicts: MatchMismatch[] = []

  const aPrefs = new Map(a.preferences.map((p) => [p.dimensionId, p]))
  const bPrefs = new Map(b.preferences.map((p) => [p.dimensionId, p]))

  // ── Preference agreement, by category ────────────────────────────────────
  const buckets = new Map<string, { items: { value: number; weight: number }[] }>()

  for (const [dimensionId, aPref] of aPrefs) {
    const bPref = bPrefs.get(dimensionId)
    if (!bPref) continue
    const dim = options.dimensions.get(dimensionId)
    if (!dim) continue

    if (dim.kind === 'SPECTRUM') {
      const av = spectrumToUnit(aPref.spectrum)
      const bv = spectrumToUnit(bPref.spectrum)
      const agreement = 1 - Math.abs(av - bv)
      push(buckets, 'style', agreement, dim.engineWeight || 1)
      if (agreement < 0.35) {
        conflicts.push({
          key: dim.key,
          label: spectrumConflictLabel(dim),
          severity: agreement < 0.2 ? 'notable' : 'minor',
        })
      } else if (agreement > 0.88) {
        shared.push({ key: dim.key, label: dim.label, kind: 'fit', strength: agreement })
      }
      continue
    }

    const aa = ratingToAffinity(aPref.rating)
    const ba = ratingToAffinity(bPref.rating)
    // How much this dimension matters to EITHER person decides its weight.
    const importance = Math.max(Math.abs(aa), Math.abs(ba))
    if (importance === 0) continue

    // Members can say "hiking compatibility is extremely important to me".
    const declared = Math.max(aPref.peopleWeight ?? 3, bPref.peopleWeight ?? 3)
    const declaredMultiplier = 0.5 + (clamp01((declared - 1) / 4) * 1.0) // 0.5 … 1.5

    // Agreement on a signed scale: identical affinities = 1, opposite = 0.
    const agreement = 1 - Math.abs(aa - ba) / 2
    const weight = importance * (dim.engineWeight || 1) * declaredMultiplier

    const bucketKey =
      dim.category === 'ACTIVITY'
        ? 'activities'
        : dim.category === 'SOCIAL'
          ? 'social'
          : 'interests'
    push(buckets, bucketKey, agreement, weight)

    // ── Evidence
    if (aa >= 0.5 && ba >= 0.5) {
      shared.push({
        key: dim.key,
        label: dim.label,
        kind: 'love',
        strength: Math.min(aa, ba) * declaredMultiplier,
      })
    } else if ((aa >= 0.5 && ba <= -0.5) || (aa <= -0.5 && ba >= 0.5)) {
      conflicts.push({
        key: dim.key,
        label: dim.label,
        severity: Math.abs(aa - ba) >= 1.5 ? 'notable' : 'minor',
      })
    }
  }

  for (const key of ['interests', 'activities', 'social', 'style'] as const) {
    const bucket = buckets.get(key)
    const weightKey = key as keyof typeof TRAVELER_WEIGHTS
    if (!bucket || bucket.items.length === 0) {
      components.push({
        key: key === 'style' ? 'style' : (key as 'interests' | 'activities' | 'social'),
        label: labelFor(key),
        score: 0.5,
        weight: TRAVELER_WEIGHTS[weightKey] * 0.25,
        detail: 'Not enough shared answers yet',
        neutral: true,
      })
      continue
    }
    const score = clamp01(weightedAverage(bucket.items, 0.5))
    components.push({
      key: key === 'style' ? 'style' : (key as 'interests' | 'activities' | 'social'),
      label: labelFor(key),
      score,
      weight: TRAVELER_WEIGHTS[weightKey],
      detail: score >= 0.8 ? 'Strongly aligned' : score >= 0.6 ? 'Broadly aligned' : 'Quite different',
      neutral: false,
    })
  }

  // ── Budget compatibility ─────────────────────────────────────────────────
  components.push(budgetComponent(a, b, shared, conflicts))

  // ── Trip length compatibility ────────────────────────────────────────────
  components.push(durationComponent(a, b, shared, conflicts))

  // ── Destination overlap ──────────────────────────────────────────────────
  components.push(destinationComponent(a, b, shared))

  // ── Availability overlap ─────────────────────────────────────────────────
  components.push(availabilityComponent(a, b, conflicts))

  const totalWeight = components.reduce((s, c) => s + c.weight, 0)
  const weighted = components.reduce((s, c) => s + c.score * c.weight, 0)
  let score = totalWeight > 0 ? weighted / totalWeight : 0.5

  // A notable conflict is not allowed to hide behind a high average.
  const notableConflicts = conflicts.filter((c) => c.severity === 'notable').length
  if (notableConflicts > 0) score *= Math.max(0.7, 1 - notableConflicts * 0.06)

  shared.sort((x, y) => y.strength - x.strength)

  return {
    score: Math.round(clamp01(score) * 100),
    components,
    shared: shared.slice(0, 8),
    conflicts: conflicts.slice(0, 5),
    engineVersion: ENGINE_VERSION,
  }
}

function push(
  buckets: Map<string, { items: { value: number; weight: number }[] }>,
  key: string,
  value: number,
  weight: number,
) {
  const bucket = buckets.get(key) ?? { items: [] }
  bucket.items.push({ value, weight })
  buckets.set(key, bucket)
}

function labelFor(key: string): string {
  return key === 'interests'
    ? 'Interests'
    : key === 'activities'
      ? 'Activities'
      : key === 'social'
        ? 'Social style'
        : 'Travel style'
}

/**
 * Describes a spectrum disagreement in the travellers' own terms.
 *
 * "Pace" on its own tells nobody anything. "Pace: one of you wants Relaxed,
 * the other Packed itinerary" is the thing a person actually needs to read
 * before agreeing to share a trip. Falls back to the bare dimension label
 * when the dimension has no pole wording to quote.
 */
function spectrumConflictLabel(dim: DimensionMeta): string {
  const low = dim.poleLowLabel?.trim()
  const high = dim.poleHighLabel?.trim()
  if (!low || !high) return dim.label

  // The sentence is deliberately anonymous ("one of you"), so it is ordered by
  // the spectrum's own poles rather than by where each traveller sits. The
  // caller has already established that they are far apart; ordering by the
  // pair would describe one fact two different ways depending on who is
  // reading it, and the rest of this engine is symmetric.
  return `${dim.label}: one of you leans ${low.toLowerCase()}, the other ${high.toLowerCase()}`
}

function budgetComponent(
  a: ScoreableUser,
  b: ScoreableUser,
  shared: MatchReason[],
  conflicts: MatchMismatch[],
): ScoreComponent {
  const aMax = a.constraints.budgetMax
  const bMax = b.constraints.budgetMax
  const aPref = a.constraints.budgetPreferred ?? aMax
  const bPref = b.constraints.budgetPreferred ?? bMax
  if (aPref == null || bPref == null) {
    return {
      key: 'budget',
      label: 'Budget',
      score: 0.5,
      weight: TRAVELER_WEIGHTS.budget * 0.25,
      detail: 'Budget not set',
      neutral: true,
    }
  }
  const ratio = Math.min(aPref, bPref) / Math.max(aPref, bPref)
  const score = clamp01((ratio - 0.4) / 0.6)
  if (score >= 0.8) {
    shared.push({ key: 'budget', label: 'Similar budget', kind: 'fit', strength: score })
  } else if (score < 0.45) {
    conflicts.push({
      key: 'budget',
      label: 'Different budgets',
      severity: score < 0.25 ? 'notable' : 'minor',
    })
  }
  return {
    key: 'budget',
    label: 'Budget',
    score,
    weight: TRAVELER_WEIGHTS.budget,
    detail: score >= 0.8 ? 'You spend about the same' : 'You budget quite differently',
    neutral: false,
  }
}

function durationComponent(
  a: ScoreableUser,
  b: ScoreableUser,
  shared: MatchReason[],
  _conflicts: MatchMismatch[],
): ScoreComponent {
  const aMin = a.constraints.durationMin
  const aMax = a.constraints.durationMax
  const bMin = b.constraints.durationMin
  const bMax = b.constraints.durationMax
  if (aMin == null || aMax == null || bMin == null || bMax == null) {
    return {
      key: 'duration',
      label: 'Trip length',
      score: 0.5,
      weight: TRAVELER_WEIGHTS.duration * 0.25,
      detail: 'Trip length not set',
      neutral: true,
    }
  }
  const score = rangeOverlap(aMin, aMax, bMin, bMax)
  if (score >= 0.7) {
    shared.push({ key: 'duration', label: 'Similar trip length', kind: 'fit', strength: score })
  }
  return {
    key: 'duration',
    label: 'Trip length',
    score,
    weight: TRAVELER_WEIGHTS.duration,
    detail: score >= 0.7 ? 'You travel for similar lengths' : 'You prefer different trip lengths',
    neutral: false,
  }
}

function destinationComponent(
  a: ScoreableUser,
  b: ScoreableUser,
  shared: MatchReason[],
): ScoreComponent {
  const aList = new Set(a.wishlistCountries ?? [])
  const bList = new Set(b.wishlistCountries ?? [])
  if (aList.size === 0 || bList.size === 0) {
    return {
      key: 'interests',
      label: 'Destinations',
      score: 0.5,
      weight: TRAVELER_WEIGHTS.destinations * 0.25,
      detail: 'No shared wishlist yet',
      neutral: true,
    }
  }
  const overlap = [...aList].filter((x) => bList.has(x))
  const score = clamp01(overlap.length / Math.min(aList.size, bList.size))
  if (overlap.length > 0) {
    shared.push({
      key: 'destinations',
      label: `${overlap.length} shared wishlist ${overlap.length === 1 ? 'destination' : 'destinations'}`,
      kind: 'love',
      strength: score,
    })
  }
  return {
    key: 'interests',
    label: 'Destinations',
    score,
    weight: TRAVELER_WEIGHTS.destinations,
    detail: overlap.length > 0 ? `Both want to visit ${overlap.slice(0, 3).join(', ')}` : 'Different wishlists',
    neutral: false,
  }
}

function availabilityComponent(
  a: ScoreableUser,
  b: ScoreableUser,
  conflicts: MatchMismatch[],
): ScoreComponent {
  const aMonths = new Set(a.constraints.preferredMonths ?? [])
  const bMonths = new Set(b.constraints.preferredMonths ?? [])
  if (aMonths.size === 0 || bMonths.size === 0) {
    return {
      key: 'dates',
      label: 'Availability',
      score: 0.5,
      weight: TRAVELER_WEIGHTS.availability * 0.25,
      detail: 'Travel months not set',
      neutral: true,
    }
  }
  const overlap = [...aMonths].filter((m) => bMonths.has(m))
  const score = clamp01(overlap.length / Math.min(aMonths.size, bMonths.size))
  if (score === 0) {
    conflicts.push({ key: 'availability', label: 'No overlapping travel months', severity: 'minor' })
  }
  return {
    key: 'dates',
    label: 'Availability',
    score,
    weight: TRAVELER_WEIGHTS.availability,
    detail: overlap.length > 0 ? 'You can travel at the same time of year' : 'Different travel months',
    neutral: false,
  }
}
