/**
 * INGESTION
 *
 * SOURCE → Fetch → Parse → Normalize → Validate → Deduplicate → Categorize →
 * AI enrich → Quality check → Store → Index → Publish
 *
 * Each provider gets an adapter that handles Fetch and Parse. Everything
 * downstream is shared, so adding a provider never means touching the engine.
 */

export type IngestionMethodKey =
  | 'API' | 'AFFILIATE_FEED' | 'CSV_UPLOAD' | 'JSON_IMPORT'
  | 'XML_FEED' | 'MANUAL_ENTRY' | 'STRUCTURED_EXTRACTION'

/**
 * The shape every adapter produces. EVERY field is optional, including the
 * title, because raw provider data genuinely can be missing anything —
 * catching that is validation's job, not the type system's.
 */
export interface RawDeal {
  sourceReference?: string | null
  title?: string | null
  description?: string | null
  sourceUrl?: string | null
  affiliateUrl?: string | null

  destinationCountry?: string | null
  destinationRegion?: string | null
  destinationCity?: string | null
  continent?: string | null

  departureAirport?: string | null
  arrivalAirport?: string | null
  departureDate?: string | Date | null
  returnDate?: string | Date | null
  durationNights?: number | string | null

  currency?: string | null
  salePrice?: number | string | null
  regularPrice?: number | string | null
  pricePerPerson?: boolean | string | null

  airfareIncluded?: boolean | string | null
  accommodationIncluded?: boolean | string | null
  mealsIncluded?: boolean | string | null
  activitiesIncluded?: boolean | string | null
  transportIncluded?: boolean | string | null
  guideIncluded?: boolean | string | null

  accommodationType?: string | null
  accommodationQuality?: number | string | null
  groupSizeMin?: number | string | null
  groupSizeMax?: number | string | null
  minAge?: number | string | null
  physicalDifficulty?: string | null
  tripStyle?: string | string[] | null
  soloFriendly?: boolean | string | null

  inclusions?: string | string[] | null
  exclusions?: string | string[] | null
  images?: string | string[] | null
  cancellationPolicy?: string | null
  bookingDeadline?: string | Date | null
  expiresAt?: string | Date | null
  spotsRemaining?: number | string | null

  /** Anything the provider sends that we do not have a column for. */
  extra?: Record<string, unknown>
}

export interface NormalisedDeal {
  sourceReference: string | null
  originalTitle: string
  normalizedTitle: string
  originalDescription: string | null
  sourceUrl: string | null
  affiliateUrl: string | null

  destinationCountry: string | null
  destinationRegion: string | null
  destinationCity: string | null
  continent: string | null

  departureAirportIata: string | null
  arrivalAirportIata: string | null
  departureDate: Date | null
  returnDate: Date | null
  durationNights: number | null

  currency: string
  salePriceCents: number | null
  regularPriceCents: number | null
  discountCents: number | null
  discountPercent: number | null
  pricePerPerson: boolean

  airfareIncluded: boolean | null
  accommodationIncluded: boolean | null
  mealsIncluded: boolean | null
  activitiesIncluded: boolean | null
  transportIncluded: boolean | null
  guideIncluded: boolean | null

  accommodationType: string | null
  accommodationQuality: number | null
  groupSizeMin: number | null
  groupSizeMax: number | null
  minAge: number | null
  physicalDifficulty: 'EASY' | 'MODERATE' | 'CHALLENGING' | 'STRENUOUS' | 'NOT_SPECIFIED'
  tripStyle: string[]
  soloFriendly: boolean | null

  inclusions: string[]
  exclusions: string[]
  images: string[]
  cancellationPolicy: string | null
  bookingDeadline: Date | null
  expiresAt: Date | null
  spotsRemaining: number | null

  providerMetadata: Record<string, unknown>
  confidence: Record<string, number>
  overallConfidence: number
  qualityIssues: string[]
}

export interface ValidationIssue {
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface RowResult {
  rowNumber: number
  raw: Record<string, unknown>
  normalised: NormalisedDeal | null
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  status: 'VALID' | 'INVALID' | 'DUPLICATE' | 'IMPORTED' | 'SKIPPED'
  duplicateOfId?: string | null
  dealId?: string | null
}

export interface ParseResult {
  rows: RawDeal[]
  /** Column headers we did not recognise — surfaced so the founder can map them. */
  unknownColumns: string[]
  parseErrors: string[]
}

export interface SourceAdapter {
  readonly method: IngestionMethodKey
  readonly name: string
  parse(input: string | Buffer): Promise<ParseResult>
}

export class ComplianceError extends Error {
  constructor(
    message: string,
    readonly providerName: string,
    readonly method: IngestionMethodKey,
  ) {
    super(message)
    this.name = 'ComplianceError'
  }
}
