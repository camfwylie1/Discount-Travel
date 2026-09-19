import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { startConversationSchema } from '@/lib/validation'
import { canMessage } from '@/lib/social/visibility'

/** Opens (or reuses) a direct conversation with another member. */
export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, startConversationSchema)
  if (!parsed.ok) return parsed.response
  const targetId = parsed.data.userId

  const permission = await canMessage(auth.user.id, targetId)
  if (!permission.allowed) return fail(permission.reason ?? 'You cannot message this member.', 403)

  // A sorted key means the same pair always resolves to one conversation.
  const directKey = [auth.user.id, targetId].sort().join(':')
  const conversation = await prisma.conversation.upsert({
    where: { directKey },
    create: {
      kind: 'DIRECT',
      directKey,
      members: { create: [{ userId: auth.user.id }, { userId: targetId }] },
    },
    update: {},
  })

  return ok({ conversationId: conversation.id })
})
