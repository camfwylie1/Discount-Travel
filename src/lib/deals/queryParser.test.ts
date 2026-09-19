import { describe, expect, it } from 'vitest'
import { parseQuery } from './queryParser'

describe('the search examples from the product specification', () => {
  it('parses "Hiking Italy"', () => {
    const q = parseQuery('Hiking Italy')
    expect(q.terms).toEqual(['hiking', 'italy'])
  })

  it('parses "Wine Portugal"', () => {
    expect(parseQuery('Wine Portugal').terms).toEqual(['wine', 'portugal'])
  })

  it('parses "Beach under $1500"', () => {
    const q = parseQuery('Beach under $1500')
    expect(q.terms).toEqual(['beach'])
    expect(q.maxPriceCents).toBe(150_000)
    expect(q.understood).toContain('under $1,500')
  })

  it('parses "Weekend from Toronto"', () => {
    const q = parseQuery('Weekend from Toronto')
    expect(q.durationBucket).toBe('weekend')
    expect(q.airports).toEqual(['YYZ', 'YTZ'])
    expect(q.terms).toEqual([])
  })

  it('parses "Ski trips February"', () => {
    const q = parseQuery('Ski trips February')
    expect(q.terms).toEqual(['ski'])
    expect(q.months).toEqual([2])
  })
})

describe('price parsing', () => {
  it('handles several ways of saying a ceiling', () => {
    expect(parseQuery('under $2000').maxPriceCents).toBe(200_000)
    expect(parseQuery('below 1500').maxPriceCents).toBe(150_000)
    expect(parseQuery('less than $3,000').maxPriceCents).toBe(300_000)
    expect(parseQuery('up to 2500').maxPriceCents).toBe(250_000)
    expect(parseQuery('cheaper than $900').maxPriceCents).toBe(90_000)
  })

  it('handles "k" shorthand', () => {
    expect(parseQuery('under $3k').maxPriceCents).toBe(300_000)
  })

  it('treats a bare dollar amount as a ceiling, which is what people mean', () => {
    expect(parseQuery('japan $4000').maxPriceCents).toBe(400_000)
  })

  it('handles a floor', () => {
    expect(parseQuery('luxury over $5000').minPriceCents).toBe(500_000)
  })

  it('does not mistake a year for a price', () => {
    const q = parseQuery('italy 2026')
    expect(q.maxPriceCents).toBeUndefined()
  })
})

describe('origin parsing', () => {
  it('understands "from <city>"', () => {
    expect(parseQuery('anywhere from Vancouver').airports).toEqual(['YVR'])
    expect(parseQuery('from Montreal').airports).toEqual(['YUL'])
  })

  it('understands an airport code', () => {
    expect(parseQuery('beach YYC').airports).toEqual(['YYC'])
  })

  it('understands a bare city name', () => {
    expect(parseQuery('halifax beach trips').airports).toEqual(['YHZ'])
  })

  it('maps Toronto to both its airports', () => {
    expect(parseQuery('from Toronto').airports).toEqual(['YYZ', 'YTZ'])
  })
})

describe('date and duration parsing', () => {
  it('understands month names and abbreviations', () => {
    expect(parseQuery('greece september').months).toEqual([9])
    expect(parseQuery('skiing jan').months).toEqual([1])
  })

  it('understands several months', () => {
    expect(parseQuery('europe may or june').months).toEqual([5, 6])
  })

  it('understands explicit night counts', () => {
    expect(parseQuery('portugal 10 nights').durationBucket).toBe('8-10')
    expect(parseQuery('costa rica 7 nights').durationBucket).toBe('7')
    expect(parseQuery('2 days away').durationBucket).toBe('weekend')
  })
})

describe('term extraction', () => {
  it('drops filler words that carry no meaning', () => {
    expect(parseQuery('I want a trip to Japan').terms).toEqual(['japan'])
    expect(parseQuery('cheap deals for the beach').terms).toEqual(['beach'])
  })

  it('keeps meaningful words', () => {
    expect(parseQuery('small group hiking adventure').terms).toEqual([
      'small', 'group', 'hiking', 'adventure',
    ])
  })

  it('handles an empty or nonsense query without crashing', () => {
    expect(parseQuery('').terms).toEqual([])
    expect(parseQuery('   ').terms).toEqual([])
    expect(parseQuery('!!!').terms).toEqual([])
  })

  it('handles a complex everything-at-once query', () => {
    const q = parseQuery('hiking in Peru from Toronto under $3000 in May for 10 nights')
    expect(q.terms).toEqual(['hiking', 'peru'])
    expect(q.airports).toEqual(['YYZ', 'YTZ'])
    expect(q.maxPriceCents).toBe(300_000)
    expect(q.months).toEqual([5])
    expect(q.durationBucket).toBe('8-10')
    expect(q.understood.length).toBeGreaterThanOrEqual(4)
  })
})
