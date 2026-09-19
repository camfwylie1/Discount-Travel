import { prisma } from '@/lib/db'
import { apiModerator } from '@/lib/auth/guards'
import { fail, handler, ok, parseBody } from '@/lib/api'
import { invalidateAllSessions } from '@/lib/auth/session'
import { audit } from '@/lib/analytics/events'
import { z } from 'zod'

const schema = z.object({
  reportId: z.string().max(40),
  action: z.enum(['DISMISS', 'WARN', 'SUSPEND_USER', 'REMOVE_CONTENT']),
  note: z.string().trim().max(1000).optional(),
})

export const POST = handler(async (request) => {
  const auth = await apiModerator()
  if (!auth.ok) return fail(auth.error, auth.status)

  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { reportId, action, note } = parsed.data

  const report = await prisma.report.findUnique({ where: { id: reportId } })
  if (!report) return fail('That report no longer exists.', 404)

  const status = action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED'

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      resolverId: auth.user.id,
      resolutionNote: note ?? null,
      resolvedAt: new Date(),
    },
  })

  if (action === 'SUSPEND_USER' && report.reportedUserId) {
    await prisma.user.update({
      where: { id: report.reportedUserId },
      data: { status: 'SUSPENDED', suspendedReason: note ?? 'Suspended following a moderation report.' },
    })
    // Suspension takes effect immediately, everywhere.
    await invalidateAllSessions(report.reportedUserId)
  }

  if (action === 'REMOVE_CONTENT' && report.messageId) {
    await prisma.message.update({
      where: { id: report.messageId },
      data: { body: '[Removed by a moderator]', deletedAt: new Date() },
    })
  }

  await audit({
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    action: `moderation.${action.toLowerCase()}`,
    entityType: 'Report',
    entityId: reportId,
    after: { status, note },
  })

  return ok({ status })
})
