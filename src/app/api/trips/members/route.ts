import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { tripMemberSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'

export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, tripMemberSchema)
  if (!parsed.ok) return parsed.response
  const { tripId, action } = parsed.data

  const trip = await prisma.tripGroup.findUnique({
    where: { id: tripId },
    include: { members: { select: { userId: true, state: true } }, _count: { select: { members: true } } },
  })
  if (!trip) return fail('That trip no longer exists.', 404)

  const existing = trip.members.find((m) => m.userId === auth.user.id)

  // A private trip can only be joined by someone who was invited.
  if (!existing && trip.isPrivate) {
    return fail('That trip is private. Ask the organiser for an invitation.', 403)
  }
  if (!existing && trip.maxMembers && trip._count.members >= trip.maxMembers) {
    return fail('That trip is full.', 422)
  }

  const stateFor = {
    JOIN: 'CONFIRMED',
    CONFIRM: 'CONFIRMED',
    INTERESTED: 'INTERESTED',
    LEAVE: 'LEFT',
    DECLINE: 'DECLINED',
  } as const
  const state = stateFor[action]

  // The organiser cannot leave their own trip without transferring it.
  if (state === 'LEFT' && trip.ownerId === auth.user.id) {
    return fail('You organise this trip. Cancel it instead, or hand it to someone else.', 422)
  }

  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId, userId: auth.user.id } },
    create: { tripId, userId: auth.user.id, state },
    update: { state },
  })

  const conversation = await prisma.conversation.findUnique({ where: { tripId } })
  if (conversation) {
    if (state === 'LEFT' || state === 'DECLINED') {
      await prisma.conversationMember.updateMany({
        where: { conversationId: conversation.id, userId: auth.user.id },
        data: { leftAt: new Date() },
      })
    } else {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: auth.user.id } },
        create: { conversationId: conversation.id, userId: auth.user.id },
        update: { leftAt: null },
      })
    }
  }

  if (state === 'CONFIRMED' && !existing) {
    await prisma.notification.create({
      data: {
        userId: trip.ownerId,
        kind: 'TRIP_JOINED',
        title: `${auth.user.firstName ?? 'A traveller'} joined ${trip.name}`,
        linkUrl: `/trips/${tripId}`,
        actorId: auth.user.id,
      },
    })
    await track('trip_joined', { userId: auth.user.id, properties: { tripId } })
  }

  return ok({ state })
})
