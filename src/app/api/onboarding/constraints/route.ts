import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { constraintsSchema } from '@/lib/validation'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, constraintsSchema)
  if (!parsed.ok) return parsed.response
  const d = parsed.data

  // Sanity checks that a schema cannot express.
  if (d.budgetMax != null && d.budgetPreferred != null && d.budgetPreferred > d.budgetMax) {
    return fail('Your preferred budget cannot be higher than your maximum.', 422, {
      fields: { budgetPreferred: 'This is above your maximum budget.' },
    })
  }
  if (d.durationMin != null && d.durationMax != null && d.durationMin > d.durationMax) {
    return fail('Your minimum trip length cannot be longer than your maximum.', 422, {
      fields: { durationMin: 'This is longer than your maximum.' },
    })
  }

  const data = {
    ...d,
    earliestDeparture: d.earliestDeparture ? new Date(d.earliestDeparture) : d.earliestDeparture === null ? null : undefined,
    latestReturn: d.latestReturn ? new Date(d.latestReturn) : d.latestReturn === null ? null : undefined,
  }

  await prisma.travelConstraint.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, ...data },
    update: data,
  })

  await prisma.matchScore.deleteMany({ where: { userId: auth.user.id } })
  return ok({ saved: true })
})
