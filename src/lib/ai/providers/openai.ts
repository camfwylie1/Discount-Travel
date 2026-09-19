import type {
  AiProvider,
  AiUsage,
  DealClassificationInput,
  DealClassificationOutput,
  DealSummaryInput,
  DealSummaryOutput,
  MatchExplanationInput,
  MatchExplanationOutput,
  ModerationInput,
  ModerationOutput,
  PersonalityInput,
  PersonalityOutput,
  TravelBioInput,
  TravelBioOutput,
} from '../types'
import {
  DEAL_CLASSIFY_SYSTEM,
  DEAL_SUMMARY_SYSTEM,
  MATCH_EXPLANATION_SYSTEM,
  MODERATION_SYSTEM,
  PERSONALITY_SYSTEM,
  TRAVEL_BIO_SYSTEM,
} from '../prompts'
import { priceUsage } from '../pricing'
import { parseJsonResponse } from './anthropic'

/**
 * OPENAI PROVIDER — the second implementation of the same contract, which is
 * what keeps us from being locked in to one vendor.
 *
 * NOTE FOR THE FOUNDER: written and type-checked, but not exercised against
 * the live API (that needs your key). Set OPENAI_API_KEY and AI_PROVIDER=openai.
 */

const DEFAULT_MODEL = 'gpt-4.1-mini'
const API_URL = 'https://api.openai.com/v1/chat/completions'

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai'
  readonly model: string
  readonly available: boolean
  private readonly apiKey: string
  private lastUsage: AiUsage | null = null

  /** Usage from the most recent call. Reading it clears it. */
  takeLastUsage(): AiUsage | null {
    const usage = this.lastUsage
    this.lastUsage = null
    return usage
  }

  constructor(apiKey = process.env.OPENAI_API_KEY ?? '') {
    this.apiKey = apiKey
    this.model = process.env.AI_MODEL || DEFAULT_MODEL
    this.available = apiKey.length > 0
  }

  private async call<T>(system: string, user: unknown, maxTokens = 1024): Promise<T> {
    if (!this.available) throw new Error('OPENAI_API_KEY is not configured.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(user) },
          ],
        }),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`OpenAI returned ${response.status}: ${body.slice(0, 300)}`)
      }
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }

      // Recorded so spend is attributable per capability and the monthly cap
      // has something real to measure.
      this.lastUsage = priceUsage(payload.usage?.prompt_tokens ?? 0, payload.usage?.completion_tokens ?? 0)

      return parseJsonResponse<T>(payload.choices?.[0]?.message?.content ?? '')
    } finally {
      clearTimeout(timeout)
    }
  }

  generateTravelerPersonality(input: PersonalityInput) {
    return this.call<PersonalityOutput>(PERSONALITY_SYSTEM, input, 900)
  }
  summariseDeal(input: DealSummaryInput) {
    return this.call<DealSummaryOutput>(DEAL_SUMMARY_SYSTEM, input, 700)
  }
  classifyDeal(input: DealClassificationInput) {
    return this.call<DealClassificationOutput>(DEAL_CLASSIFY_SYSTEM, input, 2000)
  }
  generateMatchExplanation(input: MatchExplanationInput) {
    return this.call<MatchExplanationOutput>(MATCH_EXPLANATION_SYSTEM, input, 300)
  }
  moderateContent(input: ModerationInput) {
    return this.call<ModerationOutput>(MODERATION_SYSTEM, input, 300)
  }
  generateTravelBio(input: TravelBioInput) {
    return this.call<TravelBioOutput>(TRAVEL_BIO_SYSTEM, input, 300)
  }
}
