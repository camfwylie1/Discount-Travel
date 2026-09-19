import { prisma } from '@/lib/db'
import { apiMember } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { connectionSchema } from '@/lib/validation'
import { getRelationship } from '@/lib/social/visibility'
import { track } from '@/lib/analytics/events'

export const POST = handler(async (request) => {
  const auth = await apiMember()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'connectionRequest', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, connectionSchema)
  if (!parsed.ok) return parsed.response
  const targetId = parsed.data.userId

  if (targetId === auth.user.id) return fail('You cannot connect with yourself.', 422)

  const relationship = await getRelationship(auth.user.id, targetId)
  if (relationship === 'blocked') return fail('You cannot connect with this member.', 403)
  if (relationship === 'connected') return ok({ status: 'ACCEPTED', alreadyConnected: true })

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { status: true, ageConfirmed18: true, privacy: { select: { discoverable: true } } },
  })
  if (!target || target.status !== 'ACTIVE' || !target.ageConfirmed18) {
    return fail('That member is not available.', 404)
  }

  // If they already asked us, accept instead of creating a mirror request.
  const incoming = await prisma.connection.findUnique({
    where: { requesterId_addresseeId: { requesterId: targetId, addresseeId: auth.user.id } },
  })
  if (incoming && incoming.status === 'PENDING') {
    await prisma.connection.update({
      where: { id: incoming.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    })
    await prisma.notification.create({
      data: {
        userId: targetId,
        kind: 'CONNECTION_ACCEPTED',
        title: `${auth.user.firstName ?? 'A traveller'} accepted your connection`,
        linkUrl: `/people/${auth.user.id}`,
        actorId: auth.user.id,
      },
    })
    await track('connection_accepted', { userId: auth.user.id, properties: { targetId } })
    return ok({ status: 'ACCEPTED' })
  }

  const connection = await prisma.connection.upsert({
    where: { requesterId_addresseeId: { requesterId: auth.user.id, addresseeId: targetId } },
    create: {
      requesterId: auth.user.id,
      addresseeId: targetId,
      message: parsed.data.message ?? null,
      status: 'PENDING',
    },
    update: { status: 'PENDING', message: parsed.data.message ?? null },
  })

  await prisma.notification.create({
    data: {
      userId: targetId,
      kind: 'CONNECTION_REQUEST',
      title: `${auth.user.firstName ?? 'A traveller'} wants to connect`,
      body: parsed.data.message ?? null,
      linkUrl: '/people/requests',
      actorId: auth.user.id,
    },
  })
  await track('connection_requested', { userId: auth.user.id, properties: { targetId } })

  return ok({ status: connection.status }, 201)
})
