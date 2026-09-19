import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { dealFeedbackSchema } from '@/lib/validation'
import { track, trackRecommendation } from '@/lib/analytics/events'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, dealFeedbackSchema)
  if (!parsed.ok) return parsed.response
  const { dealId, helpful, reason, detail } = parsed.data

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } })
  if (!deal) return fail('That trip no longer exists.', 404)

  await prisma.dealFeedback.upsert({
    where: { userId_dealId: { userId: auth.user.id, dealId } },
    create: { userId: auth.user.id, dealId, helpful: helpful ?? null, reason: reason ?? null, detail: detail ?? null },
    update: { helpful: helpful ?? null, reason: reason ?? null, detail: detail ?? null },
  })

  await Promise.all([
    track('recommendation_feedback', { userId: auth.user.id, properties: { dealId, helpful, reason } }),
    trackRecommendation(auth.user.id, helpful === false ? 'FEEDBACK_NO' : 'FEEDBACK_YES', {
      dealId,
      context: { reason },
    }),
  ])

  return ok({ recorded: true })
})
