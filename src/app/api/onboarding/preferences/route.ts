import { prisma } from '@/lib/db'
import type { Prisma } from '@/generated/prisma/client'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { preferenceUpdateSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'

/** Saves a batch of preference answers. Used by every onboarding screen and by settings. */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, preferenceUpdateSchema)
  if (!parsed.ok) return parsed.response
  const { preferences, step } = parsed.data

  const keys = preferences.map((p) => p.dimensionKey)
  const dimensions = await prisma.preferenceDimension.findMany({
    where: { key: { in: keys }, active: true },
    select: { id: true, key: true, kind: true },
  })
  const byKey = new Map(dimensions.map((d) => [d.key, d]))

  const writes: Prisma.PrismaPromise<unknown>[] = preferences.flatMap((pref): Prisma.PrismaPromise<unknown>[] => {
    const dimension = byKey.get(pref.dimensionKey)
    // Silently ignore unknown keys rather than failing the whole batch — the
    // taxonomy is editable and a stale client should not lose a user's answers.
    if (!dimension) return []

    const rating = dimension.kind === 'RATING' ? (pref.rating ?? null) : null
    const spectrum = dimension.kind === 'SPECTRUM' ? (pref.spectrum ?? null) : null
    if (rating === null && spectrum === null) {
      // Clearing an answer.
      return [
        prisma.userPreference.deleteMany({
          where: { userId: auth.user.id, dimensionId: dimension.id },
        }),
      ]
    }

    return [
      prisma.userPreference.upsert({
        where: { userId_dimensionId: { userId: auth.user.id, dimensionId: dimension.id } },
        create: {
          userId: auth.user.id,
          dimensionId: dimension.id,
          rating,
          spectrum,
          peopleWeight: pref.peopleWeight ?? 3,
          source: step ? 'ONBOARDING' : 'EDITED',
        },
        update: {
          rating,
          spectrum,
          ...(pref.peopleWeight !== undefined ? { peopleWeight: pref.peopleWeight } : {}),
          source: step ? 'ONBOARDING' : 'EDITED',
        },
      }),
    ]
  })

  await prisma.$transaction(writes)

  if (step) {
    await prisma.user.update({ where: { id: auth.user.id }, data: { onboardingStep: step } })
    await track('quiz_step_completed', { userId: auth.user.id, properties: { step, answered: preferences.length } })
  }

  // Cached recommendations are no longer valid once preferences change.
  await prisma.matchScore.deleteMany({ where: { userId: auth.user.id } })
  await prisma.travelerMatch.deleteMany({
    where: { OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }] },
  })

  return ok({ saved: preferences.length })
})
