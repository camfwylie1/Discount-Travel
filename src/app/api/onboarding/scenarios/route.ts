import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { scenarioAnswerSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'

/**
 * Converts scenario answers into preference signals.
 *
 * Each option carries deltas. We start every affected dimension at a neutral 3
 * and apply the deltas, clamped to 1..5. An answer the traveller has already
 * set by hand is never overwritten — scenarios only PRE-FILL.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, scenarioAnswerSchema)
  if (!parsed.ok) return parsed.response

  const optionKeys = parsed.data.answers.map((a) => a.optionKey)
  const questionKeys = parsed.data.answers.map((a) => a.questionKey)

  const options = await prisma.scenarioOption.findMany({
    where: { key: { in: optionKeys }, question: { key: { in: questionKeys } } },
    include: { question: { select: { key: true } }, effects: { include: { dimension: true } } },
  })

  // Only accept an option that genuinely belongs to the question it was sent for.
  const valid = options.filter((o) =>
    parsed.data.answers.some((a) => a.questionKey === o.question.key && a.optionKey === o.key),
  )

  const totals = new Map<string, { delta: number; kind: string }>()
  for (const option of valid) {
    for (const effect of option.effects) {
      const entry = totals.get(effect.dimensionId) ?? { delta: 0, kind: effect.dimension.kind }
      entry.delta += effect.delta
      totals.set(effect.dimensionId, entry)
    }
  }

  const existing = await prisma.userPreference.findMany({
    where: { userId: auth.user.id, dimensionId: { in: [...totals.keys()] } },
    select: { dimensionId: true, source: true },
  })
  // A hand-edited answer always wins over a scenario-derived one.
  const manuallySet = new Set(
    existing.filter((e) => e.source === 'EDITED').map((e) => e.dimensionId),
  )

  const writes = [...totals.entries()]
    .filter(([dimensionId]) => !manuallySet.has(dimensionId))
    .map(([dimensionId, { delta, kind }]) => {
      if (kind === 'SPECTRUM') {
        // Spectrum deltas are on the 0-100 scale, applied around a neutral 50.
        const spectrum = Math.max(0, Math.min(100, Math.round(50 + delta)))
        return prisma.userPreference.upsert({
          where: { userId_dimensionId: { userId: auth.user.id, dimensionId } },
          create: { userId: auth.user.id, dimensionId, spectrum, source: 'SCENARIO' },
          update: { spectrum, source: 'SCENARIO' },
        })
      }
      const rating = Math.max(1, Math.min(5, Math.round(3 + delta)))
      return prisma.userPreference.upsert({
        where: { userId_dimensionId: { userId: auth.user.id, dimensionId } },
        create: { userId: auth.user.id, dimensionId, rating, source: 'SCENARIO' },
        update: { rating, source: 'SCENARIO' },
      })
    })

  await prisma.$transaction(writes)
  await prisma.user.update({ where: { id: auth.user.id }, data: { onboardingStep: 'scenarios' } })
  await track('quiz_step_completed', {
    userId: auth.user.id,
    properties: { step: 'scenarios', answered: valid.length },
  })

  return ok({ applied: writes.length, answered: valid.length })
})
