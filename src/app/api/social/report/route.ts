import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { reportSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'report', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, reportSchema)
  if (!parsed.ok) return parsed.response
  const d = parsed.data

  if (d.reportedUserId === auth.user.id) return fail('You cannot report yourself.', 422)

  // A report about a message is only valid if the reporter can actually see it.
  if (d.messageId) {
    const message = await prisma.message.findUnique({
      where: { id: d.messageId },
      select: { conversationId: true },
    })
    if (!message) return fail('That message no longer exists.', 404)
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: message.conversationId, userId: auth.user.id } },
      select: { id: true },
    })
    if (!member) return fail('That message is not in one of your conversations.', 403)
  }

  const report = await prisma.report.create({
    data: {
      reporterId: auth.user.id,
      kind: d.kind,
      reportedUserId: d.reportedUserId ?? null,
      messageId: d.messageId ?? null,
      dealId: d.dealId ?? null,
      tripId: d.tripId ?? null,
      reason: d.reason,
      detail: d.detail ?? null,
    },
  })

  logger.warn('moderation.report_created', {
    reportId: report.id,
    kind: d.kind,
    reason: d.reason,
  })
  await track('user_reported', { userId: auth.user.id, properties: { kind: d.kind, reason: d.reason } })

  return ok({ reported: true, reference: report.id.slice(-8).toUpperCase() }, 201)
})
