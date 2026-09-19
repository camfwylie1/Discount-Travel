import { describe, expect, it } from 'vitest'
import { computeRadar, describeBudgetBand, describeTripLengthBand, radarEvidence, topAxes } from './radar'

const input = (
  dimensionKey: string,
  radarAxis: string,
  rating: number,
  kind: 'RATING' | 'SPECTRUM' = 'RATING',
) => ({ dimensionKey, radarAxis, kind, engineWeight: 1, rating: kind === 'RATING' ? rating : null, spectrum: kind === 'SPECTRUM' ? rating : null })

describe('Travel DNA radar', () => {
  it('puts an unanswered axis at neutral, not zero', () => {
    const radar = computeRadar([])
    expect(radar.adventure).toBe(50)
    expect(radar.food).toBe(50)
    expect(Object.values(radar).every((v) => v === 50)).toBe(true)
  })

  it('keeps a neutral answer at the midpoint', () => {
    expect(computeRadar([input('hiking', 'outdoors', 3)]).outdoors).toBe(50)
  })

  it('moves an axis in the right direction', () => {
    expect(computeRadar([input('hiking', 'outdoors', 5)]).outdoors).toBeGreaterThan(50)
    expect(computeRadar([input('hiking', 'outdoors', 1)]).outdoors).toBeLessThan(50)
  })

  it('averages several dimensions on the same axis', () => {
    const radar = computeRadar([
      input('hiking', 'outdoors', 5),
      input('camping', 'outdoors', 1),
    ])
    expect(radar.outdoors).toBe(50)
  })

  // ── Shrinkage: the fix for overconfident axes early in onboarding ────────
  it('does NOT report an extreme score from a single answer', () => {
    // One "extremely important" answer must not produce a 100.
    const single = computeRadar([input('hiking', 'outdoors', 5)]).outdoors
    expect(single).toBeGreaterThan(55)
    expect(single).toBeLessThan(80)
  })

  it('lets an axis become extreme once several answers agree', () => {
    const many = computeRadar([
      input('hiking', 'outdoors', 5), input('camping', 'outdoors', 5),
      input('nature', 'outdoors', 5), input('mountains', 'outdoors', 5),
      input('wildlife', 'outdoors', 5), input('kayaking', 'outdoors', 5),
    ]).outdoors
    expect(many).toBeGreaterThan(85)
  })

  it('grows more confident as evidence accumulates', () => {
    const one = computeRadar([input('a', 'outdoors', 5)]).outdoors
    const three = computeRadar([
      input('a', 'outdoors', 5), input('b', 'outdoors', 5), input('c', 'outdoors', 5),
    ]).outdoors
    const six = computeRadar([
      input('a', 'outdoors', 5), input('b', 'outdoors', 5), input('c', 'outdoors', 5),
      input('d', 'outdoors', 5), input('e', 'outdoors', 5), input('f', 'outdoors', 5),
    ]).outdoors
    expect(one).toBeLessThan(three)
    expect(three).toBeLessThan(six)
  })

  it('shrinks a negative axis toward neutral just as much', () => {
    const single = computeRadar([input('partying', 'nightlife', 1)]).nightlife
    expect(single).toBeLessThan(45)
    expect(single).toBeGreaterThan(20)
  })

  it('reports how much evidence backs each axis', () => {
    const inputs = [
      input('hiking', 'outdoors', 5),
      input('camping', 'outdoors', 4),
      input('food', 'food', 5),
    ]
    const evidence = radarEvidence(inputs)
    expect(evidence.outdoors).toBe(2)
    expect(evidence.food).toBe(1)
    expect(evidence.nightlife).toBeUndefined()
  })

  it('respects engine weight', () => {
    const radar = computeRadar([
      { dimensionKey: 'hiking', radarAxis: 'outdoors', kind: 'RATING', engineWeight: 3, rating: 5, spectrum: null },
      { dimensionKey: 'fishing', radarAxis: 'outdoors', kind: 'RATING', engineWeight: 1, rating: 1, spectrum: null },
    ])
    expect(radar.outdoors).toBeGreaterThan(50)
  })

  it('handles spectrum answers on the 0-100 scale', () => {
    expect(computeRadar([input('spectrum-spend', 'luxury', 100, 'SPECTRUM')]).luxury).toBeGreaterThan(60)
    expect(computeRadar([input('spectrum-spend', 'luxury', 0, 'SPECTRUM')]).luxury).toBeLessThan(40)
  })

  it('ignores dimensions with no radar axis', () => {
    const radar = computeRadar([
      { dimensionKey: 'x', radarAxis: null, kind: 'RATING', engineWeight: 1, rating: 5, spectrum: null },
    ])
    expect(radar.outdoors).toBe(50)
  })

  it('ranks the strongest axes', () => {
    const radar = computeRadar([
      input('hiking', 'outdoors', 5),
      input('food', 'food', 4),
      input('partying', 'nightlife', 1),
    ])
    const top = topAxes(radar, 2)
    expect(top[0]!.key).toBe('outdoors')
    expect(top[0]!.value).toBeGreaterThan(top[1]!.value)
  })
})

describe('plain-English bands', () => {
  it('describes budgets in ranges a person would say out loud', () => {
    expect(describeBudgetBand(90_000)).toBe('under $1,200')
    expect(describeBudgetBand(250_000)).toBe('$2,000 to $3,000')
    expect(describeBudgetBand(900_000)).toBe('over $5,000')
    expect(describeBudgetBand(null)).toBeNull()
  })

  it('describes trip lengths the same way', () => {
    expect(describeTripLengthBand(2, 3)).toBe('a long weekend')
    expect(describeTripLengthBand(5, 7)).toBe('a week')
    expect(describeTripLengthBand(8, 14)).toBe('one to two weeks')
    expect(describeTripLengthBand(15, 30)).toBe('two weeks or more')
    expect(describeTripLengthBand(null, null)).toBeNull()
  })
})
