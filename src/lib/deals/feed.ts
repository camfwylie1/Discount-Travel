import 'server-only'
import { prisma } from '@/lib/db'
import {
  getScoreableUser, loadDeals, persistMatchScores, rankDealsForUser,
  type RankedDeal,
} from '@/lib/recommendations/service'
import type { DealCardData } from '@/components/deals/DealCard'
import type { MatchReason } from '@/lib/recommendations/types'

/**
 * THE PERSONALISED FEED
 *
 * Sections are computed from ONE ranked pass over the candidate set, not one
 * query per section — so adding a section costs nothing extra.
 *
 * Every section is defined by a predicate over the already-scored results,
 * which keeps the ordering honest: a trip in "Under $1,500" is still ranked
 * by how well it matches you.
 */

export interface FeedDeal {
  deal: DealCardData
  score: number
  reasons: MatchReason[]
  saved: boolean
}

export interface FeedSection {
  key: string
  title: string
  description?: string
  deals: FeedDeal[]
  href?: string
}

export interface FeedResult {
  sections: FeedSection[]
  topMatches: FeedDeal[]
  totalCandidates: number
  totalPassing: number
  relaxation: { key: string; label: string; suggestion: string; unlocks: number } | null
  homeAirports: string[]
}

const CANDIDATE_LIMIT = 400

export async function buildFeed(userId: string): Promise<FeedResult> {
  const user = await getScoreableUser(userId)
  if (!user) {
    return { sections: [], topMatches: [], totalCandidates: 0, totalPassing: 0, relaxation: null, homeAirports: [] }
  }

  const [deals, savedRows] = await Promise.all([
    loadDeals(
      {
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        departureDate: { gte: new Date() },
      },
      CANDIDATE_LIMIT,
      { departureDate: 'asc' },
    ),
    prisma.savedDeal.findMany({ where: { userId }, select: { dealId: true } }),
  ])

  const savedIds = new Set(savedRows.map((s) => s.dealId))
  const { ranked, relaxation } = await rankDealsForUser(user, deals)

  // Persist in the background so explanations stay reproducible; never block
  // the page render on it.
  void persistMatchScores(userId, ranked as RankedDeal<{ id: string }>[]).catch(() => {})

  const all: FeedDeal[] = ranked.map((r) => ({
    deal: toCardData(r.deal),
    score: r.match.score,
    reasons: r.match.reasons,
    saved: savedIds.has(r.deal.id),
  }))

  const homeAirports = user.airports.slice(0, 2).map((a) => a.iata)
  const sections = buildSections(all, homeAirports)

  return {
    sections,
    topMatches: all.slice(0, 12),
    totalCandidates: deals.length,
    totalPassing: ranked.length,
    relaxation,
    homeAirports,
  }
}

const DAY = 86_400_000

function buildSections(all: FeedDeal[], homeAirports: string[]): FeedSection[] {
  const sections: FeedSection[] = []
  const used = new Set<string>()

  /** Takes the best N matching a predicate, preferring unseen trips. */
  const take = (predicate: (d: FeedDeal) => boolean, limit = 8, allowRepeat = false) => {
    const out: FeedDeal[] = []
    for (const item of all) {
      if (out.length >= limit) break
      if (!allowRepeat && used.has(item.deal.id)) continue
      if (!predicate(item)) continue
      out.push(item)
      used.add(item.deal.id)
    }
    return out
  }

  const push = (section: Omit<FeedSection, 'deals'> & { deals: FeedDeal[] }, min = 3) => {
    if (section.deals.length >= min) sections.push(section)
  }

  // Leaving soon from the traveller's own airport
  if (homeAirports.length > 0) {
    const iata = homeAirports[0]!
    push({
      key: 'leaving-soon',
      title: `Leaving ${cityFor(all, iata) ?? iata} soon`,
      description: 'In the next three months, ranked for you.',
      deals: take(
        (d) =>
          d.deal.departureAirport?.iata === iata &&
          !!d.deal.departureDate &&
          d.deal.departureDate.getTime() < Date.now() + 90 * DAY,
      ),
      href: `/search?airports=${iata}`,
    })
  }

  push({
    key: 'under-1500',
    title: 'Under $1,500',
    description: 'Good trips that do not cost much.',
    deals: take((d) => (d.deal.salePriceCents ?? Infinity) < 150_000),
    href: '/search?maxPrice=150000',
  })

  push({
    key: 'weekend',
    title: 'Weekend escapes',
    description: 'Four nights or fewer.',
    deals: take((d) => (d.deal.durationNights ?? 99) <= 4),
    href: '/search?durationBucket=weekend',
  })

  push({
    key: 'biggest-discounts',
    title: 'Biggest discounts',
    description: 'Discounts as stated by the provider. We show what we can verify.',
    deals: take((d) => (d.deal.discountPercent ?? 0) >= 15),
    href: '/search?sort=discount',
  })

  push({
    key: 'great-value',
    title: 'Best value for money',
    description: 'Judged on inclusions and cost per night — separately from how well they match you.',
    deals: take((d) => (d.deal.valueScore ?? 0) >= 70),
    href: '/search?sort=value',
  })

  push({
    key: 'last-minute',
    title: 'Last minute',
    description: 'Departing within eight weeks.',
    deals: take(
      (d) => !!d.deal.departureDate && d.deal.departureDate.getTime() < Date.now() + 56 * DAY,
    ),
  })

  push({
    key: 'longer-trips',
    title: 'Worth taking the time off for',
    description: 'Ten nights or more.',
    deals: take((d) => (d.deal.durationNights ?? 0) >= 10),
  })

  // Anything strong that has not appeared in a section above.
  push({
    key: 'more-for-you',
    title: 'More trips for you',
    deals: take((d) => d.score >= 55, 12),
  })

  return sections.filter((s) => s.deals.length >= 3)
}

function cityFor(deals: FeedDeal[], iata: string): string | null {
  return deals.find((d) => d.deal.departureAirport?.iata === iata)?.deal.departureAirport?.city ?? null
}

/** Narrows a Prisma deal row to exactly what the card needs. */
export function toCardData(deal: {
  id: string
  slug: string
  normalizedTitle: string
  destinationCity: string | null
  destinationRegion: string | null
  destinationCountry: string | null
  continent: string | null
  departureDate: Date | null
  returnDate: Date | null
  durationNights: number | null
  salePriceCents: number | null
  regularPriceCents: number | null
  discountPercent: number | null
  currency: string
  airfareIncluded: boolean | null
  status: string
  tripStyle: string[]
  valueScore: number | null
  sourceLastCheckedAt: Date | null
  isDemoContent: boolean
  spotsRemaining: number | null
  provider: { name: string; slug: string; logoUrl: string | null; sponsored: boolean }
  departureAirport: { iata: string; city: string } | null
  images: { url: string; alt: string | null }[]
}): DealCardData {
  return {
    id: deal.id,
    slug: deal.slug,
    normalizedTitle: deal.normalizedTitle,
    destinationCity: deal.destinationCity,
    destinationRegion: deal.destinationRegion,
    destinationCountry: deal.destinationCountry,
    continent: deal.continent,
    departureDate: deal.departureDate,
    returnDate: deal.returnDate,
    durationNights: deal.durationNights,
    salePriceCents: deal.salePriceCents,
    regularPriceCents: deal.regularPriceCents,
    discountPercent: deal.discountPercent,
    currency: deal.currency,
    airfareIncluded: deal.airfareIncluded,
    status: deal.status,
    tripStyle: deal.tripStyle,
    valueScore: deal.valueScore,
    sourceLastCheckedAt: deal.sourceLastCheckedAt,
    isDemoContent: deal.isDemoContent,
    spotsRemaining: deal.spotsRemaining,
    provider: deal.provider,
    departureAirport: deal.departureAirport,
    images: deal.images.map((i) => ({ url: i.url, alt: i.alt })),
  }
}
