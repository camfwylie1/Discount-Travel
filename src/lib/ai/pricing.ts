import type { AiUsage } from './types'

/**
 * WHAT A GENERATION COST
 *
 * Token counts come back from the provider and are always recorded. Turning
 * them into dollars needs a per-token rate, and model prices change often
 * enough that hardcoding them into a repository guarantees they will one day
 * be wrong without anyone noticing.
 *
 * So rates are configuration:
 *
 *   AI_INPUT_USD_PER_MTOK=3       # dollars per million input tokens
 *   AI_OUTPUT_USD_PER_MTOK=15     # dollars per million output tokens
 *
 * Set them from your provider's current pricing page. Leave them unset and
 * generations still record their token counts — the cost is simply recorded as
 * unknown, which is true, and the monthly dollar cap has nothing to work with.
 */

const PER_MILLION = 1_000_000

function rate(name: string): number | null {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** True when both rates are configured, so costs can actually be priced. */
export function pricingConfigured(): boolean {
  return rate('AI_INPUT_USD_PER_MTOK') !== null && rate('AI_OUTPUT_USD_PER_MTOK') !== null
}

export function priceUsage(promptTokens: number, outputTokens: number): AiUsage {
  const input = rate('AI_INPUT_USD_PER_MTOK')
  const output = rate('AI_OUTPUT_USD_PER_MTOK')

  const costUsd =
    input === null || output === null
      ? null
      : (promptTokens / PER_MILLION) * input + (outputTokens / PER_MILLION) * output

  return { promptTokens, outputTokens, costUsd }
}
