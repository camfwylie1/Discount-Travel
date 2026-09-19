import 'server-only'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { flagDefaults } from '@/config/flags'
import { logger } from '@/lib/observability/logger'
import { AnthropicProvider } from './providers/anthropic'
import { FallbackAiProvider } from './providers/fallback'
import { OpenAiProvider } from './providers/openai'
import type {
  AiCapability,
  AiProvider,
  AiResult,
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
} from './types'

/**
 * AI SERVICE
 *
 * The single entry point for everything AI in the product. It handles:
 *   • provider selection (Anthropic / OpenAI / deterministic fallback)
 *   • caching, so we never pay twice for the same generation
 *   • automatic fallback when a provider errors, times out or is not configured
 *   • cost accounting
 *
 * COST CONTROL: nothing here is called on a page load. Deal summaries and
 * classifications are generated once, at ingestion time, and stored on the
 * deal. Match explanations come from the deterministic engine; the AI is only
 * used to phrase them, and that result is cached too.
 */

const fallbackProvider = new FallbackAiProvider()

let primaryProvider: AiProvider | null = null

export function getPrimaryProvider(): AiProvider {
  if (primaryProvider) return primaryProvider
  const choice = (process.env.AI_PROVIDER ?? 'fallback').toLowerCase()
  if (!flagDefaults.AI_ENABLED) {
    primaryProvider = fallbackProvider
    return primaryProvider
  }
  if (choice === 'anthropic') {
    const p = new AnthropicProvider()
    primaryProvider = p.available ? p : fallbackProvider
  } else if (choice === 'openai') {
    const p = new OpenAiProvider()
    primaryProvider = p.available ? p : fallbackProvider
  } else {
    primaryProvider = fallbackProvider
  }
  return primaryProvider
}

/** Test seam — lets the suite inject a deliberately failing provider. */
export function __setPrimaryProvider(provider: AiProvider | null) {
  primaryProvider = provider
}

export function hashInput(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 48)
}

interface RunOptions {
  /** Skip the cache and force a regeneration (used by "regenerate" buttons). */
  force?: boolean
  /** Do not persist to the cache (used by moderation on ephemeral content). */
  noCache?: boolean
}

async function run<TIn, TOut>(
  capability: AiCapability,
  input: TIn,
  invoke: (provider: AiProvider) => Promise<TOut>,
  options: RunOptions = {},
): Promise<AiResult<TOut>> {
  const started = Date.now()
  const inputHash = hashInput(input)

  if (!options.force && !options.noCache) {
    try {
      const cached = await prisma.aiGeneration.findUnique({
        where: { capability_inputHash: { capability, inputHash } },
      })
      if (cached && !cached.error) {
        return {
          data: cached.output as TOut,
          provider: cached.provider,
          model: cached.model,
          usedFallback: cached.usedFallback,
          cached: true,
          latencyMs: 0,
        }
      }
    } catch (error) {
      // A cache read failure must never break the feature.
      logger.warn('ai.cache_read_failed', { capability, error: String(error) })
    }
  }

  const provider = getPrimaryProvider()
  let data: TOut
  let usedFallback = provider.name === 'fallback'
  let usedProvider = provider
  let errorMessage: string | undefined

  try {
    data = await invoke(provider)
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('ai.provider_failed', { capability, provider: provider.name, error: errorMessage })
    // Graceful degradation: the deterministic provider always answers.
    try {
      data = await invoke(fallbackProvider)
      usedFallback = true
      usedProvider = fallbackProvider
    } catch (fallbackError) {
      logger.error('ai.fallback_failed', { capability, error: String(fallbackError) })
      throw new Error(`AI generation failed for ${capability}.`)
    }
  }

  const latencyMs = Date.now() - started

  if (!options.noCache) {
    try {
      await prisma.aiGeneration.upsert({
        where: { capability_inputHash: { capability, inputHash } },
        create: {
          capability,
          inputHash,
          provider: usedProvider.name,
          model: usedProvider.model,
          output: data as object,
          usedFallback,
          latencyMs,
          error: errorMessage ?? null,
        },
        update: {
          provider: usedProvider.name,
          model: usedProvider.model,
          output: data as object,
          usedFallback,
          latencyMs,
          error: errorMessage ?? null,
        },
      })
    } catch (error) {
      logger.warn('ai.cache_write_failed', { capability, error: String(error) })
    }
  }

  return {
    data,
    provider: usedProvider.name,
    model: usedProvider.model,
    usedFallback,
    cached: false,
    latencyMs,
    error: errorMessage,
  }
}

export const ai = {
  generateTravelerPersonality(input: PersonalityInput, options?: RunOptions) {
    return run<PersonalityInput, PersonalityOutput>(
      'travelPersonality',
      input,
      (p) => p.generateTravelerPersonality(input),
      options,
    )
  },

  summariseDeal(input: DealSummaryInput, options?: RunOptions) {
    return run<DealSummaryInput, DealSummaryOutput>(
      'dealSummary',
      input,
      (p) => p.summariseDeal(input),
      options,
    )
  },

  classifyDeal(input: DealClassificationInput, options?: RunOptions) {
    return run<DealClassificationInput, DealClassificationOutput>(
      'dealClassification',
      input,
      async (p) => {
        const result = await p.classifyDeal(input)
        // Defence in depth: the model may only use the vocabulary we gave it.
        const allowed = new Set(input.availableDimensions.map((d) => d.key))
        return {
          ...result,
          attributes: (result.attributes ?? [])
            .filter((a) => allowed.has(a.key))
            .map((a) => ({
              ...a,
              intensity: Math.min(1, Math.max(0, Number(a.intensity) || 0)),
              confidence: Math.min(1, Math.max(0, Number(a.confidence) || 0)),
            })),
        }
      },
      options,
    )
  },

  generateMatchExplanation(input: MatchExplanationInput, options?: RunOptions) {
    return run<MatchExplanationInput, MatchExplanationOutput>(
      'matchExplanation',
      input,
      (p) => p.generateMatchExplanation(input),
      options,
    )
  },

  moderateContent(input: ModerationInput) {
    return run<ModerationInput, ModerationOutput>(
      'moderation',
      input,
      (p) => p.moderateContent(input),
      { noCache: true },
    )
  },

  generateTravelBio(input: TravelBioInput, options?: RunOptions) {
    return run<TravelBioInput, TravelBioOutput>(
      'travelBio',
      input,
      (p) => p.generateTravelBio(input),
      options,
    )
  },

  /** For the admin dashboard: which provider is actually in use right now. */
  status() {
    const provider = getPrimaryProvider()
    return {
      configured: process.env.AI_PROVIDER ?? 'fallback',
      active: provider.name,
      model: provider.model,
      enabled: flagDefaults.AI_ENABLED,
      usingFallback: provider.name === 'fallback',
    }
  },
}

export { fallbackProvider }
export type { AiResult }
