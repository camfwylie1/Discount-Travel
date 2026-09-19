import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser } from '@/lib/auth/guards'
import { EmptyState, LinkButton } from '@/components/ui'
import { timeAgo } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const user = await requireOnboardedUser()

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })

  // Opening this page marks everything read.
  if (notifications.some((n) => !n.readAt)) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
  }

  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <h1 className="mb-6 text-display-md">Notifications</h1>

      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="When someone sends you a trip, joins one of yours or wants to connect, it will show up here."
          action={<LinkButton href="/discover">Back to your trips</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-card border border-ink-200 bg-white">
          {notifications.map((notification) => {
            const body = (
              <div className="flex gap-3 px-4 py-3.5">
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    notification.readAt ? 'bg-transparent' : 'bg-terracotta-500',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-0.5 text-sm text-ink-600 text-pretty">{notification.body}</p>
                  )}
                  <time className="mt-1 block text-xs text-ink-400">
                    {timeAgo(notification.createdAt)}
                  </time>
                </div>
              </div>
            )
            return (
              <li key={notification.id}>
                {notification.linkUrl ? (
                  <Link href={notification.linkUrl} className="block transition-colors hover:bg-ink-50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-ink-500 text-pretty">
        Email, push and SMS notifications are on the roadmap. For now everything lives here.
      </p>
    </div>
  )
}
