/**
 * SEARCH QUERY PARSER
 *
 * Travellers type things like "beach under $1500" and "weekend from Toronto",
 * not field:value syntax. This pulls the structured bits out of a plain
 * sentence, and hands back the words that are left for text matching.
 *
 * Pure and dependency-free, so it is trivially testable.
 */

export interface ParsedQuery {
  /** Words left after the structured parts were extracted. */
  terms: string[]
  maxPriceCents?: number
  minPriceCents?: number
  months?: number[]
  airports?: string[]
  durationBucket?: string
  /** Human-readable summary of what we understood, shown back to the user. */
  understood: string[]
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
}

/** City and airport names travellers actually type, mapped to IATA codes. */
const ORIGINS: Record<string, string[]> = {
  toronto: ['YYZ', 'YTZ'],
  yyz: ['YYZ'],
  ytz: ['YTZ'],
  vancouver: ['YVR'],
  yvr: ['YVR'],
  calgary: ['YYC'],
  yyc: ['YYC'],
  edmonton: ['YEG'],
  yeg: ['YEG'],
  winnipeg: ['YWG'],
  ywg: ['YWG'],
  ottawa: ['YOW'],
  yow: ['YOW'],
  montreal: ['YUL'],
  'montréal': ['YUL'],
  yul: ['YUL'],
  halifax: ['YHZ'],
  yhz: ['YHZ'],
  'st johns': ['YYT'],
  "st john's": ['YYT'],
  yyt: ['YYT'],
  hamilton: ['YHM'],
  quebec: ['YQB'],
  victoria: ['YYJ'],
  saskatoon: ['YXE'],
  regina: ['YQR'],
}

const DURATION_WORDS: Record<string, string> = {
  weekend: 'weekend',
  weekends: 'weekend',
  week: '7',
  fortnight: '11-14',
}

/** Words that carry no search value once the structure is removed. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'in', 'on', 'at', 'of', 'for', 'and', 'or', 'with',
  'trip', 'trips', 'holiday', 'holidays', 'vacation', 'vacations', 'deal', 'deals',
  'travel', 'go', 'going', 'want', 'i', 'me', 'my', 'from', 'under', 'over',
  'between', 'per', 'person', 'cheap', 'best', 'good', 'nights', 'night', 'days', 'day',
])

export function parseQuery(input: string): ParsedQuery {
  const understood: string[] = []
  let working = ` ${input.toLowerCase().trim()} `

  const result: ParsedQuery = { terms: [], understood }

  // ── Price: "under $1500", "under 1500", "less than 2000", "below $3,000"
  const maxMatch = working.match(/\b(?:under|below|less than|max|up to|cheaper than)\s*\$?\s*([\d,]+)(k?)\b/)
  if (maxMatch) {
    const amount = parseAmount(maxMatch[1]!, maxMatch[2] === 'k')
    if (amount) {
      result.maxPriceCents = amount * 100
      understood.push(`under $${amount.toLocaleString('en-CA')}`)
      working = working.replace(maxMatch[0], ' ')
    }
  }

  // ── Price: "over $2000", "more than 1500", "at least 900"
  const minMatch = working.match(/\b(?:over|above|more than|at least|from)\s*\$\s*([\d,]+)(k?)\b/)
  if (minMatch) {
    const amount = parseAmount(minMatch[1]!, minMatch[2] === 'k')
    if (amount) {
      result.minPriceCents = amount * 100
      understood.push(`over $${amount.toLocaleString('en-CA')}`)
      working = working.replace(minMatch[0], ' ')
    }
  }

  // ── A bare "$1500" is read as a ceiling, which is what people mean.
  if (result.maxPriceCents === undefined && result.minPriceCents === undefined) {
    const bare = working.match(/\$\s*([\d,]+)(k?)\b/)
    if (bare) {
      const amount = parseAmount(bare[1]!, bare[2] === 'k')
      if (amount) {
        result.maxPriceCents = amount * 100
        understood.push(`under $${amount.toLocaleString('en-CA')}`)
        working = working.replace(bare[0], ' ')
      }
    }
  }

  // ── Origin: "from Toronto", or just a Canadian city name anywhere.
  const fromMatch = working.match(/\bfrom\s+([a-zà-ÿ'’.\s]{2,20}?)(?=\s|$)/)
  if (fromMatch) {
    const key = normaliseOrigin(fromMatch[1]!)
    if (ORIGINS[key]) {
      result.airports = ORIGINS[key]
      understood.push(`from ${titleCase(key)}`)
      working = working.replace(fromMatch[0], ' ')
    }
  }
  if (!result.airports) {
    for (const [name, codes] of Object.entries(ORIGINS)) {
      // Only match multi-character names as whole words.
      const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`)
      if (pattern.test(working)) {
        result.airports = codes
        understood.push(`from ${titleCase(name)}`)
        working = working.replace(pattern, ' ')
        break
      }
    }
  }

  // ── Months
  const months = new Set<number>()
  for (const [word, month] of Object.entries(MONTHS)) {
    const pattern = new RegExp(`\\b${word}\\b`)
    if (pattern.test(working)) {
      months.add(month)
      working = working.replace(pattern, ' ')
    }
  }
  if (months.size > 0) {
    result.months = [...months].sort((a, b) => a - b)
    understood.push(
      result.months.map((m) => new Date(2025, m - 1, 1).toLocaleString('en-CA', { month: 'long' })).join(' or '),
    )
  }

  // ── Duration words
  for (const [word, bucket] of Object.entries(DURATION_WORDS)) {
    const pattern = new RegExp(`\\b${word}\\b`)
    if (pattern.test(working)) {
      result.durationBucket = bucket
      understood.push(word === 'week' ? 'about a week' : word)
      working = working.replace(pattern, ' ')
      break
    }
  }

  // ── "7 nights", "10 days"
  const nightsMatch = working.match(/\b(\d{1,2})\s*(?:nights?|days?)\b/)
  if (nightsMatch && !result.durationBucket) {
    const n = Number(nightsMatch[1])
    if (n >= 1 && n <= 60) {
      result.durationBucket = bucketFor(n)
      understood.push(`${n} nights`)
      working = working.replace(nightsMatch[0], ' ')
    }
  }

  result.terms = working
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))

  return result
}

function parseAmount(raw: string, isThousands: boolean): number | null {
  const value = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  return isThousands ? value * 1000 : value
}

function bucketFor(nights: number): string {
  if (nights <= 3) return 'weekend'
  if (nights <= 6) return '4-6'
  if (nights === 7) return '7'
  if (nights <= 10) return '8-10'
  if (nights <= 14) return '11-14'
  if (nights <= 21) return '15-21'
  return '22-30'
}

function normaliseOrigin(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/\.$/, '')
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
