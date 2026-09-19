import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { scoreDeal, type ScoreDealOptions } from './dealScore'
import { scoreTravelers } from './travelerScore'
import { suggestRelaxation } from './constraints'
import { ENGINE_VERSION, type DealMatchResult, type DimensionMeta, type ScoreableDeal, type ScoreableUser, type TravelerMatchResult } from './types'

/**
 * RECOMMENDATION SERVICE
 *
 * The only file in this folder that touches the database. It loads the data
 * the pure engine needs, runs it, and caches the results.
 *
 * Performance approach: we score in memory rather than in SQL, because the
 * scoring is explainable and the candidate set is pre-filtered by cheap SQL
 * predicates (status, price ceiling, date window, airport). At marketplace
 * scale the candidate query gets tighter and scores are precomputed into
 * MatchScore by a background job — the engine itself does not change.
 */

export const DEAL_INCLUDE = {
  attributes: { select: { dimensionId: true, intensity: true, confidence: true } },
  departureAirport: { select: { id: true, iata: true, city: true, name: true, latitude: true, longitude: true } },
  arrivalAirport: { select: { iata: true, city: true } },
  provider: { select: { id: true, name: true, slug: true, logoUrl: true, websiteUrl: true, sponsored: true, qualityScore: true, compliance: { select: { attributionRequired: true, attributionText: true } } } },
  images: { orderBy: { sortOrder: 'asc' }, take: 5 },
  destinations: { include: { destination: { select: { id: true, slug: true, name: true, kind: true } } } },
  tags: { include: { tag: true } },
} as const

export const getDimensionMap = cache(async (): Promise<Map<string, DimensionMeta>> => {
  const dims = await prisma.preferenceDimension.findMany({ where: { active: true } })
  return new Map(
    dims.map((d) => [
      d.id,
      {
        id: d.id,
        key: d.key,
        label: d.label,
        category: d.category as DimensionMeta['category'],
        kind: d.kind as 'RATING' | 'SPECTRUM',
        engineWeight: d.engineWeight,
        radarAxis: d.radarAxis,
        poleLowLabel: d.poleLowLabel,
        poleHighLabel: d.poleHighLabel,
      },
    ]),
  )
})

export const getAirportCoordMap = cache(async () => {
  const airports = await prisma.airport.findMany({
    where: { isActive: true },
    select: { iata: true, latitude: true, longitude: true },
  })
  return new Map(airports.map((a) => [a.iata, { latitude: a.latitude, longitude: a.longitude }]))
})

/** Loads everything the engine needs about one traveller. */
export const getScoreableUser = cache(async (userId: string): Promise<ScoreableUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: { select: { dimensionId: true, rating: true, spectrum: true, peopleWeight: true } },
      constraints: true,
      airports: { include: { airport: { select: { iata: true, latitude: true, longitude: true } } } },
      wishlist: { select: { destinationId: true, destination: { select: { country: true } } } },
    },
  })
  if (!user) return null

  const now = Date.now()
  return {
    userId: user.id,
    preferences: user.preferences,
    constraints: user.constraints ?? {},
    airports: user.airports
      // A temporary departure city expires on its own.
      .filter((a) => !a.isTemporary || !a.temporaryUntil || a.temporaryUntil.getTime() > now)
      .map((a) => ({
        airportId: a.airportId,
        iata: a.airport.iata,
        rank: a.rank,
        latitude: a.airport.latitude,
        longitude: a.airport.longitude,
      })),
    wishlistCountries: user.wishlist
      .map((w) => w.destination?.country)
      .filter((c): c is string => !!c),
    wishlistDestinationIds: user.wishlist
      .map((w) => w.destinationId)
      .filter((d): d is string => !!d),
  }
})

export type DealWithRelations = Awaited<ReturnType<typeof loadDeals>>[number]

export async function loadDeals(where: object, take = 200, orderBy: object = { departureDate: 'asc' }) {
  return prisma.deal.findMany({
    where,
    include: DEAL_INCLUDE,
    take,
    orderBy,
  })
}

export function toScoreableDeal(deal: {
  id: string
  attributes: { dimensionId: string; intensity: number; confidence: number }[]
  salePriceCents: number | null
  currency: string
  airfareIncluded: boolean | null
  departureAirportId: string | null
  departureAirport: { iata: string } | null
  departureDate: Date | null
  returnDate: Date | null
  durationNights: number | null
  tripStyle: string[]
  destinationCountry: string | null
  destinations?: { destinationId: string }[]
  groupSizeMax: number | null
  accommodationQuality: number | null
  status: string
  expiresAt: Date | null
}): ScoreableDeal {
  return {
    dealId: deal.id,
    attributes: deal.attributes,
    salePriceCents: deal.salePriceCents,
    currency: deal.currency,
    airfareIncluded: deal.airfareIncluded,
    departureAirportId: deal.departureAirportId,
    departureAirportIata: deal.departureAirport?.iata ?? null,
    alternateDepartureIatas: [],
    departureDate: deal.departureDate,
    returnDate: deal.returnDate,
    durationNights: deal.durationNights,
    tripStyle: deal.tripStyle,
    destinationCountry: deal.destinationCountry,
    destinationIds: deal.destinations?.map((d) => d.destinationId) ?? [],
    groupSizeMax: deal.groupSizeMax,
    accommodationQuality: deal.accommodationQuality,
    status: deal.status,
    expiresAt: deal.expiresAt,
  }
}

export interface RankedDeal<T> {
  deal: T
  match: DealMatchResult
}

export interface RankOptions {
  /** Keep deals that fail hard constraints, flagged, instead of removing them. */
  includeFiltered?: boolean
  limit?: number
}

export interface RankResult<T> {
  ranked: RankedDeal<T>[]
  filteredOut: RankedDeal<T>[]
  /** The single change that would unlock the most extra trips. */
  relaxation: { key: string; label: string; suggestion: string; unlocks: number } | null
  totalConsidered: number
}

export async function rankDealsForUser<
  T extends Parameters<typeof toScoreableDeal>[0],
>(user: ScoreableUser, deals: T[], options: RankOptions = {}): Promise<RankResult<T>> {
  const [dimensions, airportCoords] = await Promise.all([getDimensionMap(), getAirportCoordMap()])
  const scoreOptions: ScoreDealOptions = { dimensions, airportCoords }

  const scored = deals.map((deal) => ({
    deal,
    match: scoreDeal(user, toScoreableDeal(deal), scoreOptions),
  }))

  const ranked = scored.filter((s) => s.match.passed).sort((a, b) => b.match.score - a.match.score)
  const filteredOut = scored.filter((s) => !s.match.passed)

  return {
    ranked: options.limit ? ranked.slice(0, options.limit) : ranked,
    filteredOut,
    relaxation: suggestRelaxation(filteredOut.map((f) => f.match.failures)),
    totalConsidered: deals.length,
  }
}

/**
 * Persists computed scores so explanations stay reproducible and the admin
 * portal can report on recommendation quality.
 */
export async function persistMatchScores(userId: string, results: RankedDeal<{ id: string }>[]) {
  if (results.length === 0) return
  await prisma.$transaction(
    results.slice(0, 120).map((r) =>
      prisma.matchScore.upsert({
        where: { userId_dealId: { userId, dealId: r.deal.id } },
        create: {
          userId,
          dealId: r.deal.id,
          score: r.match.score,
          components: r.match.components as object,
          reasons: r.match.reasons as object,
          mismatches: r.match.mismatches as object,
          hardFiltered: !r.match.passed,
          filterReason: r.match.failures[0]?.key ?? null,
          engineVersion: ENGINE_VERSION,
        },
        update: {
          score: r.match.score,
          components: r.match.components as object,
          reasons: r.match.reasons as object,
          mismatches: r.match.mismatches as object,
          hardFiltered: !r.match.passed,
          filterReason: r.match.failures[0]?.key ?? null,
          engineVersion: ENGINE_VERSION,
          computedAt: new Date(),
        },
      }),
    ),
  )
}

/** Scores one deal for one user. Used by the deal detail page. */
export async function scoreOneDeal(
  userId: string,
  deal: Parameters<typeof toScoreableDeal>[0],
): Promise<DealMatchResult | null> {
  const user = await getScoreableUser(userId)
  if (!user) return null
  const [dimensions, airportCoords] = await Promise.all([getDimensionMap(), getAirportCoordMap()])
  return scoreDeal(user, toScoreableDeal(deal), { dimensions, airportCoords })
}

// ─────────────────────────── PEOPLE MATCHING ────────────────────────────────

export interface RankedTraveler {
  userId: string
  match: TravelerMatchResult
}

/**
 * Finds compatible travellers. Respects blocks, discoverability and the
 * 18+ rule at the QUERY level, not in the interface — a profile that should
 * not be visible is never loaded in the first place.
 */
export async function findCompatibleTravelers(
  viewerId: string,
  options: { limit?: number; excludeConnected?: boolean } = {},
) {
  const viewer = await getScoreableUser(viewerId)
  if (!viewer) return []

  const [blocks, connections] = await Promise.all([
    prisma.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.connection.findMany({
      where: { OR: [{ requesterId: viewerId }, { addresseeId: viewerId }] },
      select: { requesterId: true, addresseeId: true, status: true },
    }),
  ])

  const excluded = new Set<string>([viewerId])
  for (const b of blocks) {
    excluded.add(b.blockerId)
    excluded.add(b.blockedId)
  }
  if (options.excludeConnected) {
    for (const c of connections) {
      excluded.add(c.requesterId)
      excluded.add(c.addresseeId)
    }
  }

  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: [...excluded] },
      status: 'ACTIVE',
      ageConfirmed18: true,
      onboardingComplete: true,
      privacy: { discoverable: true },
    },
    include: {
      profile: true,
      privacy: true,
      personality: { select: { title: true, topInterests: true, archetypeKey: true, radar: true } },
      preferences: { select: { dimensionId: true, rating: true, spectrum: true, peopleWeight: true } },
      constraints: true,
      wishlist: { select: { label: true, destinationId: true, destination: { select: { country: true, name: true } } } },
      airports: { include: { airport: { select: { iata: true, city: true } } } },
    },
    take: 200,
  })

  const dimensions = await getDimensionMap()
  const connectionStatus = new Map<string, string>()
  for (const c of connections) {
    const otherId = c.requesterId === viewerId ? c.addresseeId : c.requesterId
    connectionStatus.set(otherId, c.status)
  }

  const scored = candidates.map((candidate) => {
    const other: ScoreableUser = {
      userId: candidate.id,
      preferences: candidate.preferences,
      constraints: candidate.constraints ?? {},
      airports: candidate.airports.map((a) => ({ airportId: a.airportId, iata: a.airport.iata, rank: a.rank })),
      wishlistCountries: candidate.wishlist.map((w) => w.destination?.country).filter((c): c is string => !!c),
      wishlistDestinationIds: candidate.wishlist.map((w) => w.destinationId).filter((d): d is string => !!d),
    }
    return {
      user: candidate,
      match: scoreTravelers(viewer, other, { dimensions }),
      connectionStatus: connectionStatus.get(candidate.id) ?? null,
    }
  })

  return scored
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, options.limit ?? 24)
}

/** Compares exactly two travellers — the "Cameron + Sarah" view. */
export async function compareTravelers(userAId: string, userBId: string) {
  const [a, b, dimensions] = await Promise.all([
    getScoreableUser(userAId),
    getScoreableUser(userBId),
    getDimensionMap(),
  ])
  if (!a || !b) return null
  return scoreTravelers(a, b, { dimensions })
}

export async function persistTravelerMatch(userAId: string, userBId: string, match: TravelerMatchResult) {
  // Canonical ordering so the pair is stored once.
  const [first, second] = [userAId, userBId].sort()
  await prisma.travelerMatch.upsert({
    where: { userAId_userBId: { userAId: first!, userBId: second! } },
    create: {
      userAId: first!, userBId: second!, score: match.score,
      components: match.components as object, shared: match.shared as object,
      conflicts: match.conflicts as object, engineVersion: ENGINE_VERSION,
    },
    update: {
      score: match.score, components: match.components as object,
      shared: match.shared as object, conflicts: match.conflicts as object,
      computedAt: new Date(),
    },
  })
}
