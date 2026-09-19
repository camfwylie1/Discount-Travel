import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { Badge, Card, CardBody, Input } from '@/components/ui'
import { UserActions } from '@/components/admin/AdminActions'
import { Avatar } from '@/components/layout/AppNav'
import { formatDate, timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Members', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const users = await prisma.user.findMany({
    where: {
      status: params.status ? (params.status as 'ACTIVE') : { not: 'DELETED' },
      ...(params.q
        ? {
            OR: [
              { email: { contains: params.q, mode: 'insensitive' as const } },
              { profile: { firstName: { contains: params.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    },
    include: {
      profile: { select: { firstName: true, photoThumbUrl: true, homeCity: true } },
      subscription: { select: { status: true, currentPeriodEnd: true } },
      personality: { select: { title: true } },
      _count: { select: { savedDeals: true, messages: true, reportsAbout: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Members</h1>
        <p className="mt-1 text-ink-600">
          {users.length} shown. Administrator accounts cannot be changed here, by design.
        </p>
      </div>

      <form className="flex flex-wrap gap-3">
        <Input name="q" defaultValue={params.q ?? ''} placeholder="Search email or name…" className="max-w-xs" aria-label="Search members" />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All active</option>
          {['ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED', 'DEACTIVATED'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-ink-900 px-5 text-sm font-medium text-white">
          Filter
        </button>
      </form>

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-ink-200 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Membership</th>
                <th className="px-5 py-3 font-medium">Activity</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar url={user.profile?.photoThumbUrl} name={user.profile?.firstName} size={34} />
                      <div className="min-w-0">
                        <Link href={`/people/${user.id}`} className="font-medium hover:underline">
                          {user.profile?.firstName ?? 'No name'}
                        </Link>
                        <p className="truncate text-xs text-ink-500">{user.email}</p>
                        {user.personality?.title && (
                          <p className="text-xs text-terracotta-600">{user.personality.title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-500">
                    {formatDate(user.createdAt)}
                    <p>last seen {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'never'}</p>
                  </td>
                  <td className="px-5 py-3">
                    {user.subscription?.status === 'ACTIVE' ? (
                      <>
                        <Badge variant="moss">member</Badge>
                        <p className="mt-0.5 text-xs text-ink-500">
                          to {formatDate(user.subscription.currentPeriodEnd)}
                        </p>
                      </>
                    ) : (
                      <Badge variant="neutral">free</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-500">
                    {user._count.savedDeals} saved · {user._count.messages} messages
                    {user._count.reportsAbout > 0 && (
                      <p className="text-berry-500">{user._count.reportsAbout} reports about them</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={
                        user.status === 'ACTIVE' ? 'moss' : user.status === 'SUSPENDED' ? 'berry' : 'neutral'
                      }
                    >
                      {user.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                    {user.role !== 'MEMBER' && (
                      <Badge variant="dark" className="ml-1">{user.role.toLowerCase()}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <UserActions userId={user.id} status={user.status} role={user.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  )
}
