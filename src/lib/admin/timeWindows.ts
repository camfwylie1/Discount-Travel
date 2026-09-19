/**
 * TIME WINDOWS FOR THE ADMIN DASHBOARDS
 *
 * The admin pages ask the same questions of the clock — "what has not been
 * re-checked recently?", "what expires soon?", "how many signed up in the last
 * 30 days?" — and were each answering them with their own inline arithmetic.
 * Three copies of `72 * 3_600_000` is three chances to disagree about what
 * "stale" means, and a number no reader can check at a glance.
 *
 * These are plain functions rather than values so that every request reads the
 * clock afresh, and so a test can pass its own `now` instead of waiting.
 */

const HOUR = 3_600_000
const DAY = 86_400_000

/**
 * How long a deal may go without its source being re-checked before we treat
 * its price as unproven. Deliberately short: a stale price shown as current is
 * the single most damaging thing this product could get wrong.
 */
export const STALE_AFTER_HOURS = 72

/** How far ahead "expiring soon" looks. */
export const EXPIRING_SOON_DAYS = 7

/** The cutoff before which a deal counts as stale. */
export function staleBefore(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_AFTER_HOURS * HOUR)
}

/** The window in which an active deal is about to expire. */
export function expiringSoonWindow(now: Date = new Date()): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY) }
}

/** The moment `days` days ago, for "new in the last N days" counts. */
export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY)
}
