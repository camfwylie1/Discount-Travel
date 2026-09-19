import 'server-only'
import { prisma } from '@/lib/db'

/**
 * SOCIAL PROOF
 *
 * Every figure here is counted from real rows. We never invent popularity,
 * and we never expose who did something — only how many, and only above a
 * threshold that protects individual privacy.
 */

/** Below this, a count could identify a specific person, so we say nothing. */
const MIN_COUNT_TO_SHOW = 3

export interface DealSocialProof {
  /** "17 travellers with similar preferences saved this" */
  similarTravellersSaved: number | null
  /** "6 people in your circles are interested" */
  circleInterest: number | null
  /** How many of the viewer's connections have saved it. */
  connectionsSaved: number | null
}

export async function getDealSocialProof(dealId: string, viewerId: string): Promise<DealSocialProof> {
  const [totalSaves, connections, circleMembers] = await Promise.all([
    prisma.savedDeal.count({
      where: { dealId, state: { in: ['SAVED', 'INTERESTED', 'PLANNING', 'BOOKED'] } },
    }),
    prisma.connection.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
      },
      select: { requesterId: true, addresseeId: true },
    }),
    prisma.circleMember.findMany({
      where: { circle: { ownerId: viewerId } },
      select: { userId: true },
    }),
  ])

  const connectionIds = connections.map((c) => (c.requesterId === viewerId ? c.addresseeId : c.requesterId))
  const circleIds = [...new Set(circleMembers.map((m) => m.userId))]

  const [connectionSaves, circleSaves] = await Promise.all([
    connectionIds.length > 0
      ? prisma.savedDeal.count({ where: { dealId, userId: { in: connectionIds } } })
      : Promise.resolve(0),
    circleIds.length > 0
      ? prisma.savedDeal.count({
          where: { dealId, userId: { in: circleIds }, state: { in: ['INTERESTED', 'PLANNING', 'BOOKED'] } },
        })
      : Promise.resolve(0),
  ])

  return {
    similarTravellersSaved: totalSaves >= MIN_COUNT_TO_SHOW ? totalSaves : null,
    // Connection and circle counts are about the viewer's own people, so a
    // lower threshold is appropriate — but never zero, and never a name.
    connectionsSaved: connectionSaves > 0 ? connectionSaves : null,
    circleInterest: circleSaves > 0 ? circleSaves : null,
  }
}

/** Trips the viewer's circles have saved. Powers a feed section. */
export async function getCircleSavedDeals(viewerId: string, limit = 8) {
  const circleMembers = await prisma.circleMember.findMany({
    where: { circle: { ownerId: viewerId } },
    select: { userId: true },
  })
  const memberIds = [...new Set(circleMembers.map((m) => m.userId))].filter((id) => id !== viewerId)
  if (memberIds.length === 0) return []

  const saves = await prisma.savedDeal.groupBy({
    by: ['dealId'],
    where: {
      userId: { in: memberIds },
      state: { in: ['SAVED', 'INTERESTED', 'PLANNING'] },
      deal: { status: 'ACTIVE' },
    },
    _count: { dealId: true },
    orderBy: { _count: { dealId: 'desc' } },
    take: limit,
  })

  return saves.map((s) => ({ dealId: s.dealId, count: s._count.dealId }))
}
