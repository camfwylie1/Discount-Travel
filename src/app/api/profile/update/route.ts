import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { profileSchema } from '@/lib/validation'
import { ai } from '@/lib/ai'
import { logger } from '@/lib/observability/logger'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, profileSchema)
  if (!parsed.ok) return parsed.response

  // Free-text fields go through moderation before they become visible.
  const text = [parsed.data.bio, parsed.data.headline].filter(Boolean).join('\n')
  if (text.trim()) {
    try {
      const moderation = await ai.moderateContent({ text, context: 'bio' })
      if (!moderation.data.allowed) {
        return fail(moderation.data.reason ?? 'That text cannot be used on a profile.', 422)
      }
    } catch (error) {
      logger.warn('moderation.profile_failed_open', { error: String(error) })
    }
  }

  const profile = await prisma.profile.update({
    where: { userId: auth.user.id },
    data: parsed.data,
  })

  return ok({ saved: true, firstName: profile.firstName })
})

/** Generates a suggested travel bio the member can accept or ignore. */
export const PUT = handler(async () => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: {
      profile: true,
      personality: { select: { title: true, topInterests: true } },
      wishlist: { select: { label: true }, take: 6 },
    },
  })
  if (!user?.personality) {
    return fail('Finish the travel quiz first so we have something to write about.', 422)
  }

  const result = await ai.generateTravelBio({
    firstName: user.profile?.firstName ?? 'there',
    personalityTitle: user.personality.title,
    topInterests: user.personality.topInterests,
    homeCity: user.profile?.homeCity ?? null,
    countriesVisited: user.profile?.countriesVisited ?? [],
    wishlist: user.wishlist.map((w) => w.label),
  })

  await prisma.profile.update({
    where: { userId: auth.user.id },
    data: { aiBio: result.data.bio },
  })

  return ok({ bio: result.data.bio, generatedBy: result.provider })
})
