import { describe, expect, it } from 'vitest'
import { findDisagreements, rankDealsForGroup, scoreDealForGroup, type GroupMember } from './groupScore'
import { airportCoordMap, dimensionMap, makeDeal, makeUser } from '@/tests/factories'

const opts = { dimensions: dimensionMap, airportCoords: airportCoordMap }

/**
 * The specification's worked example:
 *   5 travellers, 4 love hiking, 1 hates hiking.
 *   The application should SURFACE the disagreement, not average it away.
 */
const hikingGroup: GroupMember[] = [
  { user: makeUser({ userId: 'u1', prefs: { hiking: 5, food: 4 } }), displayName: 'Cameron' },
  { user: makeUser({ userId: 'u2', prefs: { hiking: 5, food: 4 } }), displayName: 'Sarah' },
  { user: makeUser({ userId: 'u3', prefs: { hiking: 5, food: 5 } }), displayName: 'Priya' },
  { user: makeUser({ userId: 'u4', prefs: { hiking: 4, food: 4 } }), displayName: 'Marc' },
  { user: makeUser({ userId: 'u5', prefs: { hiking: 1, food: 5 } }), displayName: 'Jordan' },
]

// Confidence 0.9 = the provider stated it, which is what a callout requires.
const hikingTrip = makeDeal({ attrs: { hiking: [0.95, 0.9], food: [0.7, 0.9] } })

describe('group recommendations do not hide disagreement in an average', () => {
  it('identifies the one person who will not enjoy it, by name', () => {
    const r = scoreDealForGroup(hikingGroup, hikingTrip, opts)
    expect(r.dealbreakers.length).toBeGreaterThan(0)
    const hiking = r.dealbreakers.find((d) => d.dimensionKey === 'hiking')!
    expect(hiking).toBeDefined()
    expect(hiking.dislikes).toEqual(['Jordan'])
    expect(hiking.loves).toEqual(expect.arrayContaining(['Cameron', 'Sarah', 'Priya']))
    expect(hiking.note).toMatch(/Jordan/)
    expect(hiking.note).toMatch(/built around it/i)
  })

  it('reports the least-happy member, not just the average', () => {
    const r = scoreDealForGroup(hikingGroup, hikingTrip, opts)
    expect(r.minimumScore).toBeLessThan(r.averageScore)
    const jordan = r.members.find((m) => m.displayName === 'Jordan')!
    expect(jordan.score).toBe(r.minimumScore)
  })

  it('reports every member individually so nobody is invisible', () => {
    const r = scoreDealForGroup(hikingGroup, hikingTrip, opts)
    expect(r.members).toHaveLength(5)
    expect(r.members.map((m) => m.displayName).sort()).toEqual(
      ['Cameron', 'Jordan', 'Marc', 'Priya', 'Sarah'],
    )
  })

  it('finds no disagreement when everyone actually agrees', () => {
    const happy = hikingGroup.slice(0, 4)
    const r = scoreDealForGroup(happy, hikingTrip, opts)
    expect(r.dealbreakers).toHaveLength(0)
    expect(r.minimumScore).toBeGreaterThan(60)
  })

  it('ignores disagreements that are irrelevant to the trip in question', () => {
    // The group splits on nightlife, but this trip has no nightlife signal.
    const group: GroupMember[] = [
      { user: makeUser({ userId: 'a', prefs: { nightlife: 5, hiking: 4 } }), displayName: 'A' },
      { user: makeUser({ userId: 'b', prefs: { nightlife: 1, hiking: 4 } }), displayName: 'B' },
    ]
    const noNightlifeInfo = makeDeal({ attrs: { hiking: [0.8, 0.9] } })
    const disagreements = findDisagreements(group, noNightlifeInfo, dimensionMap)
    expect(disagreements.find((d) => d.dimensionKey === 'nightlife')).toBeUndefined()
  })

  it('catches the opposite case: the trip LACKS something a member needs', () => {
    const group: GroupMember[] = [
      { user: makeUser({ userId: 'a', prefs: { nightlife: 5 } }), displayName: 'Alex' },
      { user: makeUser({ userId: 'b', prefs: { nightlife: 1 } }), displayName: 'Bea' },
      { user: makeUser({ userId: 'c', prefs: { nightlife: 1 } }), displayName: 'Cris' },
    ]
    const quiet = makeDeal({ attrs: { nightlife: [0.05, 0.9] } })
    const d = findDisagreements(group, quiet, dimensionMap).find((x) => x.dimensionKey === 'nightlife')!
    expect(d).toBeDefined()
    expect(d.note).toMatch(/Alex/)
    expect(d.note).toMatch(/very little/i)
  })
})

describe('we never name a person as unhappy on the back of our own guess', () => {
  it('ignores a disagreement backed only by a low-confidence inferred attribute', () => {
    // 0.45 confidence is what a destination-trait rule produces. A provider
    // never said this trip was about hiking, so we must not tell the group
    // that Jordan will hate it.
    const inferred = makeDeal({ attrs: { hiking: [0.95, 0.45] } })
    expect(findDisagreements(hikingGroup, inferred, dimensionMap)).toHaveLength(0)
  })

  it('does report it once the provider states it', () => {
    const stated = makeDeal({ attrs: { hiking: [0.95, 0.9] } })
    expect(findDisagreements(hikingGroup, stated, dimensionMap).length).toBeGreaterThan(0)
  })

  it('caps the list so it stays readable', () => {
    const busyTrip = makeDeal({
      attrs: {
        hiking: [0.95, 0.9], nightlife: [0.05, 0.9], partying: [0.05, 0.9],
        luxury: [0.95, 0.9], food: [0.95, 0.9], 'luxury-hotels': [0.95, 0.9],
        museums: [0.05, 0.9], adventure: [0.95, 0.9],
      },
    })
    const mixedGroup = hikingGroup.map((m, i) => ({
      ...m,
      user: makeUser({
        userId: `mixed-${i}`,
        prefs: i % 2 === 0
          ? { hiking: 5, nightlife: 1, partying: 1, luxury: 1, food: 5, 'luxury-hotels': 1, museums: 5, adventure: 5 }
          : { hiking: 1, nightlife: 5, partying: 5, luxury: 5, food: 1, 'luxury-hotels': 5, museums: 1, adventure: 1 },
      }),
    }))
    expect(findDisagreements(mixedGroup, busyTrip, dimensionMap).length).toBeLessThanOrEqual(5)
  })

  it('puts dealbreakers at the top of the list', () => {
    const result = scoreDealForGroup(hikingGroup, hikingTrip, opts)
    const severities = result.disagreements.map((d) => d.severity)
    const firstNotable = severities.indexOf('notable')
    const lastDealbreaker = severities.lastIndexOf('dealbreaker')
    if (firstNotable !== -1 && lastDealbreaker !== -1) {
      expect(lastDealbreaker).toBeLessThan(firstNotable)
    }
  })
})

describe('ranking trips for a group', () => {
  it('prefers a trip everyone can actually go on', () => {
    const group: GroupMember[] = [
      { user: makeUser({ userId: 'a', prefs: { hiking: 5 }, constraints: { budgetMax: 150_000, budgetMaxIsHard: true } }), displayName: 'A' },
      { user: makeUser({ userId: 'b', prefs: { hiking: 5 }, constraints: { budgetMax: 500_000, budgetMaxIsHard: true } }), displayName: 'B' },
    ]
    const affordable = makeDeal({ dealId: 'affordable', price: 140_000, attrs: { hiking: 0.8 } })
    const expensive = makeDeal({ dealId: 'expensive', price: 400_000, attrs: { hiking: 0.95 } })

    const ranked = rankDealsForGroup(group, [expensive, affordable], opts)
    expect(ranked[0]!.dealId).toBe('affordable')
    expect(ranked[0]!.everyoneCanGo).toBe(true)
    expect(ranked[1]!.everyoneCanGo).toBe(false)
  })

  it('prefers fewer dealbreakers over a higher average', () => {
    const ranked = rankDealsForGroup(
      hikingGroup,
      [
        makeDeal({ dealId: 'extreme-hiking', attrs: { hiking: [1.0, 0.9], food: [0.9, 0.9] } }),
        makeDeal({ dealId: 'balanced', attrs: { hiking: [0.5, 0.9], food: [0.9, 0.9] } }),
      ],
      opts,
    )
    expect(ranked[0]!.dealId).toBe('balanced')
  })

  it('computes a median as well as an average', () => {
    const r = scoreDealForGroup(hikingGroup, hikingTrip, opts)
    expect(r.medianScore).toBeGreaterThanOrEqual(r.minimumScore)
    expect(Number.isFinite(r.medianScore)).toBe(true)
  })

  it('handles a group of one', () => {
    const r = scoreDealForGroup([hikingGroup[0]!], hikingTrip, opts)
    expect(r.minimumScore).toBe(r.averageScore)
    expect(r.members).toHaveLength(1)
  })

  it('handles an empty group without crashing', () => {
    const r = scoreDealForGroup([], hikingTrip, opts)
    expect(r.averageScore).toBe(0)
    expect(r.everyoneCanGo).toBe(true)
  })
})

describe('two-person companion compatibility on a specific trip', () => {
  it('shows where a couple aligns and where they do not', () => {
    const pair: GroupMember[] = [
      { user: makeUser({ userId: 'cam', prefs: { food: 5, 'luxury-hotels': 4, nightlife: 2, hiking: 4 } }), displayName: 'Cameron' },
      { user: makeUser({ userId: 'sar', prefs: { food: 5, 'luxury-hotels': 4, nightlife: 5, hiking: 4 } }), displayName: 'Sarah' },
    ]
    const partyTrip = makeDeal({ attrs: { food: [0.9, 0.9], 'luxury-hotels': [0.8, 0.9], nightlife: [0.9, 0.9], hiking: [0.6, 0.9] } })
    const r = scoreDealForGroup(pair, partyTrip, opts)
    expect(r.members).toHaveLength(2)
    expect(r.minimumScore).toBeLessThanOrEqual(r.averageScore)
  })
})
