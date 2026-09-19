import { prisma } from '@/lib/db'
import { apiUser } from '@/lib/auth/guards'
import { fail, handler, ok } from '@/lib/api'
import { getBlockedUserIds } from '@/lib/social/visibility'

/** Who this member can share a trip with. Blocked members never appear. */
export const GET = handler(async () => {
  const auth = await apiUser()
  if (!auth.ok) return fail(auth.error, auth.status)

  const blocked = await getBlockedUserIds(auth.user.id)

  const [connections, circles, trips] = await Promise.all([
    prisma.connection.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: auth.user.id }, { addresseeId: auth.user.id }],
        NOT: [{ requesterId: { in: blocked } }, { addresseeId: { in: blocked } }],
      },
      include: {
        requester: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } },
        addressee: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } },
      },
      take: 100,
    }),
    prisma.circle.findMany({
      where: { ownerId: auth.user.id },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.tripGroup.findMany({
      where: {
        status: { in: ['IDEA', 'PLANNING', 'CONFIRMED'] },
        members: { some: { userId: auth.user.id, state: { notIn: ['LEFT', 'DECLINED'] } } },
      },
      select: { id: true, name: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ])

  return ok({
    connections: connections
      .map((c) => (c.requesterId === auth.user.id ? c.addressee : c.requester))
      .filter((u) => !blocked.includes(u.id))
      .map((u) => ({
        id: u.id,
        firstName: u.profile?.firstName ?? 'Traveller',
        photoThumbUrl: u.profile?.photoThumbUrl ?? null,
      })),
    circles: circles.map((c) => ({ id: c.id, name: c.name, memberCount: c._count.members })),
    trips,
  })
})
