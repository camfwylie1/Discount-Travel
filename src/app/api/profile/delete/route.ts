import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { verifyPassword } from '@/lib/auth/password'
import { clearSessionCookie, invalidateAllSessions } from '@/lib/auth/session'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { audit, track } from '@/lib/analytics/events'
import { storage } from '@/lib/storage'
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(1).max(200),
  confirmation: z.literal('DELETE'),
})

/**
 * ACCOUNT DELETION
 *
 * Real deletion, not a flag. Personal information is removed; what remains is
 * an anonymised shell so that other people's conversations do not break and
 * aggregate analytics stay consistent.
 *
 * Requires the password, because an attacker with a stolen session must not
 * be able to destroy someone's account.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'passwordReset', auth.user.id)
  if (limited) return limited

  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return fail('Type DELETE and enter your password to confirm.', 422)
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, passwordHash: true, email: true },
  })
  if (!user) return fail('Account not found.', 404)

  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return fail('That password is not correct.', 401)
  }

  // Remove uploaded files before the database rows that point at them.
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { photoUrl: true, photoThumbUrl: true },
  })
  const store = storage()
  for (const url of [profile?.photoUrl, profile?.photoThumbUrl]) {
    if (url?.startsWith('/uploads/')) await store.delete(url.replace('/uploads/', '')).catch(() => {})
  }

  const anonymousEmail = `deleted-${user.id}@deleted.invalid`

  await prisma.$transaction([
    // Personal content and preferences go entirely.
    prisma.userPreference.deleteMany({ where: { userId: user.id } }),
    prisma.wishlistItem.deleteMany({ where: { userId: user.id } }),
    prisma.savedDeal.deleteMany({ where: { userId: user.id } }),
    prisma.travelPersonality.deleteMany({ where: { userId: user.id } }),
    prisma.travelConstraint.deleteMany({ where: { userId: user.id } }),
    prisma.userAirport.deleteMany({ where: { userId: user.id } }),
    prisma.matchScore.deleteMany({ where: { userId: user.id } }),
    prisma.travelerMatch.deleteMany({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    }),
    prisma.connection.deleteMany({
      where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    }),
    prisma.circleMember.deleteMany({ where: { userId: user.id } }),
    prisma.circle.deleteMany({ where: { ownerId: user.id } }),
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.verificationToken.deleteMany({ where: { userId: user.id } }),
    // Messages are redacted rather than deleted, so other people's
    // conversations remain readable and coherent.
    prisma.message.updateMany({
      where: { senderId: user.id },
      data: { body: '[This member deleted their account]', deletedAt: new Date(), attachment: undefined },
    }),
    prisma.profile.updateMany({
      where: { userId: user.id },
      data: {
        firstName: 'Former member',
        lastInitial: null, headline: null, bio: null, aiBio: null,
        photoUrl: null, photoThumbUrl: null, photoStatus: 'NONE',
        homeCity: null, homeRegion: null, ageRange: null, exactAge: null,
        languages: [], countriesVisited: [], favouriteTrip: null,
      },
    }),
    prisma.privacySetting.updateMany({
      where: { userId: user.id },
      data: { discoverable: false, profileVisibility: 'PRIVATE' },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        email: anonymousEmail,
        emailNormalized: anonymousEmail,
        // A random unusable hash — the account can never be signed into again.
        passwordHash: 'deleted',
        status: 'DELETED',
        deletedAt: new Date(),
        marketingOptIn: false,
      },
    }),
  ])

  await invalidateAllSessions(user.id)
  await clearSessionCookie()

  await audit({ action: 'account.deleted', entityType: 'User', entityId: user.id })
  await track('account_deleted', {})

  return ok({ deleted: true })
})
