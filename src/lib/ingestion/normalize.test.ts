import { describe, expect, it } from 'vitest'
import {
  normalise, normaliseTitle, parseBoolean, parseCountry, parseDate,
  parseIata, parseList, parseMoneyToCents, parseNights,
} from './normalize'
import { validate } from './validate'

describe('money parsing — providers write prices every possible way', () => {
  it('handles the common formats', () => {
    expect(parseMoneyToCents('1299')).toBe(129_900)
    expect(parseMoneyToCents('1,299')).toBe(129_900)
    expect(parseMoneyToCents('$1,299.00')).toBe(129_900)
    expect(parseMoneyToCents('CAD 1299.50')).toBe(129_950)
    expect(parseMoneyToCents(1299)).toBe(129_900)
    expect(parseMoneyToCents('1299.99')).toBe(129_999)
  })

  it('handles European decimal notation', () => {
    expect(parseMoneyToCents('1.299,00')).toBe(129_900)
    expect(parseMoneyToCents('1.299,50')).toBe(129_950)
  })

  it('returns null rather than zero for missing or nonsense values', () => {
    expect(parseMoneyToCents('')).toBeNull()
    expect(parseMoneyToCents(null)).toBeNull()
    expect(parseMoneyToCents('call us')).toBeNull()
    expect(parseMoneyToCents('-50')).toBeNull()
  })

  it('never produces a floating-point rounding error', () => {
    expect(parseMoneyToCents('0.1')).toBe(10)
    expect(parseMoneyToCents('19.99')).toBe(1999)
    expect(Number.isInteger(parseMoneyToCents('1234.56'))).toBe(true)
  })
})

describe('boolean parsing — the most dangerous field in the pipeline', () => {
  it('reads the many ways providers say yes and no', () => {
    for (const yes of ['true', 'yes', 'Y', '1', 'Included', 'INCL', true]) {
      expect(parseBoolean(yes)).toBe(true)
    }
    for (const no of ['false', 'no', 'N', '0', 'excluded', 'Not included', false]) {
      expect(parseBoolean(no)).toBe(false)
    }
  })

  it('returns NULL — never false — for anything it does not understand', () => {
    // This is the rule that stops us telling someone "flights not included"
    // when the provider simply did not say.
    expect(parseBoolean('')).toBeNull()
    expect(parseBoolean(null)).toBeNull()
    expect(parseBoolean(undefined)).toBeNull()
    expect(parseBoolean('maybe')).toBeNull()
    expect(parseBoolean('on request')).toBeNull()
    expect(parseBoolean('see details')).toBeNull()
  })
})

describe('duration parsing', () => {
  it('reads the formats providers use', () => {
    expect(parseNights('7')).toBe(7)
    expect(parseNights('7 nights')).toBe(7)
    expect(parseNights('7N')).toBe(7)
    expect(parseNights('1 week')).toBe(7)
    expect(parseNights('2 weeks')).toBe(14)
    expect(parseNights(10)).toBe(10)
  })

  it('converts days to nights the way the industry does', () => {
    expect(parseNights('8 days')).toBe(7)
    expect(parseNights('15 days')).toBe(14)
  })

  it('returns null for nonsense', () => {
    expect(parseNights('flexible')).toBeNull()
    expect(parseNights('')).toBeNull()
  })
})

describe('date parsing', () => {
  it('prefers ISO', () => {
    expect(parseDate('2026-03-15')?.toISOString().slice(0, 10)).toBe('2026-03-15')
  })
  it('reads day/month/year, the Canadian convention', () => {
    expect(parseDate('15/03/2026')?.toISOString().slice(0, 10)).toBe('2026-03-15')
    expect(parseDate('15-03-2026')?.toISOString().slice(0, 10)).toBe('2026-03-15')
  })
  it('returns null for nonsense rather than a wrong date', () => {
    expect(parseDate('sometime in spring')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })
})

describe('other field parsing', () => {
  it('extracts an airport code from messy text', () => {
    expect(parseIata('YYZ')).toBe('YYZ')
    expect(parseIata('Toronto (YYZ)')).toBe('YYZ')
    expect(parseIata('departing YVR')).toBe('YVR')
    expect(parseIata('Toronto')).toBeNull()
  })

  it('maps country names and codes', () => {
    expect(parseCountry('Costa Rica')).toBe('CR')
    expect(parseCountry('CR')).toBe('CR')
    expect(parseCountry('cr')).toBe('CR')
    expect(parseCountry('Freedonia')).toBeNull()
  })

  it('splits lists on the separators providers actually use', () => {
    expect(parseList('Flights; Hotel; Breakfast')).toEqual(['Flights', 'Hotel', 'Breakfast'])
    expect(parseList('Flights|Hotel')).toEqual(['Flights', 'Hotel'])
    expect(parseList(['A', 'B'])).toEqual(['A', 'B'])
    expect(parseList('')).toEqual([])
  })

  it('keeps commas inside a single item where they belong', () => {
    // "Return flights, all taxes" is one inclusion, not two.
    expect(parseList('Return flights, all taxes; Hotel')).toEqual(['Return flights', 'all taxes', 'Hotel'])
  })
})

describe('title normalisation', () => {
  it('strips promotional shouting', () => {
    expect(normaliseTitle('FLASH SALE: Costa Rica 7 Nights')).toBe('Costa Rica 7 Nights')
    expect(normaliseTitle('*HOT DEAL* Portugal Escape')).toBe('Portugal Escape')
  })
  it('fixes all-caps titles', () => {
    expect(normaliseTitle('COSTA RICA RAINFOREST ADVENTURE')).toBe('Costa Rica Rainforest Adventure')
  })
  it('leaves a well-written title alone', () => {
    const good = 'Costa Rica: Rainforest, Volcanoes & Pacific Coast'
    expect(normaliseTitle(good)).toBe(good)
  })
  it('removes emoji', () => {
    expect(normaliseTitle('🔥 Bali Retreat')).toBe('Bali Retreat')
  })
})

describe('normalisation end to end', () => {
  const messyRow = {
    title: 'FLASH SALE: costa rica adventure',
    salePrice: '$1,899.00',
    regularPrice: '2,499',
    durationNights: '7 nights',
    departureDate: '15/03/2026',
    departureAirport: 'Toronto (YYZ)',
    destinationCountry: 'Costa Rica',
    airfareIncluded: 'Y',
    mealsIncluded: 'on request',
    inclusions: 'Return flights; 7 nights accommodation; Guide',
    images: 'https://example.com/a.jpg; not-a-url; https://example.com/b.jpg',
  }

  it('turns a messy row into clean data', () => {
    const { deal } = normalise(messyRow)
    expect(deal.normalizedTitle).toBe('Costa Rica Adventure')
    expect(deal.salePriceCents).toBe(189_900)
    expect(deal.regularPriceCents).toBe(249_900)
    expect(deal.durationNights).toBe(7)
    expect(deal.departureAirportIata).toBe('YYZ')
    expect(deal.destinationCountry).toBe('CR')
    expect(deal.airfareIncluded).toBe(true)
    expect(deal.inclusions).toHaveLength(3)
  })

  it('computes the discount only when the regular price is genuinely higher', () => {
    const { deal } = normalise(messyRow)
    expect(deal.discountCents).toBe(60_000)
    expect(deal.discountPercent).toBeCloseTo(24.0, 0)
  })

  it('refuses to invent a discount when the "regular" price is lower', () => {
    const { deal, issues } = normalise({ ...messyRow, regularPrice: '1000' })
    expect(deal.discountCents).toBeNull()
    expect(deal.discountPercent).toBeNull()
    expect(issues.some((i) => i.field === 'regularPrice')).toBe(true)
  })

  it('keeps an unknown inclusion as unknown, not as false', () => {
    const { deal } = normalise(messyRow)
    expect(deal.mealsIncluded).toBeNull()
    expect(deal.qualityIssues.length).toBeGreaterThan(0)
  })

  it('drops invalid image URLs and warns', () => {
    const { deal, issues } = normalise(messyRow)
    expect(deal.images).toHaveLength(2)
    expect(issues.some((i) => i.field === 'images')).toBe(true)
  })

  it('derives trip length from the dates when it was not given', () => {
    const { deal } = normalise({
      title: 'A trip',
      salePrice: '999',
      departureDate: '2026-03-01',
      returnDate: '2026-03-08',
    })
    expect(deal.durationNights).toBe(7)
  })

  it('reports lower confidence for a sparse row', () => {
    const rich = normalise(messyRow).deal
    const sparse = normalise({ title: 'A trip', sourceUrl: 'https://example.com/x' }).deal
    expect(rich.overallConfidence).toBeGreaterThan(sparse.overallConfidence)
    expect(sparse.overallConfidence).toBeLessThan(0.3)
  })

  it('keeps unrecognised provider columns rather than discarding them', () => {
    const { deal } = normalise({
      title: 'A trip', salePrice: '999',
      extra: { providerRating: '4.8', internalCode: 'XYZ' },
    })
    expect(deal.providerMetadata).toEqual({ providerRating: '4.8', internalCode: 'XYZ' })
  })
})

describe('validation', () => {
  const base = { title: 'A real trip', salePrice: '1500', departureDate: '2027-06-01' }

  it('accepts a reasonable row', () => {
    const { deal } = normalise(base)
    expect(validate(deal).errors).toHaveLength(0)
  })

  it('requires a title', () => {
    const { deal } = normalise({ ...base, title: '' })
    expect(validate(deal).errors.some((e) => e.field === 'title')).toBe(true)
  })

  it('requires either a price or a link', () => {
    const { deal } = normalise({ title: 'A trip' })
    expect(validate(deal).errors.some((e) => e.field === 'price')).toBe(true)
  })

  it('accepts a row with a link but no price', () => {
    const { deal } = normalise({ title: 'A trip', sourceUrl: 'https://example.com/trip' })
    expect(validate(deal).errors).toHaveLength(0)
  })

  it('catches a price that is obviously in cents by mistake', () => {
    const { deal } = normalise({ ...base, salePrice: '189900' })
    expect(validate(deal).errors.some((e) => /cents rather than dollars/i.test(e.message))).toBe(true)
  })

  it('catches a return date before the departure date', () => {
    const { deal } = normalise({ ...base, departureDate: '2027-06-10', returnDate: '2027-06-01' })
    expect(validate(deal).errors.some((e) => e.field === 'returnDate')).toBe(true)
  })

  it('warns rather than blocks for a past departure', () => {
    const { deal } = normalise({ ...base, departureDate: '2020-01-01' })
    const result = validate(deal)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings.some((w) => w.field === 'departureDate')).toBe(true)
  })

  it('warns about an implausibly large discount rather than trusting it', () => {
    const { deal } = normalise({ ...base, salePrice: '200', regularPrice: '5000' })
    expect(validate(deal).warnings.some((w) => /unusually large/i.test(w.message))).toBe(true)
  })
})
