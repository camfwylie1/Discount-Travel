import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { handoffOutcomeSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'

/**
 * WHAT HAPPENED AFTER THE HANDOFF
 *
 * When a member comes back from a provider's site we ask whether they booked.
 * This records their answer.
 *
 * It is written only from what the member actually said. Voyaj never infers a
 * booking from the fact that somebody clicked a link and did not come back —
 * that inference would be wrong often enough to poison both the
 * recommendations built on it and any commission reporting.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, handoffOutcomeSchema)
  if (!parsed.ok) return parsed.response

  // Scoped to this member: one person may not annotate another's handoff.
  const click = await prisma.dealClick.findFirst({
    where: { id: parsed.data.handoffId, userId: auth.user.id },
    select: { id: true, dealId: true },
  })
  if (!click) return fail('We could not find that visit.', 404)

  await prisma.dealClick.update({
    where: { id: click.id },
    data: { returnedAt: new Date(), outcome: parsed.data.outcome },
  })

  // A self-reported booking is the strongest signal this product gets, so it
  // is also written to the saved trip where the member can see and correct it.
  if (parsed.data.outcome === 'BOOKED') {
    await prisma.savedDeal.upsert({
      where: { userId_dealId: { userId: auth.user.id, dealId: click.dealId } },
      create: {
        userId: auth.user.id,
        dealId: click.dealId,
        state: 'BOOKED',
        selfReportedBooking: true,
      },
      update: { state: 'BOOKED', selfReportedBooking: true },
    })
  }

  await track('handoff_outcome', {
    userId: auth.user.id,
    properties: { dealId: click.dealId, outcome: parsed.data.outcome },
  })

  return ok({ recorded: true })
})
