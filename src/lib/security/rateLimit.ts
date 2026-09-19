import 'server-only'
import { createHash } from 'node:crypto'

/**
 * RATE LIMITING
 *
 * In-memory sliding window. Sufficient for a single-instance MVP and for the
 * automated tests. `RATE_LIMIT_DRIVER=redis` is the documented upgrade path
 * for multi-instance production (see SECURITY.md) — the interface below does
 * not change when that happens.
 */

interface Bucket {
  hits: number[]
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweep(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1]! > 3_600_000) {
      buckets.delete(key)
    }
  }
}

export interface RateLimitRule {
  /** Maximum requests allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  message: { limit: 60, windowMs: 60_000 },
  connectionRequest: { limit: 30, windowMs: 60 * 60_000 },
  upload: { limit: 12, windowMs: 60 * 60_000 },
  search: { limit: 120, windowMs: 60_000 },
  recompute: { limit: 10, windowMs: 60_000 },
  report: { limit: 15, windowMs: 60 * 60_000 },
  checkout: { limit: 10, windowMs: 15 * 60_000 },
  outboundClick: { limit: 200, windowMs: 60_000 },
  write: { limit: 240, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitName = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(name: RateLimitName, identifier: string): RateLimitResult {
  const rule = RATE_LIMITS[name]
  const now = Date.now()
  sweep(now)
  const key = `${name}:${identifier}`
  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < rule.windowMs)

  if (bucket.hits.length >= rule.limit) {
    const oldest = bucket.hits[0] ?? now
    buckets.set(key, bucket)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((rule.windowMs - (now - oldest)) / 1000)),
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return { allowed: true, remaining: rule.limit - bucket.hits.length, retryAfterSeconds: 0 }
}

/** Never store a raw IP address; a salted hash is enough for abuse control. */
export function hashIp(ip: string | null | undefined): string {
  const salt = process.env.AUTH_SECRET ?? 'voyaj'
  return createHash('sha256').update(`${salt}:${ip ?? 'unknown'}`).digest('hex').slice(0, 32)
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headers.get('x-real-ip') ?? '127.0.0.1'
}

/** Test helper — resets all windows. */
export function __resetRateLimits() {
  buckets.clear()
}
