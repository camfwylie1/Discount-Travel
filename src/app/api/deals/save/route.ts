import { prisma } from '@/lib/db'
import { apiUser, hasMembership } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { saveDealSchema } from '@/lib/validation'
import { track, trackRecommendation } from '@/lib/analytics/events'
import { paywall, flagDefaults } from '@/config/flags'
import { z } from 'zod'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  // Saving is part of membership when the paywall is on.
  if (flagDefaults.PAYWALL_ENABLED && !paywall.preview.allowSave && !hasMembership(auth.user)) {
    return fail('Saving trips is part of Voyaj membership.', 402)
  }

  const parsed = await parseBody(request, saveDealSchema)
  if (!parsed.ok) return parsed.response

  const deal = await prisma.deal.findUnique({
    where: { id: parsed.data.dealId },
    select: { id: true },
  })
  if (!deal) return fail('That trip no longer exists.', 404)

  const state = parsed.data.state ?? 'SAVED'
  const saved = await prisma.savedDeal.upsert({
    where: { userId_dealId: { userId: auth.user.id, dealId: deal.id } },
    create: {
      userId: auth.user.id,
      dealId: deal.id,
      state,
      note: parsed.data.note ?? null,
      selfReportedBooking: state === 'BOOKED',
    },
    update: {
      state,
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      selfReportedBooking: state === 'BOOKED',
    },
  })

  await Promise.all([
    track('deal_saved', { userId: auth.user.id, properties: { dealId: deal.id, state } }),
    trackRecommendation(auth.user.id, 'SAVE', { dealId: deal.id, position: parsed.data.position }),
  ])

  return ok({ saved: true, state: saved.state })
})

export const DELETE = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const body = await request.json().catch(() => null)
  const parsed = z.object({ dealId: z.string().max(40) }).safeParse(body)
  if (!parsed.success) return fail('Which trip?', 422)

  // Scoped by userId — one member cannot unsave another member's trip.
  await prisma.savedDeal.deleteMany({
    where: { userId: auth.user.id, dealId: parsed.data.dealId },
  })
  await track('deal_unsaved', { userId: auth.user.id, properties: { dealId: parsed.data.dealId } })
  return ok({ saved: false })
})
