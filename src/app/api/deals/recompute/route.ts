import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { prisma } from '@/lib/db'

/** Clears cached scores so the next feed load recalculates from scratch. */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'recompute', auth.user.id)
  if (limited) return limited

  const [matches, travelers] = await Promise.all([
    prisma.matchScore.deleteMany({ where: { userId: auth.user.id } }),
    prisma.travelerMatch.deleteMany({
      where: { OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }] },
    }),
  ])
  return ok({ cleared: matches.count + travelers.count })
})
