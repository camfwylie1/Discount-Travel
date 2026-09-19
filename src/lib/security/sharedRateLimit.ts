import 'server-only'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/observability/logger'
import { RATE_LIMITS, type RateLimitName, type RateLimitResult } from './rateLimit'

/**
 * SHARED RATE LIMITING
 *
 * An in-memory limiter counts per server instance, so two instances mean twice
 * the attempts. For a search limit that is a shrug. For sign-in it is the
 * difference between eight password guesses per quarter hour and eight times
 * however many instances happen to be running — a brute-force limit that
 * silently relaxes as you scale is worse than none, because it is trusted.
 *
 * These buckets are therefore counted in the database, which every instance
 * already shares. Everything else stays in process memory on purpose: those
 * limits exist to shed load and blunt abuse, and a round trip on each one
 * would cost more than the precision is worth.
 */
export const SHARED_BUCKETS = new Set<RateLimitName>([
  'login',
  'signup',
  'passwordReset',
  'checkout',
])

export function isShared(name: RateLimitName): boolean {
  return SHARED_BUCKETS.has(name)
}

/**
 * Counts one attempt against a shared window.
 *
 * FAILURE POSTURE: if the database cannot be reached this returns null, and
 * the caller falls back to the in-memory limiter. A limiter that hard-fails
 * takes sign-in down with it; one that quietly stops counting invites the
 * brute force it exists to stop. Falling back keeps a real limit in force on
 * each instance and is the least-bad of the three.
 */
export async function sharedRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitResult | null> {
  const rule = RATE_LIMITS[name]
  const key = `${name}:${identifier}`
  const since = new Date(Date.now() - rule.windowMs)

  // Roughly one call in two hundred also clears out spent counters. Doing it
  // here rather than on a schedule means the table maintains itself without a
  // cron job that someone has to deploy, monitor and remember.
  if (Math.random() < 0.005) void sweepSharedRateLimits()

  try {
    // Recorded before counting, so two instances racing cannot both see a
    // count below the limit and both allow. The attempt is what is limited,
    // not the successful attempt.
    await prisma.rateLimitHit.create({ data: { key } })

    const hits = await prisma.rateLimitHit.count({
      where: { key, occurredAt: { gte: since } },
    })

    if (hits > rule.limit) {
      const oldest = await prisma.rateLimitHit.findFirst({
        where: { key, occurredAt: { gte: since } },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true },
      })
      const elapsed = oldest ? Date.now() - oldest.occurredAt.getTime() : 0
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((rule.windowMs - elapsed) / 1000)),
      }
    }

    return { allowed: true, remaining: Math.max(0, rule.limit - hits), retryAfterSeconds: 0 }
  } catch (error) {
    logger.warn('ratelimit.shared_unavailable', { bucket: name, error: String(error) })
    return null
  }
}

/**
 * Drops counters that have aged out of every window.
 *
 * Called opportunistically rather than on a schedule, because a cron job is
 * one more thing to deploy and forget. The longest window is an hour, so
 * anything older than a day is certainly spent.
 */
export async function sweepSharedRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    const { count } = await prisma.rateLimitHit.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    })
    return count
  } catch {
    return 0
  }
}
