import { describe, expect, it } from 'vitest'
import { scoreDeal } from './dealScore'
import { explainDealMatch, matchBand } from './explain'
import { airportCoordMap, dimensionMap, makeDeal, makeUser } from '@/tests/factories'

const opts = { dimensions: dimensionMap, airportCoords: airportCoordMap }

describe('scoreDeal — the worked example from the specification', () => {
  // User:  Adventure .9  Luxury .3  Food 1  Wine .8  Nightlife .4  Hiking 1  Social .7
  // Deal:  Adventure .8  Luxury .2  Food .9 Wine .7  Nightlife .1  Hiking 1  Social .6
  const user = makeUser({
    prefs: {
      adventure: 5, luxury: 2, food: 5, wine: 4,
      nightlife: 3, hiking: 5, 'meeting-people': 4,
    },
  })
  const deal = makeDeal({
    attrs: {
      adventure: 0.8, luxury: 0.2, food: 0.9, wine: 0.7,
      nightlife: 0.1, hiking: 1.0, 'meeting-people': 0.6,
    },
  })

  it('produces a high score for a well-aligned trip', () => {
    const r = scoreDeal(user, deal, opts)
    expect(r.passed).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(matchBand(r.score)).toMatch(/excellent|strong/)
  })

  it('returns a score that is always an integer percentage in range', () => {
    const r = scoreDeal(user, deal, opts)
    expect(Number.isInteger(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('is deterministic — the same inputs always give the same score', () => {
    const a = scoreDeal(user, deal, opts)
    const b = scoreDeal(user, deal, opts)
    expect(a.score).toBe(b.score)
    expect(a.reasons).toEqual(b.reasons)
  })
})

describe('negative preferences produce genuine aversion', () => {
  it('ranks a party trip BELOW a quiet trip for someone who rated partying 1', () => {
    const user = makeUser({ prefs: { partying: 1, hiking: 5 } })
    const partyTrip = makeDeal({ dealId: 'party', attrs: { partying: 0.95, hiking: 0.9 } })
    const quietTrip = makeDeal({ dealId: 'quiet', attrs: { partying: 0.05, hiking: 0.9 } })

    const party = scoreDeal(user, partyTrip, opts)
    const quiet = scoreDeal(user, quietTrip, opts)

    expect(quiet.score).toBeGreaterThan(party.score)
    expect(quiet.score - party.score).toBeGreaterThan(10)
  })

  it('does not let a luxury trip rank highly just because everything else fits', () => {
    // Specification: "if Luxury = 1 then extremely luxury-oriented products
    // should not automatically rank highly merely because everything else fits."
    const user = makeUser({
      prefs: { luxury: 1, food: 5, wine: 5, hiking: 5, adventure: 5 },
    })
    const luxuryTrip = makeDeal({
      dealId: 'lux',
      attrs: { luxury: 1.0, food: 0.95, wine: 0.95, hiking: 0.9, adventure: 0.9 },
    })
    const modestTrip = makeDeal({
      dealId: 'modest',
      attrs: { luxury: 0.05, food: 0.95, wine: 0.95, hiking: 0.9, adventure: 0.9 },
    })

    const lux = scoreDeal(user, luxuryTrip, opts)
    const modest = scoreDeal(user, modestTrip, opts)

    expect(modest.score).toBeGreaterThan(lux.score)
    expect(lux.mismatches.some((m) => /luxury/i.test(m.label))).toBe(true)
  })

  it('rewards the ABSENCE of a disliked feature as a positive reason', () => {
    const user = makeUser({ prefs: { partying: 1 } })
    const quiet = makeDeal({ attrs: { partying: 0.02 } })
    const r = scoreDeal(user, quiet, opts)
    expect(r.reasons.some((x) => /very little partying/i.test(x.label))).toBe(true)
  })
})

describe('hard constraints remove options rather than ranking them down', () => {
  it('fails a deal that is over a hard maximum budget', () => {
    const user = makeUser({ constraints: { budgetMax: 150_000, budgetMaxIsHard: true } })
    const r = scoreDeal(user, makeDeal({ price: 300_000 }), opts)
    expect(r.passed).toBe(false)
    expect(r.failures.map((f) => f.key)).toContain('budget')
    expect(r.failures[0]!.suggestion).toMatch(/budget/i)
  })

  it('does NOT fail when the budget is a preference rather than a constraint', () => {
    const user = makeUser({ constraints: { budgetMax: 150_000, budgetMaxIsHard: false } })
    const r = scoreDeal(user, makeDeal({ price: 300_000 }), opts)
    expect(r.passed).toBe(true)
    // …but it should still rank poorly on budget.
    expect(r.components.find((c) => c.key === 'budget')!.score).toBeLessThan(0.4)
  })

  it('fails a deal from the wrong airport when airports are hard', () => {
    const user = makeUser({
      airports: [{ iata: 'YYZ', rank: 1 }],
      constraints: { airportsAreHard: true, includeNearbyAirports: false },
    })
    const r = scoreDeal(user, makeDeal({ iata: 'YVR' }), opts)
    expect(r.passed).toBe(false)
    expect(r.failures.map((f) => f.key)).toContain('airport')
  })

  it('accepts a nearby airport when the traveller allows it', () => {
    const user = makeUser({
      airports: [{ iata: 'YYZ', rank: 1 }],
      constraints: { airportsAreHard: true, includeNearbyAirports: true, nearbyRadiusKm: 200 },
    })
    // Toronto Island is ~21 km from Pearson.
    const r = scoreDeal(user, makeDeal({ iata: 'YTZ' }), opts)
    expect(r.passed).toBe(true)
  })

  it('never excludes a deal for missing data it cannot be blamed for', () => {
    const user = makeUser({ constraints: { airportsAreHard: true } })
    const r = scoreDeal(user, makeDeal({ departureAirportIata: null }), opts)
    expect(r.passed).toBe(true)
  })

  it('always excludes expired and sold-out inventory', () => {
    const user = makeUser()
    expect(scoreDeal(user, makeDeal({ status: 'EXPIRED' }), opts).passed).toBe(false)
    expect(scoreDeal(user, makeDeal({ status: 'SOLD_OUT' }), opts).passed).toBe(false)
    expect(
      scoreDeal(user, makeDeal({ expiresAt: new Date(Date.now() - 1000) }), opts).passed,
    ).toBe(false)
  })

  it('reports every reason a deal was filtered, not just the first', () => {
    const user = makeUser({
      constraints: {
        budgetMax: 100_000, budgetMaxIsHard: true,
        airportsAreHard: true, includeNearbyAirports: false,
        durationIsHard: true, durationMin: 3, durationMax: 5,
      },
    })
    const r = scoreDeal(user, makeDeal({ price: 500_000, iata: 'YVR', nights: 14 }), opts)
    expect(r.failures.length).toBeGreaterThanOrEqual(3)
  })
})

describe('missing data degrades gracefully instead of lying', () => {
  it('does not punish a deal for attributes the provider never described', () => {
    const user = makeUser({ prefs: { hiking: 5, food: 5, wine: 5 } })
    const described = makeDeal({ dealId: 'a', attrs: { hiking: 0.9, food: 0.9, wine: 0.9 } })
    const silent = makeDeal({ dealId: 'b', attrs: {} })

    const withData = scoreDeal(user, described, opts)
    const withoutData = scoreDeal(user, silent, opts)

    expect(withData.score).toBeGreaterThan(withoutData.score)
    // …but the silent deal is not driven to zero either.
    expect(withoutData.score).toBeGreaterThan(30)
  })

  it('reports lower confidence when little is known', () => {
    const user = makeUser({ prefs: { hiking: 5, food: 5 } })
    const rich = scoreDeal(user, makeDeal({ attrs: { hiking: 0.9, food: 0.8 } }), opts)
    const sparse = scoreDeal(
      user,
      makeDeal({ attrs: {}, salePriceCents: null, departureAirportIata: null, durationNights: null, departureDate: null }),
      opts,
    )
    expect(rich.confidence).toBeGreaterThan(sparse.confidence)
    expect(sparse.confidence).toBeLessThan(0.4)
  })

  it('flags a low-confidence match in the explanation', () => {
    const user = makeUser({ prefs: { hiking: 5 } })
    const sparse = scoreDeal(
      user,
      makeDeal({ attrs: {}, salePriceCents: null, departureAirportIata: null, durationNights: null, departureDate: null }),
      opts,
    )
    expect(explainDealMatch(sparse).confidenceNote).toMatch(/estimate/i)
  })

  it('respects the confidence attached to an attribute', () => {
    const user = makeUser({ prefs: { hiking: 5 } })
    const sure = scoreDeal(user, makeDeal({ attrs: { hiking: [1.0, 1.0] } }), opts)
    const unsure = scoreDeal(user, makeDeal({ attrs: { hiking: [1.0, 0.2] } }), opts)
    expect(sure.score).toBeGreaterThan(unsure.score)
  })
})

describe('explanations are derived from the score, never invented', () => {
  const user = makeUser({
    prefs: { hiking: 5, food: 5, 'meeting-people': 4, nightlife: 1, luxury: 2 },
    constraints: { budgetMax: 250_000, budgetPreferred: 200_000, durationPreferred: 7, durationMin: 5, durationMax: 10 },
    airports: [{ iata: 'YYZ', rank: 1 }],
  })
  const deal = makeDeal({
    attrs: { hiking: 0.95, food: 0.9, 'meeting-people': 0.8, nightlife: 0.05, luxury: 0.2 },
    price: 180_000, nights: 7, iata: 'YYZ',
  })

  it('names the specific things the traveller will like', () => {
    const r = scoreDeal(user, deal, opts)
    const ex = explainDealMatch(r)
    expect(ex.loveReasons.join(' ')).toMatch(/hiking/i)
    expect(ex.loveReasons.join(' ')).toMatch(/food/i)
  })

  it('names the practical fits separately from the emotional ones', () => {
    const r = scoreDeal(user, deal, opts)
    const ex = explainDealMatch(r)
    expect(ex.fitReasons.join(' ')).toMatch(/budget|YYZ|nights|dates/i)
  })

  it('every reason corresponds to a real scored dimension', () => {
    const r = scoreDeal(user, deal, opts)
    for (const reason of r.reasons) {
      expect(reason.strength).toBeGreaterThan(0)
      expect(reason.label.length).toBeGreaterThan(0)
    }
  })

  it('surfaces potential mismatches honestly', () => {
    const pickyUser = makeUser({
      prefs: { nightlife: 5, hiking: 1 },
      constraints: { budgetMax: 400_000, budgetPreferred: 90_000, budgetMaxIsHard: false },
    })
    const r = scoreDeal(pickyUser, makeDeal({ attrs: { nightlife: 0.05, hiking: 0.95 }, price: 350_000 }), opts)
    expect(r.mismatches.length).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(50)
  })

  it('writes a headline that matches the band', () => {
    const r = scoreDeal(user, deal, opts)
    expect(explainDealMatch(r).headline.length).toBeGreaterThan(10)
  })
})

describe('practical fit components', () => {
  it('prefers a first-choice airport over a second-choice one', () => {
    const user = makeUser({ airports: [{ iata: 'YYZ', rank: 1 }, { iata: 'YUL', rank: 2 }] })
    const first = scoreDeal(user, makeDeal({ iata: 'YYZ' }), opts)
    const second = scoreDeal(user, makeDeal({ iata: 'YUL' }), opts)
    expect(first.score).toBeGreaterThan(second.score)
  })

  it('scores a trip at the preferred length above one at the edge of the range', () => {
    const user = makeUser({ constraints: { durationMin: 3, durationMax: 14, durationPreferred: 7 } })
    const ideal = scoreDeal(user, makeDeal({ nights: 7 }), opts)
    const edge = scoreDeal(user, makeDeal({ nights: 14 }), opts)
    expect(ideal.score).toBeGreaterThan(edge.score)
  })

  it('rewards being comfortably inside budget over being at the limit', () => {
    const user = makeUser({ constraints: { budgetPreferred: 200_000, budgetMax: 260_000, budgetMaxIsHard: false } })
    const cheap = scoreDeal(user, makeDeal({ price: 150_000 }), opts)
    const dear = scoreDeal(user, makeDeal({ price: 255_000 }), opts)
    expect(cheap.score).toBeGreaterThan(dear.score)
  })

  it('treats a suspiciously cheap trip as good but not perfect', () => {
    const user = makeUser({ constraints: { budgetMin: 100_000, budgetPreferred: 200_000, budgetMax: 260_000 } })
    const r = scoreDeal(user, makeDeal({ price: 20_000 }), opts)
    const budget = r.components.find((c) => c.key === 'budget')!
    expect(budget.score).toBeLessThan(1)
    expect(budget.score).toBeGreaterThan(0.6)
  })

  it('gives a wishlist destination a modest bonus', () => {
    const plain = makeUser({ prefs: { hiking: 4 } })
    const wishing = makeUser({ prefs: { hiking: 4 }, wishlistCountries: ['CR'] })
    const deal = makeDeal({ attrs: { hiking: 0.8 }, country: 'CR' })
    expect(scoreDeal(wishing, deal, opts).score).toBeGreaterThan(scoreDeal(plain, deal, opts).score)
  })

  it('penalises a departure date in the past', () => {
    const user = makeUser()
    const r = scoreDeal(user, makeDeal({ departureInDays: -10 }), opts)
    expect(r.components.find((c) => c.key === 'dates')!.score).toBe(0)
  })
})

describe('score stability', () => {
  it('never returns NaN for an empty profile and an empty deal', () => {
    const user = makeUser({ prefs: {}, constraints: { budgetMax: null, budgetPreferred: null, durationMin: null, durationMax: null, durationPreferred: null } })
    const deal = makeDeal({ attrs: {}, salePriceCents: null, durationNights: null, departureDate: null, departureAirportIata: null })
    const r = scoreDeal(user, deal, opts)
    expect(Number.isFinite(r.score)).toBe(true)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('records the engine version so cached scores can be invalidated', () => {
    expect(scoreDeal(makeUser(), makeDeal(), opts).engineVersion).toBe('1.0.0')
  })
})
