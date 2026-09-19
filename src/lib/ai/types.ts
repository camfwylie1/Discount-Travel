/**
 * AI SERVICE CONTRACT
 *
 * Every AI capability the product needs is declared here once. Application
 * code calls `ai.summariseDeal(...)`, never an HTTP endpoint, so swapping
 * Anthropic for OpenAI (or for the offline fallback) touches one file.
 *
 * TWO RULES THAT ARE NEVER BROKEN:
 *  1. AI never invents a fact about a travel deal. It may only summarise,
 *     classify or rephrase information already present in the source.
 *  2. AI output is stored in its own columns, clearly separated from source
 *     data, so a reader always knows which is which.
 */

export type AiCapability =
  | 'travelPersonality'
  | 'dealSummary'
  | 'dealClassification'
  | 'dealAttributes'
  | 'matchExplanation'
  | 'moderation'
  | 'travelBio'

export interface AiResult<T> {
  data: T
  provider: string
  model: string | null
  usedFallback: boolean
  cached: boolean
  latencyMs: number
  costUsd?: number
  error?: string
}

// ── Travel personality ───────────────────────────────────────────────────────
export interface PersonalityInput {
  firstName: string
  /** dimension key → 1..5 */
  topLikes: { key: string; label: string; rating: number }[]
  topDislikes: { key: string; label: string; rating: number }[]
  spectrums: { key: string; label: string; lowLabel: string; highLabel: string; value: number }[]
  /** 0..100 per radar axis */
  radar: Record<string, number>
  budgetBand: string | null
  tripLengthBand: string | null
  homeCity: string | null
}

export interface PersonalityOutput {
  title: string
  description: string
  topInterests: string[]
  tripStyles: string[]
  destinationIdeas: string[]
  idealCompanions: string
  archetypeKey: string
}

// ── Deal summarisation ───────────────────────────────────────────────────────
export interface DealSummaryInput {
  title: string
  description: string | null
  destination: string
  departureAirport: string | null
  durationNights: number | null
  /** Facts already established from the source. AI must not add to these. */
  facts: {
    airfareIncluded: boolean | null
    accommodationIncluded: boolean | null
    mealsIncluded: boolean | null
    activitiesIncluded: boolean | null
    guideIncluded: boolean | null
    accommodationType: string | null
    groupSizeMax: number | null
    physicalDifficulty: string | null
    tripStyle: string[]
  }
  inclusions: string[]
  highlightCandidates: string[]
}

export interface DealSummaryOutput {
  summary: string
  /** Short bullet highlights, each traceable to the input. */
  highlights: string[]
  bestSuitedTo: string
}

// ── Classification / attribute extraction ────────────────────────────────────
export interface DealClassificationInput {
  title: string
  description: string | null
  destination: string
  destinationTraits: string[]
  inclusions: string[]
  itineraryText: string | null
  /** The complete vocabulary the model may use — it cannot invent dimensions. */
  availableDimensions: { key: string; label: string; category: string }[]
}

export interface DealClassificationOutput {
  /** dimension key → 0..1 intensity, restricted to availableDimensions */
  attributes: { key: string; intensity: number; confidence: number; evidence?: string }[]
  tripStyle: string[]
  tags: string[]
}

// ── Match explanation (polish only — the numbers come from the engine) ───────
export interface MatchExplanationInput {
  dealTitle: string
  score: number
  reasons: string[]
  mismatches: string[]
  firstName: string
}

export interface MatchExplanationOutput {
  paragraph: string
}

// ── Moderation ───────────────────────────────────────────────────────────────
export interface ModerationInput {
  text: string
  context: 'message' | 'bio' | 'trip' | 'circle' | 'report'
}

export interface ModerationOutput {
  allowed: boolean
  flags: string[]
  reason: string | null
}

export interface TravelBioInput {
  firstName: string
  personalityTitle: string
  topInterests: string[]
  homeCity: string | null
  countriesVisited: string[]
  wishlist: string[]
}

export interface TravelBioOutput {
  bio: string
}

/** What one generation actually consumed. */
export interface AiUsage {
  promptTokens: number
  outputTokens: number
  /**
   * Null unless per-token rates are configured. Model prices change and are
   * not the sort of thing to hardcode into a repository, so an unpriced
   * generation records its tokens and leaves the cost unknown rather than
   * inventing a number that would later be quietly wrong.
   */
  costUsd: number | null
}

export interface AiProvider {
  readonly name: string
  readonly model: string | null
  readonly available: boolean
  /**
   * Usage from the most recent call, consumed once. Providers that cost
   * nothing to run (the deterministic fallback) do not implement it.
   */
  takeLastUsage?(): AiUsage | null
  generateTravelerPersonality(input: PersonalityInput): Promise<PersonalityOutput>
  summariseDeal(input: DealSummaryInput): Promise<DealSummaryOutput>
  classifyDeal(input: DealClassificationInput): Promise<DealClassificationOutput>
  generateMatchExplanation(input: MatchExplanationInput): Promise<MatchExplanationOutput>
  moderateContent(input: ModerationInput): Promise<ModerationOutput>
  generateTravelBio(input: TravelBioInput): Promise<TravelBioOutput>
}
