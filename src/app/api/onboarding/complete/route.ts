import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { fail, handler, ok } from '@/lib/api'
import { generatePersonality } from '@/lib/personality/generate'
import { track } from '@/lib/analytics/events'

export const POST = handler(async () => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const answered = await prisma.userPreference.count({ where: { userId: auth.user.id } })
  if (answered < 5) {
    return fail('Answer a few more questions before finishing.', 422)
  }

  // Make sure a personality exists, even if the member skipped the reveal.
  const existing = await prisma.travelPersonality.findUnique({ where: { userId: auth.user.id } })
  if (!existing) await generatePersonality(auth.user.id)

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { onboardingComplete: true, onboardingStep: null },
  })
  await track('quiz_completed', { userId: auth.user.id, properties: { answered } })

  return ok({ complete: true, next: '/discover' })
})
