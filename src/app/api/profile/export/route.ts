import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler } from '@/lib/api'
import { audit } from '@/lib/analytics/events'

/**
 * DATA EXPORT
 *
 * Canadian privacy law (PIPEDA) gives an individual the right to access their
 * personal information. This returns everything we hold about the member, as
 * a JSON file they can download.
 *
 * Deliberately excludes other people's data: messages include what the member
 * themselves wrote, not the whole conversation.
 */
export const GET = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'recompute', auth.user.id)
  if (limited) return limited

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: {
      profile: true,
      privacy: true,
      constraints: true,
      personality: true,
      preferences: { include: { dimension: { select: { key: true, label: true, category: true } } } },
      airports: { include: { airport: { select: { iata: true, name: true, city: true } } } },
      wishlist: true,
      savedDeals: { include: { deal: { select: { normalizedTitle: true, slug: true } } } },
      subscription: true,
      payments: true,
      dealClicks: { select: { createdAt: true, placement: true, dealId: true } },
      messages: { select: { body: true, createdAt: true, conversationId: true } },
      notifications: { select: { kind: true, title: true, createdAt: true } },
    },
  })
  if (!user) return fail('Account not found.', 404)

  const payload = {
    exportedAt: new Date().toISOString(),
    note:
      'This file contains the personal information Voyaj holds about you. It deliberately excludes other members’ messages and profiles.',
    account: {
      email: user.email,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      ageConfirmed18: user.ageConfirmed18,
      marketingOptIn: user.marketingOptIn,
      role: user.role,
      status: user.status,
    },
    profile: user.profile,
    privacySettings: user.privacy,
    travelConstraints: user.constraints,
    travelPersonality: user.personality,
    preferences: user.preferences.map((p) => ({
      interest: p.dimension.label,
      key: p.dimension.key,
      category: p.dimension.category,
      rating: p.rating,
      spectrum: p.spectrum,
      answeredVia: p.source,
    })),
    departureAirports: user.airports.map((a) => ({ ...a.airport, rank: a.rank })),
    wishlist: user.wishlist,
    savedTrips: user.savedDeals.map((s) => ({
      trip: s.deal.normalizedTitle,
      state: s.state,
      savedAt: s.createdAt,
    })),
    membership: user.subscription,
    payments: user.payments,
    outboundClicks: user.dealClicks,
    messagesYouSent: user.messages,
    notifications: user.notifications,
  }

  await audit({ actorId: user.id, action: 'data.exported', entityType: 'User', entityId: user.id })

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="voyaj-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  })
})
