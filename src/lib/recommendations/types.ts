/**
 * RECOMMENDATION ENGINE — TYPES
 *
 * Everything in this folder is deliberately *pure*: plain data in, plain data
 * out, no database and no network. That makes the engine fast, unit-testable
 * and replaceable. `service.ts` is the only file that talks to Prisma.
 */

export const ENGINE_VERSION = '1.0.0'

export type DimensionCategoryKey =
  | 'TRAVEL_STYLE'
  | 'ACTIVITY'
  | 'FOOD_DRINK'
  | 'CULTURE'
  | 'SOCIAL'
  | 'ACCOMMODATION'
  | 'SPECTRUM'

export interface DimensionMeta {
  id: string
  key: string
  label: string
  category: DimensionCategoryKey
  kind: 'RATING' | 'SPECTRUM'
  engineWeight: number
  radarAxis?: string | null
  /** The two ends of a SPECTRUM dimension, used to describe a disagreement. */
  poleLowLabel?: string | null
  poleHighLabel?: string | null
}

/** A traveller's answer for one dimension. */
export interface UserPreferenceInput {
  dimensionId: string
  /** 1..5 for RATING dimensions */
  rating?: number | null
  /** 0..100 for SPECTRUM dimensions */
  spectrum?: number | null
  /** 1..5 — how much this matters when matching with PEOPLE */
  peopleWeight?: number
}

/** How strongly a deal exhibits one dimension. */
export interface DealAttributeInput {
  dimensionId: string
  /** 0..1 */
  intensity: number
  /** 0..1 — how sure we are, from the data source */
  confidence: number
}

export interface UserConstraintsInput {
  budgetMax?: number | null
  budgetPreferred?: number | null
  budgetMin?: number | null
  budgetCurrency?: string
  budgetMaxIsHard?: boolean
  budgetIncludesAirfare?: boolean
  earliestDeparture?: Date | null
  latestReturn?: Date | null
  datesAreHard?: boolean
  dateFlexibilityDays?: number
  preferredMonths?: number[]
  weekendsOnly?: boolean
  durationMin?: number | null
  durationMax?: number | null
  durationPreferred?: number | null
  durationIsHard?: boolean
  airportsAreHard?: boolean
  includeNearbyAirports?: boolean
  nearbyRadiusKm?: number
  requiresDirectFlight?: boolean
  avoidTripTypes?: string[]
  partySize?: number
  maxFlightHours?: number | null
}

export interface UserAirportInput {
  airportId: string
  iata: string
  rank: number
  latitude?: number | null
  longitude?: number | null
}

export interface ScoreableUser {
  userId: string
  preferences: UserPreferenceInput[]
  constraints: UserConstraintsInput
  airports: UserAirportInput[]
  /** Destination slugs / country codes the traveller has wishlisted. */
  wishlistCountries?: string[]
  wishlistDestinationIds?: string[]
}

export interface ScoreableDeal {
  dealId: string
  attributes: DealAttributeInput[]
  salePriceCents: number | null
  currency: string
  airfareIncluded: boolean | null
  departureAirportId: string | null
  departureAirportIata: string | null
  departureLat?: number | null
  departureLon?: number | null
  /** Additional departures (tours often offer several). */
  alternateDepartureIatas?: string[]
  departureDate: Date | null
  returnDate: Date | null
  durationNights: number | null
  tripStyle: string[]
  destinationCountry: string | null
  destinationIds?: string[]
  groupSizeMax: number | null
  accommodationQuality: number | null
  status: string
  expiresAt: Date | null
}

/** One weighted part of the overall score. */
export interface ScoreComponent {
  key: ComponentKey
  label: string
  /** 0..1 after normalisation */
  score: number
  /** The weight actually applied (0 when the component had no data). */
  weight: number
  /** Human-readable evidence used to write explanations. */
  detail: string
  /** True when we had no data and fell back to neutral. */
  neutral: boolean
}

export type ComponentKey =
  | 'interests'
  | 'activities'
  | 'social'
  | 'accommodation'
  | 'style'
  | 'budget'
  | 'airport'
  | 'dates'
  | 'duration'

export interface MatchReason {
  key: string
  label: string
  /** 'love' = strong positive, 'fit' = practical fit */
  kind: 'love' | 'fit'
  strength: number
}

export interface MatchMismatch {
  key: string
  label: string
  severity: 'minor' | 'notable'
}

export interface HardFilterFailure {
  key: string
  label: string
  /** What the traveller could change to see this deal. */
  suggestion: string
}

export interface DealMatchResult {
  dealId: string
  /** 0..100, the headline "% match" */
  score: number
  passed: boolean
  failures: HardFilterFailure[]
  components: ScoreComponent[]
  reasons: MatchReason[]
  mismatches: MatchMismatch[]
  engineVersion: string
  /** How much of the score rests on real data rather than neutral fallbacks. */
  confidence: number
}

export interface TravelerMatchResult {
  score: number
  components: ScoreComponent[]
  shared: MatchReason[]
  conflicts: MatchMismatch[]
  engineVersion: string
}

export interface GroupMemberScore {
  userId: string
  displayName: string
  score: number
  passed: boolean
  failures: HardFilterFailure[]
}

export interface GroupDealResult {
  dealId: string
  /** Average across members — reported, but never the headline on its own. */
  averageScore: number
  /** The least-happy member. This is what the UI leads with. */
  minimumScore: number
  medianScore: number
  members: GroupMemberScore[]
  /** Dimensions where the group genuinely disagrees. */
  dealbreakers: GroupDisagreement[]
  disagreements: GroupDisagreement[]
  everyoneCanGo: boolean
}

export interface GroupDisagreement {
  dimensionKey: string
  label: string
  /** Members who love it, members who dislike it. */
  loves: string[]
  dislikes: string[]
  severity: 'dealbreaker' | 'notable'
  note: string
}
