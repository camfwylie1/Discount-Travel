import { describe, expect, it } from 'vitest'
import {
  clamp01,
  falloff,
  haversineKm,
  intensityToSigned,
  rangeOverlap,
  ratingToAffinity,
  signedToUnit,
  weightedAverage,
} from './affinity'

describe('ratingToAffinity — direction and importance from one number', () => {
  it('maps the 1-5 scale onto [-1, 1] with 3 as true neutral', () => {
    expect(ratingToAffinity(1)).toBe(-1)
    expect(ratingToAffinity(2)).toBe(-0.5)
    expect(ratingToAffinity(3)).toBe(0)
    expect(ratingToAffinity(4)).toBe(0.5)
    expect(ratingToAffinity(5)).toBe(1)
  })

  it('treats a 1 as active aversion, not merely the absence of a bonus', () => {
    // This is the requirement that makes negative preferences work at all.
    expect(ratingToAffinity(1)).toBeLessThan(0)
    expect(Math.abs(ratingToAffinity(1))).toBe(Math.abs(ratingToAffinity(5)))
  })

  it('gives a neutral answer zero weight so it never dilutes a score', () => {
    expect(Math.abs(ratingToAffinity(3))).toBe(0)
  })

  it('handles missing and out-of-range input safely', () => {
    expect(ratingToAffinity(null)).toBe(0)
    expect(ratingToAffinity(undefined)).toBe(0)
    expect(ratingToAffinity(99)).toBe(1)
    expect(ratingToAffinity(-5)).toBe(-1)
    expect(ratingToAffinity(NaN)).toBe(0)
  })
})

describe('intensityToSigned — re-centring a deal attribute', () => {
  it('maps 0..1 intensity onto -1..1', () => {
    expect(intensityToSigned(1)).toBe(1)
    expect(intensityToSigned(0.5)).toBe(0)
    expect(intensityToSigned(0)).toBe(-1)
  })

  it('shrinks towards neutral as confidence drops', () => {
    expect(intensityToSigned(1, 0.5)).toBe(0.5)
    expect(intensityToSigned(0, 0.5)).toBe(-0.5)
    expect(intensityToSigned(1, 0)).toBe(0)
  })
})

describe('the four cases of attraction and aversion', () => {
  const contribution = (rating: number, intensity: number) =>
    ratingToAffinity(rating) * intensityToSigned(intensity)

  it('rewards a loved feature that is present', () => {
    expect(contribution(5, 1)).toBe(1)
  })

  it('penalises a loved feature that is absent', () => {
    expect(contribution(5, 0)).toBe(-1)
  })

  it('REWARDS an avoided feature that is absent', () => {
    // A trip with no partying should delight someone who rated partying 1.
    expect(contribution(1, 0)).toBe(1)
  })

  it('penalises an avoided feature that is present', () => {
    expect(contribution(1, 1)).toBe(-1)
  })

  it('is symmetric between attraction and aversion', () => {
    expect(contribution(5, 1)).toBe(contribution(1, 0))
    expect(contribution(5, 0)).toBe(contribution(1, 1))
  })
})

describe('falloff', () => {
  it('gives full marks up to the ideal', () => {
    expect(falloff(100, 200, 300)).toBe(1)
    expect(falloff(200, 200, 300)).toBe(1)
  })
  it('reaches zero at the limit', () => {
    expect(falloff(300, 200, 300)).toBe(0)
    expect(falloff(400, 200, 300)).toBe(0)
  })
  it('is generous about near misses and harsh about far ones', () => {
    const nearMiss = falloff(210, 200, 300)
    const midMiss = falloff(250, 200, 300)
    const farMiss = falloff(290, 200, 300)
    // easeOutQuad: 1 - t². A 10% overshoot barely hurts; a 90% one nearly kills it.
    expect(nearMiss).toBeGreaterThan(0.95)
    expect(midMiss).toBeCloseTo(0.75, 5)
    expect(farMiss).toBeLessThan(0.2)
    expect(farMiss).toBeLessThan(nearMiss / 4)
  })
})

describe('rangeOverlap', () => {
  it('returns 1 for identical ranges', () => expect(rangeOverlap(5, 10, 5, 10)).toBe(1))
  it('returns 0 for disjoint ranges', () => expect(rangeOverlap(1, 3, 10, 14)).toBe(0))
  it('returns a partial value for partial overlap', () => {
    expect(rangeOverlap(5, 10, 8, 20)).toBeCloseTo(0.4, 5)
  })
  it('handles a range contained in another', () => {
    expect(rangeOverlap(1, 30, 7, 10)).toBe(1)
  })
})

describe('weightedAverage', () => {
  it('ignores zero and negative weights', () => {
    expect(weightedAverage([{ value: 1, weight: 0 }, { value: 0, weight: 1 }])).toBe(0)
  })
  it('returns the fallback when nothing has weight', () => {
    expect(weightedAverage([{ value: 1, weight: 0 }], 0.5)).toBe(0.5)
  })
  it('weights correctly', () => {
    expect(weightedAverage([{ value: 1, weight: 3 }, { value: 0, weight: 1 }])).toBe(0.75)
  })
})

describe('helpers', () => {
  it('clamps to the unit interval', () => {
    expect(clamp01(-2)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
  })
  it('maps signed to unit', () => {
    expect(signedToUnit(-1)).toBe(0)
    expect(signedToUnit(0)).toBe(0.5)
    expect(signedToUnit(1)).toBe(1)
  })
  it('measures real-world distance between airports', () => {
    // Toronto Pearson to Toronto Island is roughly 21 km.
    const d = haversineKm(43.6777, -79.6248, 43.6275, -79.3962)
    expect(d).toBeGreaterThan(15)
    expect(d).toBeLessThan(30)
  })
})
