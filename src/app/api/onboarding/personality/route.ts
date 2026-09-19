import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { generatePersonality } from '@/lib/personality/generate'
import { track } from '@/lib/analytics/events'
import { z } from 'zod'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'recompute', auth.user.id)
  if (limited) return limited

  const body = await request.json().catch(() => ({}))
  const { force } = z.object({ force: z.boolean().optional() }).parse(body ?? {})

  const answered = await prisma.userPreference.count({ where: { userId: auth.user.id } })
  if (answered < 5) {
    return fail('Answer a few more questions first so we have something to work with.', 422)
  }

  const personality = await generatePersonality(auth.user.id, { force })
  await track(force ? 'personality_regenerated' : 'personality_generated', { userId: auth.user.id })

  return ok({
    title: personality.title,
    description: personality.description,
    topInterests: personality.topInterests,
    tripStyles: personality.tripStyles,
    destinationIdeas: personality.destinationIdeas,
    idealCompanions: personality.idealCompanions,
    radar: personality.radar,
    generatedBy: personality.generatedBy,
  })
})

/** Lets a member edit the copy by hand. Their version then wins. */
const editSchema = z.object({
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(1200),
})

export const PATCH = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const body = await request.json().catch(() => null)
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) return fail('Please check the title and description.', 422)

  const existing = await prisma.travelPersonality.findUnique({ where: { userId: auth.user.id } })
  if (!existing) return fail('Generate your travel personality first.', 404)

  const updated = await prisma.travelPersonality.update({
    where: { userId: auth.user.id },
    data: { title: parsed.data.title, description: parsed.data.description, isEdited: true },
  })
  return ok({ title: updated.title, description: updated.description, isEdited: true })
})
