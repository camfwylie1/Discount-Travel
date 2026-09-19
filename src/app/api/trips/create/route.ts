import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { tripSchema } from '@/lib/validation'
import { canInviteToTrip } from '@/lib/social/visibility'
import { track } from '@/lib/analytics/events'
import { flagDefaults } from '@/config/flags'

/**
 * A trip group is a plan around a deal. Voyaj does not book it, and the
 * interface never implies otherwise.
 */
export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  if (!flagDefaults.GROUP_TRIPS_ENABLED) return fail('Group trips are not available yet.', 403)

  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, tripSchema)
  if (!parsed.ok) return parsed.response
  const d = parsed.data

  const active = await prisma.tripGroup.count({
    where: { ownerId: auth.user.id, status: { in: ['IDEA', 'PLANNING', 'CONFIRMED'] } },
  })
  if (active >= 20) return fail('You already have a lot of trips in planning.', 422)

  if (d.dealId) {
    const deal = await prisma.deal.findUnique({ where: { id: d.dealId }, select: { id: true } })
    if (!deal) return fail('That trip no longer exists.', 404)
  }

  // Only invite people who permit it.
  const invitees: string[] = []
  for (const userId of d.inviteUserIds ?? []) {
    if (userId === auth.user.id) continue
    const { allowed } = await canInviteToTrip(auth.user.id, userId)
    if (allowed) invitees.push(userId)
  }

  const trip = await prisma.tripGroup.create({
    data: {
      ownerId: auth.user.id,
      dealId: d.dealId ?? null,
      name: d.name,
      description: d.description ?? null,
      status: 'PLANNING',
      targetStart: d.targetStart ? new Date(d.targetStart) : null,
      targetEnd: d.targetEnd ? new Date(d.targetEnd) : null,
      budgetMaxCents: d.budgetMaxCents ?? null,
      maxMembers: d.maxMembers ?? null,
      isPrivate: d.isPrivate ?? true,
      inviteToken: randomBytes(12).toString('base64url'),
      members: {
        create: [
          { userId: auth.user.id, state: 'CONFIRMED', isOrganiser: true },
          ...invitees.map((userId) => ({ userId, state: 'INVITED' as const })),
        ],
      },
    },
  })

  const conversation = await prisma.conversation.create({
    data: {
      kind: 'TRIP',
      tripId: trip.id,
      title: trip.name,
      members: { create: [auth.user.id, ...invitees].map((userId) => ({ userId })) },
    },
  })

  if (invitees.length > 0) {
    await prisma.notification.createMany({
      data: invitees.map((userId) => ({
        userId,
        kind: 'TRIP_INVITE' as const,
        title: `${auth.user.firstName ?? 'A traveller'} invited you to ${trip.name}`,
        linkUrl: `/trips/${trip.id}`,
        actorId: auth.user.id,
      })),
    })
  }

  await track('trip_created', { userId: auth.user.id, properties: { invitees: invitees.length, hasDeal: !!d.dealId } })

  return ok({ id: trip.id, name: trip.name, conversationId: conversation.id, invited: invitees.length }, 201)
})
