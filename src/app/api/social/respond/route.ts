import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok, parseBody } from '@/lib/api'
import { connectionRespondSchema } from '@/lib/validation'
import { track } from '@/lib/analytics/events'

export const POST = handler(async (request) => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'write', auth.user.id)
  if (limited) return limited

  const parsed = await parseBody(request, connectionRespondSchema)
  if (!parsed.ok) return parsed.response
  const { connectionId, action } = parsed.data

  const connection = await prisma.connection.findUnique({ where: { id: connectionId } })
  if (!connection) return fail('That request no longer exists.', 404)

  const isAddressee = connection.addresseeId === auth.user.id
  const isRequester = connection.requesterId === auth.user.id
  if (!isAddressee && !isRequester) return fail('That is not your connection.', 403)

  // Only the person who RECEIVED the request may accept or decline it.
  if ((action === 'ACCEPT' || action === 'DECLINE') && !isAddressee) {
    return fail('Only the person who received a request can respond to it.', 403)
  }
  if (action === 'WITHDRAW' && !isRequester) {
    return fail('Only the person who sent a request can withdraw it.', 403)
  }

  if (action === 'REMOVE' || action === 'WITHDRAW') {
    await prisma.connection.delete({ where: { id: connectionId } })
    return ok({ status: 'REMOVED' })
  }

  const status = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED'
  await prisma.connection.update({
    where: { id: connectionId },
    data: { status, respondedAt: new Date() },
  })

  if (action === 'ACCEPT') {
    await prisma.notification.create({
      data: {
        userId: connection.requesterId,
        kind: 'CONNECTION_ACCEPTED',
        title: `${auth.user.firstName ?? 'A traveller'} accepted your connection`,
        linkUrl: `/people/${auth.user.id}`,
        actorId: auth.user.id,
      },
    })
    await track('connection_accepted', { userId: auth.user.id })
  }

  return ok({ status })
})
