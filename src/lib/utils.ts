import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "3 nights" / "1 night" without the classic off-by-one plural bug. */
export function plural(count: number, singular: string, pluralForm?: string) {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`
}

const DATE_FMT = new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })
const DATE_FMT_SHORT = new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short' })

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'Not specified'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return 'Not specified'
  return DATE_FMT.format(d)
}

export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  if (!start) return 'Dates not specified'
  const s = typeof start === 'string' ? new Date(start) : start
  if (!end) return DATE_FMT.format(s)
  const e = typeof end === 'string' ? new Date(end) : end
  const sameYear = s.getFullYear() === e.getFullYear()
  return sameYear
    ? `${DATE_FMT_SHORT.format(s)} – ${DATE_FMT.format(e)}`
    : `${DATE_FMT.format(s)} – ${DATE_FMT.format(e)}`
}

/** "Last checked 3 hours ago" — honest about data freshness. */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return 'never'
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${plural(days, 'day')} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${plural(months, 'month')} ago`
  return `${plural(Math.floor(months / 12), 'year')} ago`
}

export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

/** Anything the provider did not tell us renders as this, never as a guess. */
export const NOT_SPECIFIED = 'Not specified'

export function orNotSpecified<T>(value: T | null | undefined, format?: (v: T) => string): string {
  if (value === null || value === undefined || value === '') return NOT_SPECIFIED
  return format ? format(value) : String(value)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length - 1).trimEnd()}…`
}

/** Stable pseudo-random from a string — used for demo avatar tints, never for security. */
export function stableHash(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
