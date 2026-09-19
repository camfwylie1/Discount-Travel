import 'server-only'
import { prisma } from '@/lib/db'

/**
 * VISIBILITY & BLOCKING
 *
 * One place decides what one member may see of another. Every social query
 * goes through here, so a privacy setting can never be honoured on one screen
 * and forgotten on the next.
 *
 * The rule: a block is mutual and total. If either party has blocked the
 * other, neither sees the other anywhere in the product.
 */

export type Relationship = 'self' | 'connected' | 'pending' | 'none' | 'blocked'

export async function getRelationship(viewerId: string, targetId: string): Promise<Relationship> {
  if (viewerId === targetId) return 'self'

  const [block, connection] = await Promise.all([
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
      select: { id: true },
    }),
    prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: viewerId },
        ],
      },
      select: { status: true },
    }),
  ])

  if (block) return 'blocked'
  if (connection?.status === 'ACCEPTED') return 'connected'
  if (connection?.status === 'PENDING') return 'pending'
  return 'none'
}

export interface VisibilityRules {
  profileVisibility: string
  photoVisibility: string
  ageVisibility: string
  cityVisibility: string
  wishlistVisibility: string
  savedDealsVisibility: string
  upcomingTripVisibility: string
}

/** Applies one visibility setting against the viewer's relationship. */
export function canSee(setting: string, relationship: Relationship): boolean {
  if (relationship === 'blocked') return false
  if (relationship === 'self') return true
  if (setting === 'PUBLIC') return true
  if (setting === 'CONNECTIONS') return relationship === 'connected'
  return false
}

/** Every user id the viewer must never see. Used to filter queries at source. */
export async function getBlockedUserIds(viewerId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  })
  const ids = new Set<string>()
  for (const block of blocks) {
    ids.add(block.blockerId === viewerId ? block.blockedId : block.blockerId)
  }
  return [...ids]
}

/** May the viewer send this member a message? */
export async function canMessage(
  viewerId: string,
  targetId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (viewerId === targetId) return { allowed: false, reason: 'You cannot message yourself.' }

  const relationship = await getRelationship(viewerId, targetId)
  if (relationship === 'blocked') {
    // Deliberately vague — confirming a block invites harassment.
    return { allowed: false, reason: 'You cannot message this member.' }
  }

  const [target, viewer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetId },
      select: { status: true, privacy: { select: { whoCanMessage: true } } },
    }),
    prisma.user.findUnique({ where: { id: viewerId }, select: { emailVerifiedAt: true } }),
  ])

  if (!target || target.status !== 'ACTIVE') {
    return { allowed: false, reason: 'That member is not available.' }
  }
  // A confirmed email address is required before contacting anyone. This is
  // the cheapest, most effective anti-spam control we have.
  if (!viewer?.emailVerifiedAt) {
    return { allowed: false, reason: 'Confirm your email address before messaging other travellers.' }
  }

  const setting = target.privacy?.whoCanMessage ?? 'CONNECTIONS'
  if (setting === 'NOBODY') {
    return { allowed: false, reason: 'This member is not accepting messages.' }
  }
  if (setting === 'CONNECTIONS' && relationship !== 'connected') {
    return { allowed: false, reason: 'You need to be connected before you can message each other.' }
  }
  return { allowed: true }
}

export async function canInviteToTrip(
  viewerId: string,
  targetId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const relationship = await getRelationship(viewerId, targetId)
  if (relationship === 'blocked') return { allowed: false, reason: 'You cannot invite this member.' }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { status: true, privacy: { select: { whoCanInviteToTrips: true } } },
  })
  if (!target || target.status !== 'ACTIVE') {
    return { allowed: false, reason: 'That member is not available.' }
  }
  const setting = target.privacy?.whoCanInviteToTrips ?? 'CONNECTIONS'
  if (setting === 'NOBODY') return { allowed: false, reason: 'This member is not accepting trip invitations.' }
  if (setting === 'CONNECTIONS' && relationship !== 'connected') {
    return { allowed: false, reason: 'You need to be connected first.' }
  }
  return { allowed: true }
}

/** May the viewer read this conversation? Membership is the only answer. */
export async function canAccessConversation(viewerId: string, conversationId: string): Promise<boolean> {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: viewerId } },
    select: { leftAt: true },
  })
  return !!membership && !membership.leftAt
}
