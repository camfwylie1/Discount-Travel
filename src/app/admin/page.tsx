import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireModerator } from '@/lib/auth/guards'
import { ai } from '@/lib/ai'
import { stripeConfigured } from '@/lib/billing/stripe'
import { flagDefaults } from '@/config/flags'
import { staleBefore } from '@/lib/admin/timeWindows'
import { Alert, Badge, Card, CardBody } from '@/components/ui'
import { timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  await requireModerator()

  const [
    users, members, deals, activeDeals, providers, blockedProviders,
    openReports, pendingDuplicates, failedImports, staleDeals, demoDeals,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    prisma.deal.count(),
    prisma.deal.count({ where: { status: 'ACTIVE' } }),
    prisma.provider.count(),
    prisma.providerCompliance.count({ where: { status: 'BLOCKED' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
    prisma.duplicateCandidate.count({ where: { verdict: 'PENDING' } }),
    prisma.importBatch.count({ where: { status: { in: ['FAILED', 'COMPLETED_WITH_ERRORS'] } } }),
    prisma.deal.count({
      where: {
        status: 'ACTIVE',
        OR: [
          { sourceLastCheckedAt: null },
          { sourceLastCheckedAt: { lt: staleBefore() } },
        ],
      },
    }),
    prisma.deal.count({ where: { isDemoContent: true } }),
  ])

  const aiStatus = ai.status()

  const actions = [
    { count: openReports, label: 'open moderation reports', href: '/admin/reports', urgent: true },
    { count: pendingDuplicates, label: 'duplicates awaiting review', href: '/admin/duplicates', urgent: false },
    { count: failedImports, label: 'imports with errors', href: '/admin/imports', urgent: true },
    { count: staleDeals, label: 'deals not checked in 72 hours', href: '/admin/quality', urgent: false },
  ].filter((a) => a.count > 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Overview</h1>
        <p className="mt-1 text-ink-600">Everything that needs a human, and the state of the system.</p>
      </div>

      {actions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Needs attention</h2>
          <ul className="mt-3 space-y-2">
            {actions.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    action.urgent
                      ? 'border-berry-500/30 bg-berry-100 hover:border-berry-500/60'
                      : 'border-gold-300 bg-gold-100 hover:border-gold-500'
                  }`}
                >
                  <span className="text-sm">
                    <strong className="font-semibold tabular-nums">{action.count}</strong> {action.label}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">At a glance</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Members', value: users },
            { label: 'Paid members', value: members },
            { label: 'Deals (active)', value: activeDeals },
            { label: 'Deals (total)', value: deals },
            { label: 'Providers', value: providers },
            { label: 'Blocked providers', value: blockedProviders },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-ink-200 bg-white p-4">
              <dt className="text-xs uppercase tracking-wider text-ink-500">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                {stat.value.toLocaleString('en-CA')}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {demoDeals > 0 && (
        <Alert tone="warning" title="This installation contains demonstration inventory">
          {demoDeals.toLocaleString('en-CA')} deals are flagged as demo content and labelled as such
          throughout the product. Before going live, set <code>SEED_DEMO_DATA=false</code> and remove
          them.
        </Alert>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">System</h2>
        <Card className="mt-3">
          <CardBody>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Status
                label="AI provider"
                value={aiStatus.active}
                detail={aiStatus.usingFallback ? 'Using the built-in deterministic writer' : (aiStatus.model ?? '')}
                tone={aiStatus.usingFallback ? 'neutral' : 'moss'}
              />
              <Status
                label="Payments"
                value={stripeConfigured() ? 'Stripe configured' : 'Not configured'}
                detail={stripeConfigured() ? 'Checkout available' : 'Checkout disabled'}
                tone={stripeConfigured() ? 'moss' : 'gold'}
              />
              <Status
                label="Email"
                value={process.env.EMAIL_DRIVER ?? 'console'}
                detail={
                  (process.env.EMAIL_DRIVER ?? 'console') === 'console'
                    ? 'Links print to the server log'
                    : 'Sending real email'
                }
                tone={(process.env.EMAIL_DRIVER ?? 'console') === 'console' ? 'gold' : 'moss'}
              />
              <Status
                label="File storage"
                value={process.env.STORAGE_DRIVER ?? 'local'}
                detail={(process.env.STORAGE_DRIVER ?? 'local') === 'local' ? 'Writing to ./public/uploads' : ''}
                tone="neutral"
              />
              <Status
                label="Error monitoring"
                value={process.env.SENTRY_DSN ? 'Connected' : 'Not configured'}
                tone={process.env.SENTRY_DSN ? 'moss' : 'gold'}
              />
              <Status
                label="Recommendation engine"
                value="1.0.0"
                detail="Deterministic, explainable"
                tone="moss"
              />
            </dl>
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Feature flags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(flagDefaults).map(([name, enabled]) => (
            <Badge key={name} variant={enabled ? 'moss' : 'neutral'}>
              {name.replace(/_/g, ' ').toLowerCase()}: {enabled ? 'on' : 'off'}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-500">Set in environment variables. See .env.example.</p>
      </section>

      <RecentActivity />
    </div>
  )
}

function Status({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail?: string
  tone?: 'moss' | 'gold' | 'neutral'
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1">
        <Badge variant={tone}>{value}</Badge>
        {detail && <p className="mt-1 text-xs text-ink-500">{detail}</p>}
      </dd>
    </div>
  )
}

async function RecentActivity() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, action: true, entityType: true, actorEmail: true, createdAt: true },
  })
  if (logs.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Recent admin activity</h2>
      <Card className="mt-3">
        <CardBody className="p-0">
          <ul className="divide-y divide-ink-100">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                <span className="font-mono text-xs">{log.action}</span>
                <span className="text-ink-500">{log.entityType}</span>
                <span className="text-xs text-ink-400">{timeAgo(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </section>
  )
}
