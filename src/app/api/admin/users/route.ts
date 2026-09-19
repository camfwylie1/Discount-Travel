import { prisma } from '@/lib/db'
import { apiAdmin } from '@/lib/auth/guards'
import { fail, handler, ok, parseBody } from '@/lib/api'
import { invalidateAllSessions } from '@/lib/auth/session'
import { audit } from '@/lib/analytics/events'
import { z } from 'zod'

const schema = z.object({
  userId: z.string().max(40),
  action: z.enum(['SUSPEND', 'REINSTATE', 'MAKE_MODERATOR', 'MAKE_MEMBER']),
  reason: z.string().trim().max(500).optional(),
})

export const POST = handler(async (request) => {
  const auth = await apiAdmin()
  if (!auth.ok) return fail(auth.error, auth.status)

  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { userId, action, reason } = parsed.data

  if (userId === auth.user.id) {
    return fail('You cannot change your own role or status.', 422)
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, email: true },
  })
  if (!target) return fail('That member does not exist.', 404)

  // An administrator cannot be demoted or suspended from here — that needs
  // direct database access, deliberately.
  if (target.role === 'ADMIN') {
    return fail('Administrator accounts cannot be changed from the admin portal.', 403)
  }

  const data =
    action === 'SUSPEND'
      ? { status: 'SUSPENDED' as const, suspendedReason: reason ?? 'Suspended by an administrator.' }
      : action === 'REINSTATE'
        ? { status: 'ACTIVE' as const, suspendedReason: null }
        : action === 'MAKE_MODERATOR'
          ? { role: 'MODERATOR' as const }
          : { role: 'MEMBER' as const }

  await prisma.user.update({ where: { id: userId }, data })
  if (action === 'SUSPEND') await invalidateAllSessions(userId)

  await audit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: `user.${action.toLowerCase()}`,
    entityType: 'User',
    entityId: userId,
    before: { role: target.role, status: target.status },
    after: data,
  })

  return ok({ updated: true })
})
