import { clamp01, ratingToAffinity, spectrumToUnit } from '@/lib/recommendations/affinity'
import { RADAR_AXES, type RadarAxis } from '@/lib/taxonomy/dimensions'

/**
 * TRAVEL DNA
 *
 * Rolls a traveller's ~100 preference answers up into ten consumer-facing
 * axes for the profile visualisation.
 *
 * This is travel personalisation and entertainment. It is explicitly NOT a
 * psychological instrument, it is never described as one in the interface,
 * and nothing here infers anything about a person beyond how they like to
 * travel.
 *
 * The maths is deliberately simple and deterministic: an axis is the weighted
 * average of the affinities of every dimension mapped to it, rescaled to
 * 0-100. An unanswered axis sits at the neutral 50 rather than at zero.
 *
 * SHRINKAGE — why an axis backed by one answer is not taken at face value.
 * Early in onboarding a traveller may have answered only one question that
 * touches an axis. Reporting that as a 100 is overconfident and produces
 * absurd profiles ("Culture: 100" because they once said yes to guided
 * tours). So we blend every axis toward the neutral 50 in proportion to how
 * little evidence backs it, by adding PRIOR_WEIGHT units of imaginary neutral
 * evidence. One strong answer lands near 70; six consistent answers land near
 * 90. The more someone tells us, the more extreme their profile is allowed
 * to be — which is also the honest thing to show them.
 */

/** Units of weight of imaginary neutral evidence added to every axis. */
export const PRIOR_WEIGHT = 2.2
const NEUTRAL = 0.5

export interface RadarInput {
  dimensionKey: string
  radarAxis: string | null
  kind: 'RATING' | 'SPECTRUM'
  engineWeight: number
  rating?: number | null
  spectrum?: number | null
}

export type RadarValues = Record<RadarAxis, number>

export function computeRadar(inputs: RadarInput[]): RadarValues {
  const totals = new Map<string, { sum: number; weight: number }>()

  for (const input of inputs) {
    if (!input.radarAxis) continue
    const weight = input.engineWeight || 1

    let unit: number | null = null
    if (input.kind === 'RATING' && input.rating != null) {
      // -1..1 → 0..1
      unit = (ratingToAffinity(input.rating) + 1) / 2
    } else if (input.kind === 'SPECTRUM' && input.spectrum != null) {
      unit = spectrumToUnit(input.spectrum)
    }
    if (unit === null) continue

    const entry = totals.get(input.radarAxis) ?? { sum: 0, weight: 0 }
    entry.sum += unit * weight
    entry.weight += weight
    totals.set(input.radarAxis, entry)
  }

  const out = {} as RadarValues
  for (const axis of RADAR_AXES) {
    const entry = totals.get(axis.key)
    if (!entry || entry.weight <= 0) {
      out[axis.key] = 50
      continue
    }
    // Weighted average, with neutral prior evidence folded in.
    const shrunk = (entry.sum + NEUTRAL * PRIOR_WEIGHT) / (entry.weight + PRIOR_WEIGHT)
    out[axis.key] = Math.round(clamp01(shrunk) * 100)
  }
  return out
}

/** How much real evidence backs each axis. Used to caption a sparse profile. */
export function radarEvidence(inputs: RadarInput[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const input of inputs) {
    if (!input.radarAxis) continue
    const answered =
      (input.kind === 'RATING' && input.rating != null) ||
      (input.kind === 'SPECTRUM' && input.spectrum != null)
    if (!answered) continue
    counts[input.radarAxis] = (counts[input.radarAxis] ?? 0) + 1
  }
  return counts
}

/** The axes this traveller scores highest on — used for copy and for sorting. */
export function topAxes(radar: RadarValues, count = 3): { key: RadarAxis; label: string; value: number }[] {
  return RADAR_AXES.map((a) => ({ key: a.key, label: a.label, value: radar[a.key] ?? 50 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
}

export function describeBudgetBand(budgetPreferredCents: number | null | undefined): string | null {
  if (!budgetPreferredCents) return null
  const dollars = budgetPreferredCents / 100
  if (dollars < 1200) return 'under $1,200'
  if (dollars < 2000) return '$1,200 to $2,000'
  if (dollars < 3000) return '$2,000 to $3,000'
  if (dollars < 5000) return '$3,000 to $5,000'
  return 'over $5,000'
}

export function describeTripLengthBand(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) {
    if (max <= 3) return 'a long weekend'
    if (max <= 7) return 'a week'
    if (max <= 14) return 'one to two weeks'
    return 'two weeks or more'
  }
  const value = (min ?? max)!
  if (value <= 3) return 'a long weekend'
  if (value <= 7) return 'a week'
  if (value <= 14) return 'one to two weeks'
  return 'two weeks or more'
}
