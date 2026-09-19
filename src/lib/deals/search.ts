import 'server-only'
import { prisma } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'
import type { DealFilters } from '@/lib/validation'
import { DEAL_INCLUDE, getScoreableUser, rankDealsForUser } from '@/lib/recommendations/service'
import { toCardData } from './feed'
import type { DealCardData } from '@/components/deals/DealCard'
import type { MatchReason } from '@/lib/recommendations/types'
import { parseQuery, type ParsedQuery } from './queryParser'

/**
 * SEARCH
 *
 * Cheap SQL predicates narrow the candidate set; the recommendation engine
 * then ranks what survives. That keeps the database doing what it is good at
 * and the engine doing what only it can do — explain itself.
 */

export const PAGE_SIZE = 24

export const DURATION_BUCKETS: Record<string, { min: number; max: number; label: string }> = {
  weekend: { min: 1, max: 3, label: 'Weekend' },
  '2-3': { min: 2, max: 3, label: '2–3 nights' },
  '4-6': { min: 4, max: 6, label: '4–6 nights' },
  '7': { min: 7, max: 7, label: '1 week' },
  '8-10': { min: 8, max: 10, label: '8–10 nights' },
  '11-14': { min: 11, max: 14, label: '11–14 nights' },
  '15-21': { min: 15, max: 21, label: '15–21 nights' },
  '22-30': { min: 22, max: 30, label: '22–30 nights' },
}

export interface SearchResult {
  deals: { deal: DealCardData; score?: number; reasons?: MatchReason[]; saved: boolean }[]
  total: number
  page: number
  pageCount: number
  appliedFilters: number
  /** What to relax when nothing matched. */
  relaxation: { key: string; label: string; suggestion: string; unlocks: number } | null
  /** Plain-English readback of what we understood from a typed query. */
  understood: string[]
  /**
   * When nothing matched, this says whether it was the filters themselves or
   * the traveller's own hard constraints that ruled everything out — the two
   * need completely different advice.
   */
  emptyReason: 'no-candidates' | 'all-filtered' | null
  facets: {
    countries: { code: string; count: number }[]
    airports: { iata: string; city: string; count: number }[]
    priceRange: { min: number; max: number } | null
  }
}

/**
 * One search term, matched across everything a traveller might mean by it —
 * a destination, an activity, a provider, a trip style or a tag.
 */
function termClause(term: string): Prisma.DealWhereInput {
  const hyphenated = term.replace(/\s+/g, '-')
  return {
    OR: [
      { normalizedTitle: { contains: term, mode: 'insensitive' } },
      { originalTitle: { contains: term, mode: 'insensitive' } },
      { originalDescription: { contains: term, mode: 'insensitive' } },
      { aiSummary: { contains: term, mode: 'insensitive' } },
      { destinationCity: { contains: term, mode: 'insensitive' } },
      { destinationRegion: { contains: term, mode: 'insensitive' } },
      { continent: { contains: term, mode: 'insensitive' } },
      { accommodationType: { contains: term, mode: 'insensitive' } },
      { highlights: { hasSome: [term, capitalise(term)] } },
      { tripStyle: { hasSome: [term, hyphenated] } },
      { provider: { name: { contains: term, mode: 'insensitive' } } },
      { destinations: { some: { destination: { name: { contains: term, mode: 'insensitive' } } } } },
      { destinations: { some: { destination: { countryName: { contains: term, mode: 'insensitive' } } } } },
      { tags: { some: { tag: { label: { contains: term, mode: 'insensitive' } } } } },
      {
        attributes: {
          some: {
            dimension: { label: { contains: term, mode: 'insensitive' } },
            intensity: { gte: 0.5 },
          },
        },
      },
      ...(term.length === 2 ? [{ destinationCountry: { equals: term.toUpperCase() } }] : []),
    ],
  }
}

function capitalise(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export async function buildWhere(
  filters: DealFilters,
  options: { userAirports?: string[]; parsed?: ParsedQuery } = {},
): Promise<Prisma.DealWhereInput> {
  const where: Prisma.DealWhereInput = {
    status: 'ACTIVE',
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  }
  const and: Prisma.DealWhereInput[] = []
  const parsed = options.parsed

  // ── Free text. Every term must match SOMETHING, so "hiking Italy" means
  // hiking AND Italy rather than the literal phrase "hiking Italy".
  for (const term of parsed?.terms ?? []) {
    and.push(termClause(term))
  }

  // Explicit filters always win over anything inferred from the typed query.
  const minPrice = filters.minPrice ?? parsed?.minPriceCents
  const maxPrice = filters.maxPrice ?? parsed?.maxPriceCents
  if (minPrice !== undefined) and.push({ salePriceCents: { gte: minPrice } })
  if (maxPrice !== undefined) and.push({ salePriceCents: { lte: maxPrice } })

  const airports = filters.airports?.length
    ? filters.airports
    : (parsed?.airports ?? options.userAirports)
  if (airports?.length) {
    and.push({ departureAirport: { iata: { in: airports } } })
  }

  if (filters.countries?.length) and.push({ destinationCountry: { in: filters.countries } })
  if (filters.continents?.length) and.push({ continent: { in: filters.continents } })
  if (filters.destinationSlug) {
    and.push({ destinations: { some: { destination: { slug: filters.destinationSlug } } } })
  }

  const bucketKey = filters.durationBucket ?? parsed?.durationBucket
  const bucket = bucketKey ? DURATION_BUCKETS[bucketKey] : null
  if (bucket) {
    and.push({ durationNights: { gte: bucket.min, lte: bucket.max } })
  } else {
    if (filters.durationMin !== undefined) and.push({ durationNights: { gte: filters.durationMin } })
    if (filters.durationMax !== undefined) and.push({ durationNights: { lte: filters.durationMax } })
  }

  if (filters.dateFrom) and.push({ departureDate: { gte: new Date(filters.dateFrom) } })
  if (filters.dateTo) and.push({ departureDate: { lte: new Date(filters.dateTo) } })
  else and.push({ departureDate: { gte: new Date() } })

  if (filters.tripTypes?.length) and.push({ tripStyle: { hasSome: filters.tripTypes } })
  if (filters.tags?.length) and.push({ tags: { some: { tag: { slug: { in: filters.tags } } } } })
  if (filters.airfareIncluded) and.push({ airfareIncluded: true })
  if (filters.soloFriendly) and.push({ soloFriendly: true })
  if (filters.providers?.length) and.push({ provider: { slug: { in: filters.providers } } })

  if (and.length > 0) where.AND = and
  return where
}

/** Months are filtered in memory — a month-of-year predicate cannot use an index. */
function matchesMonths(date: Date | null, months?: number[]): boolean {
  if (!months?.length) return true
  if (!date) return false
  return months.includes(date.getUTCMonth() + 1)
}

export async function searchDeals(
  filters: DealFilters,
  userId: string | null,
): Promise<SearchResult> {
  const page = filters.page ?? 1
  const user = userId ? await getScoreableUser(userId) : null

  const parsed = filters.q ? parseQuery(filters.q) : undefined
  const where = await buildWhere(filters, { parsed })

  const [rows, savedRows] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: DEAL_INCLUDE,
      // Take a generous slice so in-memory ranking has something to work with.
      take: 500,
      orderBy: sqlOrder(filters.sort),
    }),
    userId
      ? prisma.savedDeal.findMany({ where: { userId }, select: { dealId: true } })
      : Promise.resolve([]),
  ])

  const months = filters.months?.length ? filters.months : parsed?.months
  const monthFiltered = rows.filter((d) => matchesMonths(d.departureDate, months))
  const savedIds = new Set(savedRows.map((s) => s.dealId))

  let ordered: { deal: (typeof rows)[number]; score?: number; reasons?: MatchReason[] }[]
  let relaxation: SearchResult['relaxation'] = null

  if (user && (filters.sort ?? 'match') === 'match') {
    const ranked = await rankDealsForUser(user, monthFiltered)
    relaxation = ranked.relaxation
    ordered = ranked.ranked.map((r) => ({ deal: r.deal, score: r.match.score, reasons: r.match.reasons }))
  } else if (user) {
    // Still attach scores so cards can show them, but keep the chosen order.
    const ranked = await rankDealsForUser(user, monthFiltered, { includeFiltered: true })
    const byId = new Map(ranked.ranked.map((r) => [r.deal.id, r.match]))
    relaxation = ranked.relaxation
    ordered = monthFiltered
      .filter((d) => byId.has(d.id))
      .map((deal) => ({ deal, score: byId.get(deal.id)?.score, reasons: byId.get(deal.id)?.reasons }))
  } else {
    ordered = monthFiltered.map((deal) => ({ deal }))
  }

  ordered = applySort(ordered, filters.sort)

  const total = ordered.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const slice = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return {
    deals: slice.map((item) => ({
      deal: toCardData(item.deal),
      score: item.score,
      reasons: item.reasons,
      saved: savedIds.has(item.deal.id),
    })),
    total,
    page,
    pageCount,
    appliedFilters: countFilters(filters),
    relaxation,
    understood: parsed?.understood ?? [],
    emptyReason:
      total > 0 ? null : monthFiltered.length === 0 ? 'no-candidates' : 'all-filtered',
    facets: buildFacets(monthFiltered),
  }
}

function sqlOrder(sort?: string): Prisma.DealOrderByWithRelationInput {
  switch (sort) {
    case 'price-asc':
      return { salePriceCents: 'asc' }
    case 'price-desc':
      return { salePriceCents: 'desc' }
    case 'date':
      return { departureDate: 'asc' }
    case 'newest':
      return { createdAt: 'desc' }
    case 'discount':
      return { discountPercent: 'desc' }
    case 'value':
      return { valueScore: 'desc' }
    default:
      return { departureDate: 'asc' }
  }
}

function applySort<T extends { deal: { salePriceCents: number | null; departureDate: Date | null; discountPercent: number | null; valueScore: number | null; createdAt: Date }; score?: number }>(
  items: T[],
  sort?: string,
): T[] {
  const copy = [...items]
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => (a.deal.salePriceCents ?? Infinity) - (b.deal.salePriceCents ?? Infinity))
    case 'price-desc':
      return copy.sort((a, b) => (b.deal.salePriceCents ?? -1) - (a.deal.salePriceCents ?? -1))
    case 'date':
      return copy.sort(
        (a, b) => (a.deal.departureDate?.getTime() ?? Infinity) - (b.deal.departureDate?.getTime() ?? Infinity),
      )
    case 'discount':
      return copy.sort((a, b) => (b.deal.discountPercent ?? 0) - (a.deal.discountPercent ?? 0))
    case 'value':
      return copy.sort((a, b) => (b.deal.valueScore ?? 0) - (a.deal.valueScore ?? 0))
    case 'newest':
      return copy.sort((a, b) => b.deal.createdAt.getTime() - a.deal.createdAt.getTime())
    default:
      // Already ranked by match where a user is present.
      return copy
  }
}

function countFilters(filters: DealFilters): number {
  let count = 0
  if (filters.q) count++
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++
  if (filters.airports?.length) count++
  if (filters.countries?.length || filters.continents?.length || filters.destinationSlug) count++
  if (filters.durationBucket || filters.durationMin || filters.durationMax) count++
  if (filters.months?.length || filters.dateFrom || filters.dateTo) count++
  if (filters.tripTypes?.length) count++
  if (filters.tags?.length) count++
  if (filters.airfareIncluded) count++
  if (filters.soloFriendly) count++
  if (filters.providers?.length) count++
  return count
}

function buildFacets(rows: { destinationCountry: string | null; departureAirport: { iata: string; city: string } | null; salePriceCents: number | null }[]) {
  const countries = new Map<string, number>()
  const airports = new Map<string, { city: string; count: number }>()
  let min = Infinity
  let max = 0

  for (const row of rows) {
    if (row.destinationCountry) {
      countries.set(row.destinationCountry, (countries.get(row.destinationCountry) ?? 0) + 1)
    }
    if (row.departureAirport) {
      const entry = airports.get(row.departureAirport.iata) ?? { city: row.departureAirport.city, count: 0 }
      entry.count += 1
      airports.set(row.departureAirport.iata, entry)
    }
    if (row.salePriceCents !== null) {
      min = Math.min(min, row.salePriceCents)
      max = Math.max(max, row.salePriceCents)
    }
  }

  return {
    countries: [...countries.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    airports: [...airports.entries()]
      .map(([iata, v]) => ({ iata, city: v.city, count: v.count }))
      .sort((a, b) => b.count - a.count),
    priceRange: Number.isFinite(min) && max > 0 ? { min, max } : null,
  }
}
