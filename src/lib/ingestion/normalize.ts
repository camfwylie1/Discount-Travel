import type { NormalisedDeal, RawDeal, ValidationIssue } from './types'

/**
 * NORMALISATION
 *
 * Providers describe the same thing in wildly different ways. "7 nights",
 * "7N", "1 week"; "$1,299.00", "1299", "CAD 1299"; "Y", "yes", "true", "1".
 * This turns all of it into one shape.
 *
 * Two rules that never bend:
 *   1. An unknown value becomes NULL, never a default. A missing
 *      "airfare included" is not "airfare not included" — it is unknown, and
 *      the interface says "Not specified".
 *   2. Money is integer cents. Never a float.
 */

const CURRENCY_DEFAULT = 'CAD'

export function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  const text = String(value).trim().toLowerCase()
  if (['true', 'yes', 'y', '1', 'included', 'incl'].includes(text)) return true
  if (['false', 'no', 'n', '0', 'excluded', 'not included'].includes(text)) return false
  // Anything we do not understand stays unknown rather than becoming false.
  return null
}

/** "$1,299.00" / "1299" / "CAD 1,299" → 129900 cents. */
export function parseMoneyToCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return Math.round(value * 100)
  }
  const text = String(value).replace(/[^\d.,-]/g, '').trim()
  if (!text) return null

  // Distinguishing "1,299" (one thousand two hundred) from "1,29" (one point
  // two nine) is the whole problem here. The rule that actually works:
  // a separator followed by EXACTLY three digits, with no later separator,
  // is a thousands separator. Anything else is a decimal point.
  let normalised: string
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  const lastSeparator = Math.max(lastComma, lastDot)

  if (lastSeparator === -1) {
    normalised = text
  } else {
    const digitsAfter = text.length - lastSeparator - 1
    const isThousandsSeparator = digitsAfter === 3
    if (isThousandsSeparator) {
      // Every separator is a grouping mark: 1,299 · 1.299 · 1,234,567
      normalised = text.replace(/[.,]/g, '')
    } else if (lastComma > lastDot) {
      // European: 1.299,50
      normalised = text.replace(/\./g, '').replace(',', '.')
    } else {
      // North American: 1,299.50
      normalised = text.replace(/,/g, '')
    }
  }

  const amount = Number.parseFloat(normalised)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

/** "7 nights" / "7N" / "1 week" / "7" → 7. */
export function parseNights(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null

  const text = String(value).trim().toLowerCase()
  const weeks = text.match(/^(\d+)\s*(?:week|wk)s?$/)
  if (weeks) return Number(weeks[1]) * 7
  const nights = text.match(/(\d+)\s*(?:nights?|n[aä]chte?|nts?|n)\b/)
  if (nights) return Number(nights[1])
  // "8 days" is conventionally 7 nights.
  const days = text.match(/(\d+)\s*days?\b/)
  if (days) return Math.max(1, Number(days[1]) - 1)
  const bare = text.match(/^(\d+)$/)
  if (bare) return Number(bare[1])
  return null
}

export function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const text = String(value).trim()
  if (!text) return null

  // Prefer explicit ISO, then D/M/Y which is the Canadian convention.
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (dmy) {
    const date = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])))
    return Number.isNaN(date.getTime()) ? null : date
  }
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseList(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  return String(value)
    .split(/[;|\n]|(?:,\s)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 60)
}

export function parseInteger(value: unknown, min = 0, max = 100_000): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number.parseInt(String(value).replace(/[^\d-]/g, ''), 10)
  if (!Number.isFinite(num)) return null
  if (num < min || num > max) return null
  return Math.round(num)
}

export function parseIata(value: unknown): string | null {
  if (!value) return null
  const text = String(value).trim().toUpperCase()
  const match = text.match(/\b([A-Z]{3})\b/)
  return match ? match[1]! : null
}

const DIFFICULTY_MAP: Record<string, NormalisedDeal['physicalDifficulty']> = {
  easy: 'EASY', '1': 'EASY', light: 'EASY', relaxed: 'EASY',
  moderate: 'MODERATE', '2': 'MODERATE', medium: 'MODERATE', active: 'MODERATE',
  challenging: 'CHALLENGING', '3': 'CHALLENGING', hard: 'CHALLENGING', demanding: 'CHALLENGING',
  strenuous: 'STRENUOUS', '4': 'STRENUOUS', '5': 'STRENUOUS', extreme: 'STRENUOUS', tough: 'STRENUOUS',
}

export function parseDifficulty(value: unknown): NormalisedDeal['physicalDifficulty'] {
  if (!value) return 'NOT_SPECIFIED'
  return DIFFICULTY_MAP[String(value).trim().toLowerCase()] ?? 'NOT_SPECIFIED'
}

const COUNTRY_CODES: Record<string, string> = {
  'costa rica': 'CR', mexico: 'MX', portugal: 'PT', italy: 'IT', spain: 'ES',
  greece: 'GR', iceland: 'IS', japan: 'JP', thailand: 'TH', indonesia: 'ID',
  peru: 'PE', chile: 'CL', tanzania: 'TZ', 'south africa': 'ZA',
  'dominican republic': 'DO', jamaica: 'JM', canada: 'CA', france: 'FR',
  switzerland: 'CH', 'united kingdom': 'GB', uk: 'GB', 'united states': 'US',
  usa: 'US', vietnam: 'VN', cuba: 'CU', morocco: 'MA', 'new zealand': 'NZ',
  argentina: 'AR', brazil: 'BR', colombia: 'CO', ecuador: 'EC', kenya: 'KE',
  netherlands: 'NL', germany: 'DE', croatia: 'HR', turkey: 'TR', egypt: 'EG',
}

export function parseCountry(value: unknown): string | null {
  if (!value) return null
  const text = String(value).trim()
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase()
  return COUNTRY_CODES[text.toLowerCase()] ?? null
}

/**
 * Trims marketing shouting out of a title without losing its meaning.
 *
 * Providers do things like "FLASH SALE: costa rica", "*HOT DEAL* Portugal"
 * and "🔥 Bali Retreat". We want one consistent hierarchy on every card, so
 * the promotional wrapper goes and the casing is made sane — but not a single
 * word of the actual trip name is touched.
 */
const PROMO_WORDS = 'sale|deal|offer|hot|new|exclusive|limited|special|bargain|last minute|flash'

export function normaliseTitle(title: string): string {
  let working = String(title ?? '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

  // A promo phrase wrapped in punctuation: "*HOT DEAL*", "[SALE]", "(NEW)"
  working = working.replace(
    new RegExp(`^\\s*[\\*\\[\\(<]+\\s*(?:${PROMO_WORDS})(?:\\s+(?:${PROMO_WORDS}))*\\s*[\\*\\]\\)>]+\\s*`, 'i'),
    '',
  )
  // A leading promo phrase followed by a separator: "FLASH SALE: ", "NEW - "
  working = working.replace(
    new RegExp(`^\\s*[\\*!]*\\s*(?:${PROMO_WORDS})(?:\\s+(?:${PROMO_WORDS}))*\\s*[:\\-–—!*|]+\\s*`, 'i'),
    '',
  )

  working = working.replace(/\s+/g, ' ').trim()

  // Fix casing only when the whole title is one case — a properly written
  // title is left exactly as the provider wrote it.
  const hasLower = /\p{Ll}/u.test(working)
  const hasUpper = /\p{Lu}/u.test(working)
  if (working.length > 6 && hasLower !== hasUpper) {
    working = working
      .toLowerCase()
      .replace(/(^|[\s\-–—:(\[/])(\p{Ll})/gu, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
  }

  return working.slice(0, 200)
}

export function normalise(raw: RawDeal): { deal: NormalisedDeal; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = []

  const salePriceCents = parseMoneyToCents(raw.salePrice)
  const regularPriceCents = parseMoneyToCents(raw.regularPrice)

  // A "regular" price that is not actually higher is not a discount.
  let discountCents: number | null = null
  let discountPercent: number | null = null
  if (salePriceCents !== null && regularPriceCents !== null) {
    if (regularPriceCents > salePriceCents) {
      discountCents = regularPriceCents - salePriceCents
      discountPercent = (discountCents / regularPriceCents) * 100
    } else if (regularPriceCents < salePriceCents) {
      issues.push({
        field: 'regularPrice',
        message: 'The regular price is lower than the sale price. Ignored as a discount.',
        severity: 'warning',
      })
    }
  }

  const departureDate = parseDate(raw.departureDate)
  const returnDate = parseDate(raw.returnDate)
  let durationNights = parseNights(raw.durationNights)

  // Derive the trip length when both dates are present but no length was given.
  if (durationNights === null && departureDate && returnDate) {
    const derived = Math.round((returnDate.getTime() - departureDate.getTime()) / 86_400_000)
    if (derived > 0 && derived < 400) durationNights = derived
  }
  if (departureDate && returnDate && returnDate < departureDate) {
    issues.push({
      field: 'returnDate',
      message: 'The return date is before the departure date.',
      severity: 'error',
    })
  }

  const inclusions = parseList(raw.inclusions)
  const exclusions = parseList(raw.exclusions)
  const images = parseList(raw.images).filter((url) => /^https?:\/\//i.test(url))
  if (parseList(raw.images).length !== images.length) {
    issues.push({
      field: 'images',
      message: 'Some image values were not valid absolute URLs and were dropped.',
      severity: 'warning',
    })
  }

  const airfareIncluded = parseBoolean(raw.airfareIncluded)
  const accommodationIncluded = parseBoolean(raw.accommodationIncluded)
  const mealsIncluded = parseBoolean(raw.mealsIncluded)
  const activitiesIncluded = parseBoolean(raw.activitiesIncluded)
  const transportIncluded = parseBoolean(raw.transportIncluded)
  const guideIncluded = parseBoolean(raw.guideIncluded)

  const destinationCountry = parseCountry(raw.destinationCountry)
  if (raw.destinationCountry && !destinationCountry) {
    issues.push({
      field: 'destinationCountry',
      message: `Could not recognise the country "${raw.destinationCountry}". Use a 2-letter ISO code.`,
      severity: 'warning',
    })
  }

  // ── Confidence, per field group. This is what drives "Not specified" and
  // the data-quality reporting, so it must reflect reality.
  const confidence: Record<string, number> = {
    destination: destinationCountry ? 1 : raw.destinationCity ? 0.6 : 0,
    price: salePriceCents !== null ? 1 : 0,
    dates: departureDate ? 1 : 0,
    duration: durationNights !== null ? (parseNights(raw.durationNights) !== null ? 1 : 0.7) : 0,
    airfareIncluded: airfareIncluded !== null ? 1 : 0,
    inclusions: inclusions.length > 0 ? 0.9 : 0,
    accommodation: raw.accommodationType ? 0.9 : 0,
    groupSize: raw.groupSizeMax ? 0.9 : 0,
  }
  const overallConfidence =
    Object.values(confidence).reduce((sum, v) => sum + v, 0) / Object.keys(confidence).length

  const qualityIssues: string[] = []
  if (airfareIncluded === null) qualityIssues.push('Provider did not say whether flights are included')
  if (inclusions.length === 0) qualityIssues.push('Provider did not list what is included')
  if (!raw.accommodationType) qualityIssues.push('Accommodation type not specified')
  if (images.length === 0) qualityIssues.push('No images supplied')
  if (durationNights === null) qualityIssues.push('Trip length not specified')

  const deal: NormalisedDeal = {
    sourceReference: raw.sourceReference ? String(raw.sourceReference).slice(0, 120) : null,
    originalTitle: String(raw.title ?? '').trim().slice(0, 300),
    normalizedTitle: normaliseTitle(String(raw.title ?? '')),
    originalDescription: raw.description ? String(raw.description).trim().slice(0, 8000) : null,
    sourceUrl: cleanUrl(raw.sourceUrl),
    affiliateUrl: cleanUrl(raw.affiliateUrl),

    destinationCountry,
    destinationRegion: raw.destinationRegion ? String(raw.destinationRegion).trim().slice(0, 120) : null,
    destinationCity: raw.destinationCity ? String(raw.destinationCity).trim().slice(0, 120) : null,
    continent: raw.continent ? String(raw.continent).trim().slice(0, 60) : null,

    departureAirportIata: parseIata(raw.departureAirport),
    arrivalAirportIata: parseIata(raw.arrivalAirport),
    departureDate,
    returnDate,
    durationNights,

    currency: (raw.currency ? String(raw.currency).trim().toUpperCase() : CURRENCY_DEFAULT).slice(0, 3),
    salePriceCents,
    regularPriceCents,
    discountCents,
    discountPercent,
    pricePerPerson: parseBoolean(raw.pricePerPerson) ?? true,

    airfareIncluded,
    accommodationIncluded,
    mealsIncluded,
    activitiesIncluded,
    transportIncluded,
    guideIncluded,

    accommodationType: raw.accommodationType ? String(raw.accommodationType).trim().slice(0, 120) : null,
    accommodationQuality: parseInteger(raw.accommodationQuality, 1, 5),
    groupSizeMin: parseInteger(raw.groupSizeMin, 1, 500),
    groupSizeMax: parseInteger(raw.groupSizeMax, 1, 500),
    minAge: parseInteger(raw.minAge, 0, 99),
    physicalDifficulty: parseDifficulty(raw.physicalDifficulty),
    tripStyle: parseList(raw.tripStyle).map((s) => s.toLowerCase().replace(/\s+/g, '-')).slice(0, 12),
    soloFriendly: parseBoolean(raw.soloFriendly),

    inclusions,
    exclusions,
    images,
    cancellationPolicy: raw.cancellationPolicy ? String(raw.cancellationPolicy).slice(0, 2000) : null,
    bookingDeadline: parseDate(raw.bookingDeadline),
    expiresAt: parseDate(raw.expiresAt),
    spotsRemaining: parseInteger(raw.spotsRemaining, 0, 10_000),

    providerMetadata: raw.extra ?? {},
    confidence,
    overallConfidence,
    qualityIssues,
  }

  return { deal, issues }
}

function cleanUrl(value: unknown): string | null {
  if (!value) return null
  const text = String(value).trim()
  try {
    const url = new URL(text)
    // Only ever store links we would be willing to send a member to.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString().slice(0, 2000)
  } catch {
    return null
  }
}
