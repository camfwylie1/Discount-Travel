import type { NormalisedDeal } from './types'

/**
 * DUPLICATE DETECTION
 *
 * The same trip arrives through several feeds, or the same provider
 * re-uploads their catalogue. We score candidate pairs on several signals and
 * — crucially — we never auto-delete an uncertain match. Anything in the grey
 * band goes to a human in the admin portal.
 */

export interface DuplicateSignals {
  sameProvider: boolean
  sameSourceReference: boolean
  sameSourceUrl: boolean
  titleSimilarity: number
  sameDestination: boolean
  sameDates: boolean
  priceSimilarity: number
  sameDuration: boolean
  sameAirport: boolean
}

export interface DuplicateVerdict {
  score: number
  signals: DuplicateSignals
  /** CERTAIN → merge automatically. LIKELY → a human decides. NO → keep both. */
  verdict: 'CERTAIN' | 'LIKELY' | 'NO'
}

/** Above this we treat two rows as definitely the same trip. */
export const CERTAIN_THRESHOLD = 0.92
/** Between this and CERTAIN, a human reviews it. */
export const REVIEW_THRESHOLD = 0.62

export interface ComparableDeal {
  providerId: string
  sourceReference: string | null
  sourceUrl: string | null
  normalizedTitle: string
  destinationCountry: string | null
  destinationCity: string | null
  departureDate: Date | null
  durationNights: number | null
  salePriceCents: number | null
  departureAirportIata: string | null
}

export function toComparable(deal: NormalisedDeal, providerId: string): ComparableDeal {
  return {
    providerId,
    sourceReference: deal.sourceReference,
    sourceUrl: deal.sourceUrl,
    normalizedTitle: deal.normalizedTitle,
    destinationCountry: deal.destinationCountry,
    destinationCity: deal.destinationCity,
    departureDate: deal.departureDate,
    durationNights: deal.durationNights,
    salePriceCents: deal.salePriceCents,
    departureAirportIata: deal.departureAirportIata,
  }
}

/** Token-set similarity (Jaccard). Robust to word order and small edits. */
export function titleSimilarity(a: string, b: string): number {
  const tokenise = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2),
    )
  const setA = tokenise(a)
  const setB = tokenise(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) if (setB.has(token)) intersection += 1
  return intersection / (setA.size + setB.size - intersection)
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return Math.abs(a.getTime() - b.getTime()) < 86_400_000
}

function priceSimilarity(a: number | null, b: number | null): number {
  if (a === null || b === null) return 0
  if (a === 0 || b === 0) return 0
  const ratio = Math.min(a, b) / Math.max(a, b)
  // Within 3% is effectively the same price; beyond 20% it is a different deal.
  if (ratio > 0.97) return 1
  if (ratio < 0.8) return 0
  return (ratio - 0.8) / 0.17
}

export function compareDeals(a: ComparableDeal, b: ComparableDeal): DuplicateVerdict {
  const signals: DuplicateSignals = {
    sameProvider: a.providerId === b.providerId,
    sameSourceReference:
      !!a.sourceReference && !!b.sourceReference && a.sourceReference === b.sourceReference,
    sameSourceUrl: !!a.sourceUrl && !!b.sourceUrl && stripTracking(a.sourceUrl) === stripTracking(b.sourceUrl),
    titleSimilarity: titleSimilarity(a.normalizedTitle, b.normalizedTitle),
    sameDestination:
      !!a.destinationCountry &&
      a.destinationCountry === b.destinationCountry &&
      (!a.destinationCity || !b.destinationCity ||
        a.destinationCity.toLowerCase() === b.destinationCity.toLowerCase()),
    sameDates: sameDay(a.departureDate, b.departureDate),
    priceSimilarity: priceSimilarity(a.salePriceCents, b.salePriceCents),
    sameDuration:
      a.durationNights !== null && a.durationNights === b.durationNights,
    sameAirport:
      !!a.departureAirportIata && a.departureAirportIata === b.departureAirportIata,
  }

  // An identical provider reference or source URL is conclusive on its own.
  if (signals.sameProvider && signals.sameSourceReference) {
    return { score: 1, signals, verdict: 'CERTAIN' }
  }
  if (signals.sameSourceUrl) {
    return { score: 0.97, signals, verdict: 'CERTAIN' }
  }

  // Otherwise, a weighted blend.
  const weights = {
    title: 0.3,
    destination: 0.18,
    dates: 0.18,
    price: 0.14,
    duration: 0.1,
    airport: 0.1,
  }
  const score =
    signals.titleSimilarity * weights.title +
    (signals.sameDestination ? 1 : 0) * weights.destination +
    (signals.sameDates ? 1 : 0) * weights.dates +
    signals.priceSimilarity * weights.price +
    (signals.sameDuration ? 1 : 0) * weights.duration +
    (signals.sameAirport ? 1 : 0) * weights.airport

  // Two different providers selling a genuinely similar trip is normal and
  // NOT a duplicate — we want both, with attribution. So a cross-provider
  // match has to be near-identical before we even ask a human.
  const adjusted = signals.sameProvider ? score : score * 0.82

  return {
    score: adjusted,
    signals,
    verdict:
      adjusted >= CERTAIN_THRESHOLD ? 'CERTAIN' : adjusted >= REVIEW_THRESHOLD ? 'LIKELY' : 'NO',
  }
}

/** Affiliate and campaign parameters must not make two identical URLs differ. */
function stripTracking(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref|aff|affiliate|partner|campaign|source|medium|clickid|cid|sid)/i.test(key)) {
        parsed.searchParams.delete(key)
      }
    }
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}
