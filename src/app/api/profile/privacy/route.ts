import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { privacySchema } from '@/lib/validation'
import { audit } from '@/lib/analytics/events'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, privacySchema)
  if (!parsed.ok) return parsed.response

  const before = await prisma.privacySetting.findUnique({ where: { userId: auth.user.id } })

  const updated = await prisma.privacySetting.upsert({
    where: { userId: auth.user.id },
    create: { userId: auth.user.id, ...parsed.data },
    update: parsed.data,
  })

  // Privacy changes are audited — they matter, and a member may need to prove
  // what their settings were at a point in time.
  await audit({
    actorId: auth.user.id,
    action: 'privacy.updated',
    entityType: 'PrivacySetting',
    entityId: updated.id,
    before,
    after: updated,
  })

  // Becoming undiscoverable must take effect everywhere immediately.
  if (parsed.data.discoverable === false) {
    await prisma.travelerMatch.deleteMany({
      where: { OR: [{ userAId: auth.user.id }, { userBId: auth.user.id }] },
    })
  }

  return ok({ saved: true })
})
