import { afterEach, describe, expect, it } from 'vitest'
import { priceUsage, pricingConfigured } from './pricing'

const KEYS = ['AI_INPUT_USD_PER_MTOK', 'AI_OUTPUT_USD_PER_MTOK'] as const

afterEach(() => {
  for (const key of KEYS) delete process.env[key]
})

describe('pricing a generation', () => {
  it('records tokens but no cost when no rates are configured', () => {
    const usage = priceUsage(1_000, 500)
    expect(usage.promptTokens).toBe(1_000)
    expect(usage.outputTokens).toBe(500)
    // Unknown, not zero. A cost of zero would quietly make the monthly
    // ceiling unreachable while looking like it was being measured.
    expect(usage.costUsd).toBeNull()
    expect(pricingConfigured()).toBe(false)
  })

  it('prices input and output separately', () => {
    process.env.AI_INPUT_USD_PER_MTOK = '3'
    process.env.AI_OUTPUT_USD_PER_MTOK = '15'

    // 1M input at $3 + 1M output at $15
    expect(priceUsage(1_000_000, 1_000_000).costUsd).toBeCloseTo(18, 10)
    // Output is the expensive half; the two rates must not be interchangeable.
    expect(priceUsage(1_000_000, 0).costUsd).toBeCloseTo(3, 10)
    expect(priceUsage(0, 1_000_000).costUsd).toBeCloseTo(15, 10)
    expect(pricingConfigured()).toBe(true)
  })

  it('leaves the cost unknown when only one rate is configured', () => {
    process.env.AI_INPUT_USD_PER_MTOK = '3'
    expect(priceUsage(1_000, 1_000).costUsd).toBeNull()
    expect(pricingConfigured()).toBe(false)
  })

  it('ignores a rate that is not a usable number', () => {
    process.env.AI_INPUT_USD_PER_MTOK = 'free'
    process.env.AI_OUTPUT_USD_PER_MTOK = '15'
    expect(priceUsage(1_000, 1_000).costUsd).toBeNull()

    process.env.AI_INPUT_USD_PER_MTOK = '-3'
    expect(priceUsage(1_000, 1_000).costUsd).toBeNull()
  })

  it('handles a zero rate as genuinely free rather than unset', () => {
    process.env.AI_INPUT_USD_PER_MTOK = '0'
    process.env.AI_OUTPUT_USD_PER_MTOK = '0'
    expect(priceUsage(5_000, 5_000).costUsd).toBe(0)
  })
})
