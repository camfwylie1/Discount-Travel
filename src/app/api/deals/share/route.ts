import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { shareDealSchema, shareResponseSchema } from '@/lib/validation'
import { getRelationship } from '@/lib/social/visibility'
import { track, trackRecommendation } from '@/lib/analytics/events'

export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, shareDealSchema)
  if (!parsed.ok) return parsed.response
  const { dealId, target, recipientId, circleId, tripId, message } = parsed.data

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, normalizedTitle: true },
  })
  if (!deal) return fail('That trip no longer exists.', 404)

  // ── Authorisation per target type. The server decides, every time.
  if (target === 'USER') {
    if (!recipientId) return fail('Choose someone to send it to.', 422)
    const relationship = await getRelationship(auth.user.id, recipientId)
    if (relationship === 'blocked') return fail('You cannot share with this member.', 403)
    if (relationship !== 'connected') {
      return fail('You can only share trips with people you are connected to.', 403)
    }
  } else if (target === 'CIRCLE') {
    if (!circleId) return fail('Choose a circle.', 422)
    const circle = await prisma.circle.findFirst({
      where: { id: circleId, ownerId: auth.user.id },
      select: { id: true, name: true },
    })
    if (!circle) return fail('That is not one of your circles.', 403)
  } else if (target === 'TRIP') {
    if (!tripId) return fail('Choose a trip.', 422)
    const member = await prisma.tripMember.findFirst({
      where: { tripId, userId: auth.user.id, state: { notIn: ['LEFT', 'DECLINED'] } },
      select: { id: true },
    })
    if (!member) return fail('You are not part of that trip.', 403)
  }

  const share = await prisma.dealShare.create({
    data: {
      dealId,
      senderId: auth.user.id,
      target,
      recipientId: target === 'USER' ? recipientId : null,
      circleId: target === 'CIRCLE' ? circleId : null,
      tripId: target === 'TRIP' ? tripId : null,
      message: message ?? null,
      shareToken: target === 'LINK' ? randomBytes(12).toString('base64url') : null,
    },
  })

  // ── Notify the right people, and post into the right conversation.
  const senderName = auth.user.firstName ?? 'A traveller'

  if (target === 'USER' && recipientId) {
    await prisma.notification.create({
      data: {
        userId: recipientId,
        kind: 'DEAL_SHARED',
        title: `${senderName} sent you a trip`,
        body: deal.normalizedTitle,
        linkUrl: `/deals/${dealId}`,
        actorId: auth.user.id,
        data: { shareId: share.id },
      },
    })
    // Also drop it into their direct conversation so it is not lost.
    const directKey = [auth.user.id, recipientId].sort().join(':')
    const conversation = await prisma.conversation.upsert({
      where: { directKey },
      create: {
        kind: 'DIRECT',
        directKey,
        members: { create: [{ userId: auth.user.id }, { userId: recipientId }] },
      },
      update: {},
    })
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: auth.user.id,
        body: message?.trim() || `Have a look at this: ${deal.normalizedTitle}`,
        attachment: { kind: 'DEAL', dealId },
      },
    })
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })
  }

  if (target === 'CIRCLE' && circleId) {
    const members = await prisma.circleMember.findMany({
      where: { circleId },
      select: { userId: true },
    })
    await prisma.notification.createMany({
      data: members
        .filter((m) => m.userId !== auth.user.id)
        .map((m) => ({
          userId: m.userId,
          kind: 'CIRCLE_ACTIVITY' as const,
          title: `${senderName} shared a trip with your circle`,
          body: deal.normalizedTitle,
          linkUrl: `/deals/${dealId}`,
          actorId: auth.user.id,
        })),
    })
    const conversation = await prisma.conversation.findUnique({ where: { circleId } })
    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: auth.user.id,
          body: message?.trim() || `Shared a trip: ${deal.normalizedTitle}`,
          attachment: { kind: 'DEAL', dealId },
        },
      })
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      })
    }
  }

  if (target === 'TRIP' && tripId) {
    const conversation = await prisma.conversation.findUnique({ where: { tripId } })
    if (conversation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: auth.user.id,
          body: message?.trim() || `Another option: ${deal.normalizedTitle}`,
          attachment: { kind: 'DEAL', dealId },
        },
      })
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      })
    }
  }

  await Promise.all([
    track('deal_shared', { userId: auth.user.id, properties: { dealId, target } }),
    trackRecommendation(auth.user.id, 'SHARE', { dealId }),
  ])

  return ok({ shared: true, shareId: share.id, shareToken: share.shareToken }, 201)
})

/** "Interested / Maybe / Not for me" on a trip someone sent you. */
export const PATCH = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)

  const parsed = await parseBody(request, shareResponseSchema)
  if (!parsed.ok) return parsed.response

  const share = await prisma.dealShare.findUnique({
    where: { id: parsed.data.shareId },
    select: { id: true, recipientId: true, circleId: true, tripId: true, dealId: true, senderId: true },
  })
  if (!share) return fail('That share no longer exists.', 404)

  // Only the recipient — or a member of the circle/trip it went to — may respond.
  let allowed = share.recipientId === auth.user.id
  if (!allowed && share.circleId) {
    allowed = !!(await prisma.circleMember.findFirst({
      where: { circleId: share.circleId, userId: auth.user.id },
      select: { id: true },
    }))
  }
  if (!allowed && share.tripId) {
    allowed = !!(await prisma.tripMember.findFirst({
      where: { tripId: share.tripId, userId: auth.user.id },
      select: { id: true },
    }))
  }
  if (!allowed) return fail('That was not shared with you.', 403)

  await prisma.dealShare.update({
    where: { id: share.id },
    data: { response: parsed.data.response, respondedAt: new Date() },
  })

  // A response is a genuine recommendation signal.
  await trackRecommendation(
    auth.user.id,
    parsed.data.response === 'NOT_FOR_ME' ? 'NOT_INTERESTED' : 'SAVE',
    { dealId: share.dealId, placement: 'share-response' },
  )

  return ok({ response: parsed.data.response })
})
