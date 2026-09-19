import type { DealMatchResult, MatchMismatch, MatchReason, TravelerMatchResult } from './types'

/**
 * EXPLANATIONS
 *
 * A bare "94% match" is not a recommendation, it is a claim. Everything here
 * turns the *stored* component scores into plain English, so the explanation
 * is always reproducible from the same data that produced the number.
 * Nothing here invents a reason.
 */

export interface Explanation {
  headline: string
  loveReasons: string[]
  fitReasons: string[]
  mismatches: string[]
  confidenceNote: string | null
}

export function explainDealMatch(result: DealMatchResult): Explanation {
  const love = result.reasons.filter((r) => r.kind === 'love')
  const fit = result.reasons.filter((r) => r.kind === 'fit')

  return {
    headline: matchHeadline(result.score),
    loveReasons: love.slice(0, 5).map((r) => r.label),
    fitReasons: fit.slice(0, 5).map((r) => r.label),
    mismatches: result.mismatches.map((m) => m.label),
    confidenceNote:
      result.confidence < 0.45
        ? 'This provider gives us limited detail, so this match is an estimate.'
        : null,
  }
}

export function matchHeadline(score: number): string {
  if (score >= 90) return 'An outstanding match for how you travel'
  if (score >= 80) return 'A strong match for how you travel'
  if (score >= 70) return 'A good match for how you travel'
  if (score >= 55) return 'A reasonable match with some trade-offs'
  if (score >= 40) return 'A partial match'
  return 'Not a typical fit for you'
}

export function matchBand(score: number): 'excellent' | 'strong' | 'good' | 'fair' | 'weak' {
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'strong'
  if (score >= 70) return 'good'
  if (score >= 55) return 'fair'
  return 'weak'
}

export function explainTravelerMatch(result: TravelerMatchResult): {
  headline: string
  bothLove: string[]
  similar: string[]
  differences: string[]
} {
  return {
    headline: travelerHeadline(result.score),
    bothLove: result.shared.filter((s) => s.kind === 'love').map((s) => s.label).slice(0, 5),
    similar: result.shared.filter((s) => s.kind === 'fit').map((s) => s.label).slice(0, 4),
    differences: result.conflicts.map((c) => c.label).slice(0, 4),
  }
}

export function travelerHeadline(score: number): string {
  if (score >= 88) return 'You would probably travel really well together'
  if (score >= 75) return 'A strong travel match'
  if (score >= 62) return 'A good travel match'
  if (score >= 45) return 'Some common ground'
  return 'Quite different travel styles'
}

/** Short, card-sized summary. Used on deal cards in the feed. */
export function summariseReasons(reasons: MatchReason[], limit = 3): string {
  const labels = reasons.slice(0, limit).map((r) => r.label.toLowerCase())
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]!
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function summariseMismatches(mismatches: MatchMismatch[], limit = 2): string {
  const labels = mismatches.slice(0, limit).map((m) => m.label.toLowerCase())
  if (labels.length === 0) return ''
  return labels.join(', ')
}
