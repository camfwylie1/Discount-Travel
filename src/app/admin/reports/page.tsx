import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireModerator } from '@/lib/auth/guards'
import { Badge, Card, CardBody, EmptyState } from '@/components/ui'
import { ModerationActions } from '@/components/admin/AdminActions'
import { timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Moderation', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  await requireModerator()

  const [open, resolved] = await Promise.all([
    prisma.report.findMany({
      where: { status: { in: ['OPEN', 'REVIEWING'] } },
      include: {
        reporter: { select: { id: true, profile: { select: { firstName: true } } } },
        reportedUser: { select: { id: true, status: true, profile: { select: { firstName: true } } } },
        message: { select: { id: true, body: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.report.findMany({
      where: { status: { in: ['ACTIONED', 'DISMISSED'] } },
      include: { resolver: { select: { email: true } } },
      orderBy: { resolvedAt: 'desc' },
      take: 20,
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Moderation queue</h1>
        <p className="mt-1 text-ink-600">
          {open.length === 0 ? 'Nothing waiting.' : `${open.length} report(s) waiting for a decision.`}
        </p>
      </div>

      {open.length === 0 ? (
        <EmptyState title="The queue is empty" description="Reports from members will appear here." />
      ) : (
        <ul className="space-y-4">
          {open.map((report) => (
            <li key={report.id}>
              <Card>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="berry">{report.kind.toLowerCase()}</Badge>
                        <Badge variant="neutral">{report.reason.replace(/_/g, ' ').toLowerCase()}</Badge>
                        <span className="text-xs text-ink-500">{timeAgo(report.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm">
                        Reported by{' '}
                        <Link href={`/people/${report.reporterId}`} className="underline underline-offset-2">
                          {report.reporter.profile?.firstName ?? 'a member'}
                        </Link>
                        {report.reportedUser && (
                          <>
                            {' '}about{' '}
                            <Link href={`/people/${report.reportedUserId}`} className="underline underline-offset-2">
                              {report.reportedUser.profile?.firstName ?? 'a member'}
                            </Link>
                            {report.reportedUser.status === 'SUSPENDED' && (
                              <Badge variant="berry" className="ml-2">already suspended</Badge>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <code className="text-xs text-ink-400">{report.id.slice(-8).toUpperCase()}</code>
                  </div>

                  {report.detail && (
                    <blockquote className="mt-3 border-l-2 border-ink-200 pl-3 text-sm text-ink-700 text-pretty">
                      {report.detail}
                    </blockquote>
                  )}

                  {report.message && (
                    <div className="mt-3 rounded-xl bg-ink-50 p-3">
                      <p className="text-xs font-medium text-ink-500">The reported message</p>
                      <p className="mt-1 text-sm text-ink-800 text-pretty">{report.message.body}</p>
                    </div>
                  )}

                  <div className="mt-4 border-t border-ink-100 pt-4">
                    <ModerationActions reportId={report.id} />
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {resolved.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Recently resolved</h2>
          <Card className="mt-3">
            <CardBody className="p-0">
              <ul className="divide-y divide-ink-100">
                {resolved.map((report) => (
                  <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>
                      <Badge variant={report.status === 'ACTIONED' ? 'berry' : 'neutral'}>
                        {report.status.toLowerCase()}
                      </Badge>
                      <span className="ml-2 text-ink-600">
                        {report.reason.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </span>
                    <span className="text-xs text-ink-500">
                      {report.resolver?.email} · {timeAgo(report.resolvedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </section>
      )}
    </div>
  )
}
