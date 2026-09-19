import { describe, expect, it } from 'vitest'
import { scoreTravelers } from './travelerScore'
import { explainTravelerMatch } from './explain'
import { dimensionMap, makeUser } from '@/tests/factories'

const opts = { dimensions: dimensionMap }

describe('traveller compatibility', () => {
  it('scores two near-identical travellers very highly', () => {
    const prefs = { hiking: 5, food: 5, adventure: 5, 'meeting-people': 4, luxury: 2 }
    const a = makeUser({ userId: 'a', prefs, wishlistCountries: ['JP', 'CR'] })
    const b = makeUser({ userId: 'b', prefs, wishlistCountries: ['JP', 'CR'] })
    const r = scoreTravelers(a, b, opts)
    expect(r.score).toBeGreaterThan(85)
    expect(r.conflicts.length).toBe(0)
  })

  it('scores opposites poorly', () => {
    const a = makeUser({ userId: 'a', prefs: { hiking: 5, adventure: 5, luxury: 1, nightlife: 1, partying: 1 } })
    const b = makeUser({ userId: 'b', prefs: { hiking: 1, adventure: 1, luxury: 5, nightlife: 5, partying: 5 } })
    const r = scoreTravelers(a, b, opts)
    expect(r.score).toBeLessThan(40)
    expect(r.conflicts.length).toBeGreaterThan(2)
  })

  it('surfaces a genuine conflict rather than averaging it away', () => {
    // Otherwise perfectly matched, except one loves nightlife and one avoids it.
    const shared = { hiking: 5, food: 5, adventure: 4, museums: 4 }
    const a = makeUser({ userId: 'a', prefs: { ...shared, nightlife: 5 } })
    const b = makeUser({ userId: 'b', prefs: { ...shared, nightlife: 1 } })
    const r = scoreTravelers(a, b, opts)
    expect(r.conflicts.some((c) => /nightlife/i.test(c.label))).toBe(true)
    expect(r.shared.some((s) => /hiking/i.test(s.label))).toBe(true)
  })

  it('names what both people love', () => {
    const a = makeUser({ userId: 'a', prefs: { hiking: 5, food: 5, nightlife: 1 } })
    const b = makeUser({ userId: 'b', prefs: { hiking: 5, food: 4, nightlife: 2 } })
    const ex = explainTravelerMatch(scoreTravelers(a, b, opts))
    expect(ex.bothLove.join(' ')).toMatch(/hiking/i)
    expect(ex.bothLove.join(' ')).toMatch(/food/i)
    expect(ex.headline.length).toBeGreaterThan(5)
  })

  it('is symmetric — order of the two travellers does not change the score', () => {
    const a = makeUser({ userId: 'a', prefs: { hiking: 5, luxury: 2, food: 4 }, wishlistCountries: ['JP'] })
    const b = makeUser({ userId: 'b', prefs: { hiking: 4, luxury: 3, food: 5 }, wishlistCountries: ['JP', 'IT'] })
    expect(scoreTravelers(a, b, opts).score).toBe(scoreTravelers(b, a, opts).score)
  })

  it('lets a member say a dimension matters more for people matching', () => {
    const base = { hiking: 5, food: 3 }
    const a = makeUser({ userId: 'a', prefs: base })
    const b = makeUser({ userId: 'b', prefs: { hiking: 1, food: 3 } })

    const normal = scoreTravelers(a, b, opts)
    // Now mark hiking as extremely important for companion matching.
    const aStrict = makeUser({ userId: 'a', prefs: base })
    aStrict.preferences = aStrict.preferences.map((p) => ({ ...p, peopleWeight: 5 }))
    const strict = scoreTravelers(aStrict, b, opts)

    expect(strict.score).toBeLessThanOrEqual(normal.score)
  })

  it('counts budget compatibility', () => {
    const prefs = { hiking: 5, food: 4 }
    const a = makeUser({ userId: 'a', prefs, constraints: { budgetPreferred: 200_000, budgetMax: 250_000 } })
    const similar = makeUser({ userId: 'b', prefs, constraints: { budgetPreferred: 210_000, budgetMax: 260_000 } })
    const different = makeUser({ userId: 'c', prefs, constraints: { budgetPreferred: 800_000, budgetMax: 900_000 } })
    expect(scoreTravelers(a, similar, opts).score).toBeGreaterThan(scoreTravelers(a, different, opts).score)
  })

  it('rewards a shared wishlist', () => {
    const prefs = { hiking: 4 }
    const a = makeUser({ userId: 'a', prefs, wishlistCountries: ['JP', 'PT'] })
    const shared = makeUser({ userId: 'b', prefs, wishlistCountries: ['JP', 'PT'] })
    const unshared = makeUser({ userId: 'c', prefs, wishlistCountries: ['BR', 'ZA'] })
    expect(scoreTravelers(a, shared, opts).score).toBeGreaterThan(scoreTravelers(a, unshared, opts).score)
  })

  it('handles a traveller who has answered nothing without crashing', () => {
    const a = makeUser({ userId: 'a', prefs: { hiking: 5 } })
    const empty = makeUser({ userId: 'b', prefs: {} })
    const r = scoreTravelers(a, empty, opts)
    expect(Number.isFinite(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('compares two named travellers the way the product describes it', () => {
    // "Cameron + Sarah — travel compatibility 86%"
    const cameron = makeUser({
      userId: 'cameron',
      prefs: { food: 5, adventure: 5, 'luxury-hotels': 4, nightlife: 2, hiking: 4 },
      constraints: { budgetPreferred: 250_000, budgetMax: 300_000, durationMin: 6, durationMax: 12 },
    })
    const sarah = makeUser({
      userId: 'sarah',
      prefs: { food: 5, adventure: 4, 'luxury-hotels': 4, nightlife: 5, hiking: 4 },
      constraints: { budgetPreferred: 180_000, budgetMax: 220_000, durationMin: 5, durationMax: 10 },
    })
    const r = scoreTravelers(cameron, sarah, opts)
    const ex = explainTravelerMatch(r)
    expect(r.score).toBeGreaterThan(55)
    expect(ex.bothLove.join(' ')).toMatch(/food|adventure/i)
    expect(ex.differences.join(' ')).toMatch(/nightlife|budget/i)
  })
})

describe('describing a spectrum disagreement', () => {
  // A conflict labelled only "Pace" tells a traveller nothing they can act on.
  // Before agreeing to share a trip, they need to know WHICH WAY each of them
  // leans — and the wording must not depend on which of them is "a" and "b".
  it('names both ends of the spectrum, in the dimension’s own words', () => {
    const a = makeUser({ userId: 'a', spectrums: { pace: 0 } })
    const b = makeUser({ userId: 'b', spectrums: { pace: 100 } })

    const conflict = scoreTravelers(a, b, opts).conflicts.find((c) => c.key === 'pace')
    expect(conflict).toBeDefined()
    expect(conflict!.label).toMatch(/relaxed/i)
    expect(conflict!.label).toMatch(/packed itinerary/i)
  })

  it('describes the same disagreement whichever way round the pair is read', () => {
    const relaxed = makeUser({ userId: 'a', spectrums: { pace: 0 } })
    const packed = makeUser({ userId: 'b', spectrums: { pace: 100 } })

    const forward = scoreTravelers(relaxed, packed, opts).conflicts.find((c) => c.key === 'pace')
    const backward = scoreTravelers(packed, relaxed, opts).conflicts.find((c) => c.key === 'pace')
    expect(forward!.label).toBe(backward!.label)
  })

  it('falls back to the bare label when a dimension has no pole wording', () => {
    const dims = new Map(dimensionMap)
    const pace = { ...dims.get('s-pace')!, poleLowLabel: null, poleHighLabel: null }
    dims.set('s-pace', pace)

    const a = makeUser({ userId: 'a', spectrums: { pace: 0 } })
    const b = makeUser({ userId: 'b', spectrums: { pace: 100 } })

    const conflict = scoreTravelers(a, b, { dimensions: dims }).conflicts.find((c) => c.key === 'pace')
    expect(conflict!.label).toBe('Pace')
  })
})
