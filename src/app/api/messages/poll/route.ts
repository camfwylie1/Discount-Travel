import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { fail, handler, ok } from '@/lib/api'
import { canAccessConversation } from '@/lib/social/visibility'

/**
 * Message polling.
 *
 * The MVP polls every few seconds while a conversation is open. That is
 * genuinely adequate at this scale and has no infrastructure cost. The
 * documented upgrade path is a Server-Sent Events endpoint at the same URL —
 * the client contract (give me messages after this id) does not change.
 */
export const GET = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const url = new URL(request.url)
  const conversationId = url.searchParams.get('conversationId') ?? ''
  const after = url.searchParams.get('after')

  if (!conversationId) return fail('Which conversation?', 422)
  if (!(await canAccessConversation(auth.user.id, conversationId))) {
    return fail('You are not part of that conversation.', 403)
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: { sender: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
  })

  return ok({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      attachment: m.attachment,
      sender: {
        id: m.sender.id,
        firstName: m.sender.profile?.firstName ?? 'Traveller',
        photoThumbUrl: m.sender.profile?.photoThumbUrl ?? null,
      },
    })),
  })
})
