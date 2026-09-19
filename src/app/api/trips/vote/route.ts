import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { tripVoteSchema } from '@/lib/validation'

export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, tripVoteSchema)
  if (!parsed.ok) return parsed.response
  const { tripId, kind, optionKey, value } = parsed.data

  const member = await prisma.tripMember.findFirst({
    where: { tripId, userId: auth.user.id, state: { notIn: ['LEFT', 'DECLINED'] } },
    select: { id: true },
  })
  if (!member) return fail('Only members of this trip can vote.', 403)

  const airport =
    kind === 'AIRPORT'
      ? await prisma.airport.findUnique({ where: { iata: optionKey }, select: { id: true } })
      : null

  await prisma.tripVote.upsert({
    where: { tripId_userId_kind_optionKey: { tripId, userId: auth.user.id, kind, optionKey } },
    create: { tripId, userId: auth.user.id, kind, optionKey, value, airportId: airport?.id ?? null },
    update: { value },
  })

  const tally = await prisma.tripVote.groupBy({
    by: ['optionKey'],
    where: { tripId, kind },
    _sum: { value: true },
    _count: { optionKey: true },
  })

  return ok({
    tally: tally.map((t) => ({ optionKey: t.optionKey, score: t._sum.value ?? 0, votes: t._count.optionKey })),
  })
})
