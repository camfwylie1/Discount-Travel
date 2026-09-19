import { describe, expect, it } from 'vitest'
import { computeDealValue, valueBandLabel, type DealValueInput } from './dealValue'

const base: DealValueInput = {
  salePriceCents: 189_900,
  regularPriceCents: 249_900,
  durationNights: 7,
  airfareIncluded: true,
  accommodationIncluded: true,
  mealsIncluded: true,
  activitiesIncluded: true,
  guideIncluded: true,
  transportIncluded: true,
  accommodationQuality: 4,
  providerQuality: 0.8,
}

describe('deal value is independent of personality match', () => {
  it('rates an inclusive, discounted trip highly', () => {
    const r = computeDealValue({ ...base, observedHigherPriceCount: 2 })
    expect(r.score).not.toBeNull()
    expect(r.score!).toBeGreaterThan(70)
    expect(['great', 'exceptional']).toContain(r.band)
  })

  it('rates a bare, expensive trip poorly', () => {
    const r = computeDealValue({
      ...base,
      salePriceCents: 420_000,
      regularPriceCents: null,
      airfareIncluded: false,
      accommodationIncluded: true,
      mealsIncluded: false,
      activitiesIncluded: false,
      guideIncluded: false,
      transportIncluded: false,
      accommodationQuality: 2,
    })
    expect(r.score!).toBeLessThan(50)
  })
})

describe('we never manufacture a discount', () => {
  it('discounts the weight of an unverified "was" price and says so', () => {
    const r = computeDealValue({ ...base, observedHigherPriceCount: 0 })
    expect(r.verifiedDiscountPercent).toBeNull()
    expect(r.claimedDiscountPercent).toBeCloseTo(24.0, 0)
    expect(r.caveats.join(' ')).toMatch(/not been independently verified/i)
  })

  it('counts the discount fully once we have observed the higher price ourselves', () => {
    const unverified = computeDealValue({ ...base, observedHigherPriceCount: 0 })
    const verified = computeDealValue({ ...base, observedHigherPriceCount: 3 })
    expect(verified.verifiedDiscountPercent).toBeCloseTo(24.0, 0)
    expect(verified.score!).toBeGreaterThan(unverified.score!)
  })

  it('reports no discount at all when there is no regular price', () => {
    const r = computeDealValue({ ...base, regularPriceCents: null })
    expect(r.claimedDiscountPercent).toBeNull()
    expect(r.verifiedDiscountPercent).toBeNull()
  })

  it('ignores a "discount" where the regular price is not actually higher', () => {
    const r = computeDealValue({ ...base, regularPriceCents: 150_000 })
    expect(r.claimedDiscountPercent).toBeNull()
  })
})

describe('cheap is not automatically good', () => {
  it('rates a cheap, empty package below a dearer, inclusive one', () => {
    const cheapAndBare = computeDealValue({
      salePriceCents: 79_900, regularPriceCents: null, durationNights: 7,
      airfareIncluded: false, accommodationIncluded: true, mealsIncluded: false,
      activitiesIncluded: false, guideIncluded: false, transportIncluded: false,
      accommodationQuality: 2, providerQuality: 0.5,
    })
    const dearAndFull = computeDealValue({ ...base, observedHigherPriceCount: 1 })
    expect(dearAndFull.score!).toBeGreaterThan(cheapAndBare.score!)
  })
})

describe('honest about ignorance', () => {
  it('returns null rather than a guess when almost nothing is known', () => {
    const r = computeDealValue({
      salePriceCents: null, regularPriceCents: null, durationNights: null,
      airfareIncluded: null, accommodationIncluded: null, mealsIncluded: null,
      activitiesIncluded: null, guideIncluded: null, transportIncluded: null,
      accommodationQuality: null,
    })
    expect(r.score).toBeNull()
    expect(r.band).toBe('unknown')
    expect(valueBandLabel(r.band)).toMatch(/not rated/i)
  })

  it('notes when the provider did not specify the inclusions', () => {
    const r = computeDealValue({
      salePriceCents: 180_000, regularPriceCents: 200_000, observedHigherPriceCount: 1,
      durationNights: 7, airfareIncluded: null, accommodationIncluded: null,
      mealsIncluded: null, activitiesIncluded: null, guideIncluded: null,
      transportIncluded: null, accommodationQuality: 3,
    })
    expect(r.caveats.join(' ')).toMatch(/does not specify what is included/i)
  })

  it('benchmarks cost per night differently when flights are included', () => {
    const withFlights = computeDealValue({ ...base, airfareIncluded: true })
    const withoutFlights = computeDealValue({ ...base, airfareIncluded: false })
    const a = withFlights.components.find((c) => c.key === 'perNight')!
    const b = withoutFlights.components.find((c) => c.key === 'perNight')!
    expect(a.score).toBeGreaterThan(b.score)
    expect(a.detail).toMatch(/including flights/i)
  })
})
