import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { sharedRateLimit, sweepSharedRateLimits, isShared } from '@/lib/security/sharedRateLimit'
import { RATE_LIMITS } from '@/lib/security/rateLimit'

/**
 * The point of counting these in the database is that the limit means the same
 * thing however many servers are running. An in-memory limiter would pass a
 * test that only called it from one place, which is exactly why these go
 * through the shared store.
 */

beforeEach(async () => {
  await prisma.rateLimitHit.deleteMany({})
})

describe('shared rate limiting', () => {
  it('allows attempts up to the limit and refuses the one after', async () => {
    const limit = RATE_LIMITS.login.limit
    const id = `test-${Date.now()}`

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const result = await sharedRateLimit('login', id)
      expect(result, 'shared store unavailable').not.toBeNull()
      expect(result!.allowed, `attempt ${attempt} of ${limit} should be allowed`).toBe(true)
    }

    const overTheLine = await sharedRateLimit('login', id)
    expect(overTheLine!.allowed).toBe(false)
    expect(overTheLine!.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('counts attempts made through different callers against one limit', async () => {
    // Two callers stand in for two server instances. On the old in-memory
    // limiter each would have had its own private count, so eight guesses per
    // instance became eight times the instances.
    const id = `shared-${Date.now()}`
    const limit = RATE_LIMITS.login.limit

    const instanceA = Array.from({ length: Math.ceil(limit / 2) })
    const instanceB = Array.from({ length: Math.ceil(limit / 2) })

    for (const _ of instanceA) await sharedRateLimit('login', id)
    for (const _ of instanceB) await sharedRateLimit('login', id)

    const next = await sharedRateLimit('login', id)
    expect(next!.allowed, 'the limit did not hold across callers').toBe(false)
  })

  it('keeps separate identifiers separate', async () => {
    const limit = RATE_LIMITS.login.limit
    const victim = `victim-${Date.now()}`
    const bystander = `bystander-${Date.now()}`

    for (let i = 0; i <= limit; i += 1) await sharedRateLimit('login', victim)

    // One account being attacked must not lock everybody else out.
    const other = await sharedRateLimit('login', bystander)
    expect(other!.allowed).toBe(true)
  })

  it('ignores attempts that have aged out of the window', async () => {
    const id = `aged-${Date.now()}`
    const key = `login:${id}`
    const longAgo = new Date(Date.now() - RATE_LIMITS.login.windowMs - 60_000)

    await prisma.rateLimitHit.createMany({
      data: Array.from({ length: RATE_LIMITS.login.limit + 5 }, () => ({
        key,
        occurredAt: longAgo,
      })),
    })

    const result = await sharedRateLimit('login', id)
    expect(result!.allowed, 'stale attempts should not count').toBe(true)
  })

  it('sweeps counters that are spent', async () => {
    await prisma.rateLimitHit.create({
      data: { key: 'login:old', occurredAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    })
    await prisma.rateLimitHit.create({ data: { key: 'login:fresh' } })

    const removed = await sweepSharedRateLimits()
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(await prisma.rateLimitHit.count({ where: { key: 'login:fresh' } })).toBe(1)
  })

  it('shares only the buckets where a multiplied limit would be a breach', () => {
    // Sign-in, sign-up, reset and checkout are counted in the database.
    expect(isShared('login')).toBe(true)
    expect(isShared('signup')).toBe(true)
    expect(isShared('passwordReset')).toBe(true)
    // Search and general writes stay in memory on purpose: a round trip per
    // request would cost more than the precision is worth.
    expect(isShared('search')).toBe(false)
    expect(isShared('write')).toBe(false)
  })
})
