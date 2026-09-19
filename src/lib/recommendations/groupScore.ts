import { ratingToAffinity } from './affinity'
import { scoreDeal, type ScoreDealOptions } from './dealScore'
import type {
  DimensionMeta,
  GroupDealResult,
  GroupDisagreement,
  GroupMemberScore,
  ScoreableDeal,
  ScoreableUser,
} from './types'

/**
 * GROUP RECOMMENDATIONS
 *
 * The naive approach is to average everybody's preferences. That is exactly
 * wrong: four people who love hiking and one who hates it average out to
 * "mildly likes hiking", and the group books a hiking trip that ruins one
 * person's holiday.
 *
 * So we do the opposite — we lead with the LEAST happy member, and we surface
 * disagreements explicitly instead of smoothing them away.
 */

export interface GroupMember {
  user: ScoreableUser
  displayName: string
}

export interface GroupScoreOptions extends ScoreDealOptions {
  dimensions: Map<string, DimensionMeta>
}

export function scoreDealForGroup(
  members: GroupMember[],
  deal: ScoreableDeal,
  options: GroupScoreOptions,
): GroupDealResult {
  const memberScores: GroupMemberScore[] = members.map((m) => {
    const result = scoreDeal(m.user, deal, options)
    return {
      userId: m.user.userId,
      displayName: m.displayName,
      score: result.score,
      passed: result.passed,
      failures: result.failures,
    }
  })

  const scores = memberScores.map((m) => m.score).sort((x, y) => x - y)
  const averageScore = scores.length
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0
  const minimumScore = scores[0] ?? 0
  const medianScore = scores.length
    ? scores.length % 2 === 1
      ? scores[(scores.length - 1) / 2]!
      : Math.round(((scores[scores.length / 2 - 1] ?? 0) + (scores[scores.length / 2] ?? 0)) / 2)
    : 0

  const disagreements = findDisagreements(members, deal, options.dimensions)

  return {
    dealId: deal.dealId,
    averageScore,
    minimumScore,
    medianScore,
    members: memberScores,
    dealbreakers: disagreements.filter((d) => d.severity === 'dealbreaker'),
    disagreements,
    everyoneCanGo: memberScores.every((m) => m.passed),
  }
}

/**
 * Minimum confidence before we will tell a group that one of them will
 * dislike a trip.
 *
 * Attributes stated by the provider carry ~0.9; attributes we inferred
 * ourselves from the destination carry ~0.45. Naming a person as unhappy on
 * the back of our own guess is exactly the kind of thing that erodes trust in
 * a recommendation, so inferred attributes never produce a callout.
 */
export const DISAGREEMENT_MIN_CONFIDENCE = 0.6

/** How many disagreements are worth showing before the list becomes noise. */
export const MAX_DISAGREEMENTS = 5

/**
 * Finds dimensions where the group genuinely splits, but only where the deal
 * actually exhibits that dimension — a disagreement about nightlife does not
 * matter on a trip with no nightlife.
 */
export function findDisagreements(
  members: GroupMember[],
  deal: ScoreableDeal,
  dimensions: Map<string, DimensionMeta>,
): GroupDisagreement[] {
  const attrById = new Map(deal.attributes.map((a) => [a.dimensionId, a]))
  const out: GroupDisagreement[] = []

  for (const [dimensionId, dim] of dimensions) {
    if (dim.kind !== 'RATING') continue
    const attr = attrById.get(dimensionId)
    // Only relevant if the trip is meaningfully about this, in either
    // direction, AND we are confident enough to say so out loud.
    if (!attr || attr.confidence < DISAGREEMENT_MIN_CONFIDENCE) continue
    const dealLeans = attr.intensity >= 0.65 || attr.intensity <= 0.2
    if (!dealLeans) continue

    const loves: string[] = []
    const dislikes: string[] = []
    for (const m of members) {
      const pref = m.user.preferences.find((p) => p.dimensionId === dimensionId)
      if (!pref) continue
      const a = ratingToAffinity(pref.rating)
      if (a >= 0.5) loves.push(m.displayName)
      else if (a <= -0.5) dislikes.push(m.displayName)
    }
    if (loves.length === 0 || dislikes.length === 0) continue

    // It is a dealbreaker when the trip strongly delivers something someone
    // actively avoids (or strongly lacks something someone needs).
    const tripHasIt = attr.intensity >= 0.65
    const harmed = tripHasIt ? dislikes : loves
    const severity: GroupDisagreement['severity'] =
      harmed.length <= Math.max(1, Math.floor(members.length / 3)) && harmed.length > 0
        ? 'dealbreaker'
        : 'notable'

    out.push({
      dimensionKey: dim.key,
      label: dim.label,
      loves,
      dislikes,
      severity,
      note: tripHasIt
        ? `${formatNames(dislikes)} ${dislikes.length === 1 ? 'would rather avoid' : 'would rather avoid'} ${dim.label.toLowerCase()}, and this trip is built around it.`
        : `${formatNames(loves)} ${loves.length === 1 ? 'is' : 'are'} looking for ${dim.label.toLowerCase()}, and this trip has very little.`,
    })
  }

  return out
    .sort((a, b) => {
      // Dealbreakers first, then whichever affects more people.
      const bySeverity =
        (a.severity === 'dealbreaker' ? 0 : 1) - (b.severity === 'dealbreaker' ? 0 : 1)
      if (bySeverity !== 0) return bySeverity
      return b.loves.length + b.dislikes.length - (a.loves.length + a.dislikes.length)
    })
    .slice(0, MAX_DISAGREEMENTS)
}

function formatNames(names: string[]): string {
  if (names.length === 0) return 'Nobody'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Ranks a list of deals for a group: least-happy-member first, then average. */
export function rankDealsForGroup(
  members: GroupMember[],
  deals: ScoreableDeal[],
  options: GroupScoreOptions,
): GroupDealResult[] {
  return deals
    .map((deal) => scoreDealForGroup(members, deal, options))
    .sort((a, b) => {
      if (a.everyoneCanGo !== b.everyoneCanGo) return a.everyoneCanGo ? -1 : 1
      const aDeal = a.dealbreakers.length
      const bDeal = b.dealbreakers.length
      if (aDeal !== bDeal) return aDeal - bDeal
      if (b.minimumScore !== a.minimumScore) return b.minimumScore - a.minimumScore
      return b.averageScore - a.averageScore
    })
}
