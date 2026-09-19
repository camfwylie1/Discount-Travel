import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { blockSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'
import { z } from 'zod'

/**
 * BLOCKING
 *
 * A block is total and immediate: the connection is removed, any pending
 * request is removed, and both members disappear from each other's
 * discovery, messaging and social proof everywhere in the product.
 */
export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, blockSchema)
  if (!parsed.ok) return parsed.response
  const targetId = parsed.data.userId
  if (targetId === auth.user.id) return fail('You cannot block yourself.', 422)

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } })
  if (!target) return fail('That member no longer exists.', 404)

  await prisma.$transaction([
    prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: auth.user.id, blockedId: targetId } },
      create: { blockerId: auth.user.id, blockedId: targetId, reason: parsed.data.reason ?? null },
      update: { reason: parsed.data.reason ?? null },
    }),
    // Remove the relationship in both directions.
    prisma.connection.deleteMany({
      where: {
        OR: [
          { requesterId: auth.user.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: auth.user.id },
        ],
      },
    }),
    // Remove each from the other's circles.
    prisma.circleMember.deleteMany({
      where: {
        OR: [
          { userId: targetId, circle: { ownerId: auth.user.id } },
          { userId: auth.user.id, circle: { ownerId: targetId } },
        ],
      },
    }),
    // Cached compatibility scores must not survive a block.
    prisma.travelerMatch.deleteMany({
      where: {
        OR: [
          { userAId: auth.user.id, userBId: targetId },
          { userAId: targetId, userBId: auth.user.id },
        ],
      },
    }),
  ])

  await track('user_blocked', { userId: auth.user.id, properties: { targetId } })
  return ok({ blocked: true })
})

export const DELETE = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const body = await request.json().catch(() => null)
  const parsed = z.object({ userId: z.string().max(40) }).safeParse(body)
  if (!parsed.success) return fail('Which member?', 422)

  await prisma.block.deleteMany({
    where: { blockerId: auth.user.id, blockedId: parsed.data.userId },
  })
  return ok({ blocked: false })
})
