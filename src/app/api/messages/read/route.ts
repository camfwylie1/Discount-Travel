import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { fail, handler, ok } from '@/lib/api'
import { canAccessConversation } from '@/lib/social/visibility'
import { z } from 'zod'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = z.object({ conversationId: z.string().max(40) }).safeParse(body)
  if (!parsed.success) return fail('Which conversation?', 422)

  if (!(await canAccessConversation(auth.user.id, parsed.data.conversationId))) {
    return fail('You are not part of that conversation.', 403)
  }

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: parsed.data.conversationId, userId: auth.user.id } },
    data: { lastReadAt: new Date() },
  })
  // Notifications for this conversation are no longer relevant.
  await prisma.notification.updateMany({
    where: { userId: auth.user.id, kind: 'NEW_MESSAGE', linkUrl: `/chats/${parsed.data.conversationId}`, readAt: null },
    data: { readAt: new Date() },
  })

  return ok({ read: true })
})
