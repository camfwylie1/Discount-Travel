import type {
  AiProvider,
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

/**
 * ANTHROPIC PROVIDER
 *
 * Uses the Messages API over plain fetch — no SDK dependency, so the bundle
 * stays small and the same shape works in any runtime.
 *
 * NOTE FOR THE FOUNDER: this code path has been written and type-checked but
 * has NOT been run against the live Anthropic API, because that needs an API
 * key that only you can provide. Add ANTHROPIC_API_KEY to .env, set
 * AI_PROVIDER=anthropic and run `npm run verify:ai` to exercise it for real.
 */

const DEFAULT_MODEL = 'claude-sonnet-5'
const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic'
  readonly model: string
  readonly available: boolean
  private readonly apiKey: string

  constructor(apiKey = process.env.ANTHROPIC_API_KEY ?? '') {
    this.apiKey = apiKey
    this.model = process.env.AI_MODEL || DEFAULT_MODEL
    this.available = apiKey.length > 0
  }

  private async call<T>(system: string, user: unknown, maxTokens = 1024): Promise<T> {
    if (!this.available) throw new Error('ANTHROPIC_API_KEY is not configured.')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          system,
          messages: [
            {
              role: 'user',
              content: `${JSON.stringify(user)}\n\nReturn only the JSON object, with no surrounding text or code fences.`,
            },
          ],
        }),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Anthropic returned ${response.status}: ${body.slice(0, 300)}`)
      }

      const payload = (await response.json()) as {
        content?: { type: string; text?: string }[]
      }
      const text = payload.content?.find((c) => c.type === 'text')?.text ?? ''
      return parseJsonResponse<T>(text)
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

/** Models occasionally wrap JSON in prose or code fences. Handle both. */
export function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1]!.trim() : trimmed
  try {
    return JSON.parse(candidate) as T
  } catch {
    const first = candidate.indexOf('{')
    const last = candidate.lastIndexOf('}')
    if (first !== -1 && last > first) {
      return JSON.parse(candidate.slice(first, last + 1)) as T
    }
    throw new Error('The AI provider did not return valid JSON.')
  }
}
