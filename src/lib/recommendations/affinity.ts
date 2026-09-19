/**
 * AFFINITY MATHS
 *
 * The single most important idea in the engine: a 1–5 rating carries BOTH a
 * direction and an importance.
 *
 *     affinity a = (rating - 3) / 2      ∈ [-1, +1]
 *     weight   w = |a|
 *
 *   rating 1 → a = -1.0  "actively avoid"      weight 1.0
 *   rating 2 → a = -0.5  "slight preference against"
 *   rating 3 → a =  0.0  "neutral"             weight 0.0  (ignored entirely)
 *   rating 4 → a = +0.5  "important"
 *   rating 5 → a = +1.0  "extremely important" weight 1.0
 *
 * This is what makes a 1 mean "penalise me for this", not merely "no bonus".
 *
 * A deal's intensity x ∈ [0,1] is re-centred the same way so the two can be
 * multiplied directly:
 *
 *     t = (2x - 1) · confidence          ∈ [-1, +1]
 *
 *   x = 1.0 → t = +1  "this trip is strongly about that"
 *   x = 0.5 → t =  0  "middling / not a feature"
 *   x = 0.0 → t = -1  "this trip is definitely not that"
 *
 * Contribution for one dimension is a · t, which gives the four behaviours we
 * need, symmetrically:
 *
 *   love it   (a=+1) & trip has it   (t=+1) → +1   delight
 *   love it   (a=+1) & trip lacks it (t=-1) → -1   disappointment
 *   avoid it  (a=-1) & trip lacks it (t=-1) → +1   relief  ← the key case
 *   avoid it  (a=-1) & trip has it   (t=+1) → -1   aversion
 */

export const MISSING_ATTRIBUTE_WEIGHT_FACTOR = 0.35

export function ratingToAffinity(rating: number | null | undefined): number {
  if (rating === null || rating === undefined || !Number.isFinite(rating)) return 0
  const clamped = Math.min(5, Math.max(1, rating))
  return (clamped - 3) / 2
}

export function affinityToRating(affinity: number): number {
  return Math.round(Math.min(1, Math.max(-1, affinity)) * 2 + 3)
}

/** Deal intensity 0..1 → signed, confidence-scaled value in [-1, 1]. */
export function intensityToSigned(intensity: number, confidence = 1): number {
  const i = clamp(intensity, 0, 1)
  const c = clamp(confidence, 0, 1)
  return (2 * i - 1) * c
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export const clamp01 = (v: number) => clamp(v, 0, 1)

/** Maps a signed score in [-1, 1] onto [0, 1] for display and weighting. */
export const signedToUnit = (v: number) => clamp01((v + 1) / 2)

/** Spectrum answers are 0..100; convert to 0..1. */
export const spectrumToUnit = (v: number | null | undefined) =>
  v === null || v === undefined ? 0.5 : clamp01(v / 100)

export interface WeightedAverageInput {
  value: number
  weight: number
}

export function weightedAverage(items: WeightedAverageInput[], fallback = 0): number {
  let num = 0
  let den = 0
  for (const item of items) {
    if (!Number.isFinite(item.value) || !Number.isFinite(item.weight) || item.weight <= 0) continue
    num += item.value * item.weight
    den += item.weight
  }
  return den === 0 ? fallback : num / den
}

/**
 * Smooth falloff used by budget / duration fit: full marks up to `ideal`,
 * then easing down to zero at `limit`.
 */
export function falloff(value: number, ideal: number, limit: number): number {
  if (!Number.isFinite(value)) return 0.5
  if (value <= ideal) return 1
  if (limit <= ideal) return value <= ideal ? 1 : 0
  const t = (value - ideal) / (limit - ideal)
  // easeOutQuad keeps near-misses generous and far-misses harsh
  return clamp01(1 - t * t)
}

/** Overlap of two closed ranges, as a fraction of the smaller range. */
export function rangeOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): number {
  const lo = Math.max(aMin, bMin)
  const hi = Math.min(aMax, bMax)
  if (hi < lo) return 0
  const overlap = hi - lo
  const smaller = Math.min(aMax - aMin, bMax - bMin)
  if (smaller <= 0) return overlap >= 0 ? 1 : 0
  return clamp01(overlap / smaller)
}

const EARTH_RADIUS_KM = 6371

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}
