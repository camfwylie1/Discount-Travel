import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { messageSchema } from '@/lib/validation'
import { canAccessConversation, getBlockedUserIds } from '@/lib/social/visibility'
import { ai } from '@/lib/ai'
import { track } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'

export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'message', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, messageSchema)
  if (!parsed.ok) return parsed.response
  const { conversationId, body, attachment } = parsed.data

  // Membership is the only thing that grants access to a conversation.
  if (!(await canAccessConversation(auth.user.id, conversationId))) {
    return fail('You are not part of that conversation.', 403)
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: { where: { leftAt: null }, select: { userId: true } } },
  })
  if (!conversation) return fail('That conversation no longer exists.', 404)

  // A block silences a direct conversation in both directions.
  if (conversation.kind === 'DIRECT') {
    const blocked = await getBlockedUserIds(auth.user.id)
    const otherId = conversation.members.find((m) => m.userId !== auth.user.id)?.userId
    if (otherId && blocked.includes(otherId)) {
      return fail('You cannot send messages in this conversation.', 403)
    }
  }

  // Moderation runs before the write, and never blocks on a provider failure.
  let moderationFlag: string | null = null
  try {
    const moderation = await ai.moderateContent({ text: body, context: 'message' })
    if (!moderation.data.allowed) {
      return fail(moderation.data.reason ?? 'That message cannot be sent.', 422)
    }
    if (moderation.data.flags.length > 0) moderationFlag = moderation.data.flags.join(',')
  } catch (error) {
    logger.warn('moderation.failed_open', { error: String(error) })
  }

  if (attachment) {
    const deal = await prisma.deal.findUnique({ where: { id: attachment.dealId }, select: { id: true } })
    if (!deal) return fail('That trip no longer exists.', 404)
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: auth.user.id,
      body,
      attachment: attachment ?? undefined,
      moderationFlag,
    },
    include: { sender: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
  })

  await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
    // The sender has, by definition, read their own message.
    prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: auth.user.id } },
      data: { lastReadAt: new Date() },
    }),
    prisma.notification.createMany({
      data: conversation.members
        .filter((m) => m.userId !== auth.user.id)
        .map((m) => ({
          userId: m.userId,
          kind: 'NEW_MESSAGE' as const,
          title: `${auth.user.firstName ?? 'A traveller'} sent you a message`,
          body: body.slice(0, 120),
          linkUrl: `/chats/${conversationId}`,
          actorId: auth.user.id,
        })),
    }),
  ])

  await track('message_sent', { userId: auth.user.id, properties: { conversationId, hasAttachment: !!attachment } })

  return ok(
    {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      attachment: message.attachment,
      sender: {
        id: message.sender.id,
        firstName: message.sender.profile?.firstName ?? 'Traveller',
        photoThumbUrl: message.sender.profile?.photoThumbUrl ?? null,
      },
    },
    201,
  )
})
