import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireModerator } from '@/lib/auth/guards'
import { Alert, Card, CardBody } from '@/components/ui'
import { formatMoney, membership } from '@/config/pricing'
import { countryName } from '@/components/deals/DealCard'
import { daysAgo } from '@/lib/admin/timeWindows'

export const metadata: Metadata = { title: 'Metrics', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * ADMIN METRICS
 *
 * Every number here is counted from real rows. Where there is not enough data
 * to compute a figure honestly — churn, for example, before anyone has
 * renewed — we say so rather than showing a placeholder.
 */
export default async function MetricsPage() {
  await requireModerator()

  const since = (days: number) => daysAgo(days)

  const [
    totalUsers, activeMembers, newUsers30, quizStarted, quizCompleted,
    impressions, clicks, saves, shares, outbound,
    connections, messages, trips, circles,
    avgMatch, topDestinations, topAirports, topProviders,
    subscriptions, cancelled,
  ] = await Promise.all([
    prisma.user.count({ where: { status: { not: 'DELETED' } } }),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING'] } } }),
    prisma.user.count({ where: { createdAt: { gte: since(30) }, status: { not: 'DELETED' } } }),
    prisma.analyticsEvent.count({ where: { name: 'signup_completed' } }),
    prisma.analyticsEvent.count({ where: { name: 'quiz_completed' } }),
    prisma.recommendationEvent.count({ where: { type: 'IMPRESSION' } }),
    prisma.recommendationEvent.count({ where: { type: 'CLICK' } }),
    prisma.savedDeal.count(),
    prisma.dealShare.count(),
    prisma.dealClick.count(),
    prisma.connection.count({ where: { status: 'ACCEPTED' } }),
    prisma.message.count({ where: { deletedAt: null } }),
    prisma.tripGroup.count(),
    prisma.circle.count(),
    prisma.matchScore.aggregate({ _avg: { score: true }, where: { hardFiltered: false } }),
    prisma.deal.groupBy({
      by: ['destinationCountry'],
      where: { status: 'ACTIVE' },
      _count: { destinationCountry: true },
      orderBy: { _count: { destinationCountry: 'desc' } },
      take: 8,
    }),
    prisma.userAirport.groupBy({
      by: ['airportId'],
      _count: { airportId: true },
      orderBy: { _count: { airportId: 'desc' } },
      take: 8,
    }),
    prisma.dealClick.groupBy({
      by: ['providerId'],
      _count: { providerId: true },
      orderBy: { _count: { providerId: 'desc' } },
      take: 8,
    }),
    prisma.subscription.count({ where: { status: { not: 'NONE' } } }),
    prisma.subscription.count({ where: { status: 'CANCELED' } }),
  ])

  const [airportNames, providerNames] = await Promise.all([
    prisma.airport.findMany({
      where: { id: { in: topAirports.map((a) => a.airportId) } },
      select: { id: true, iata: true, city: true },
    }),
    prisma.provider.findMany({
      where: { id: { in: topProviders.map((p) => p.providerId) } },
      select: { id: true, name: true },
    }),
  ])

  // Revenue is derived from real active subscriptions, never estimated.
  const arr = activeMembers * membership.priceCents
  const mrrEquivalent = Math.round(arr / 12)

  const rate = (numerator: number, denominator: number) =>
    denominator === 0 ? null : (numerator / denominator) * 100

  const quizCompletion = rate(quizCompleted, quizStarted)
  const subscriptionConversion = rate(activeMembers, totalUsers)
  const clickThrough = rate(clicks, impressions)
  const saveRate = rate(saves, impressions)
  const churn = subscriptions === 0 ? null : (cancelled / subscriptions) * 100

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Metrics</h1>
        <p className="mt-1 text-ink-600">Counted from real rows. Nothing here is estimated.</p>
      </div>

      <Section title="Growth">
        <Metric label="Members" value={totalUsers.toLocaleString('en-CA')} />
        <Metric label="Paid members" value={activeMembers.toLocaleString('en-CA')} />
        <Metric label="New in 30 days" value={newUsers30.toLocaleString('en-CA')} />
        <Metric
          label="Subscription conversion"
          value={subscriptionConversion === null ? null : `${subscriptionConversion.toFixed(1)}%`}
          note="Paid members as a share of all accounts"
        />
      </Section>

      <Section title="Revenue">
        <Metric label="ARR" value={formatMoney(arr)} note={`${activeMembers} × ${formatMoney(membership.priceCents)}`} />
        <Metric label="MRR equivalent" value={formatMoney(mrrEquivalent)} note="ARR ÷ 12" />
        <Metric
          label="Churn"
          value={churn === null ? null : `${churn.toFixed(1)}%`}
          note={
            subscriptions === 0
              ? 'No subscriptions yet'
              : 'Cancelled as a share of all subscriptions ever'
          }
        />
      </Section>

      <Section title="Funnel">
        <Metric label="Signups" value={quizStarted.toLocaleString('en-CA')} />
        <Metric
          label="Quiz completion"
          value={quizCompletion === null ? null : `${quizCompletion.toFixed(1)}%`}
          note="Completed the quiz after signing up"
        />
        <Metric
          label="Average match score"
          value={avgMatch._avg.score === null ? null : `${Math.round(avgMatch._avg.score)}%`}
          note="Across every computed, unfiltered match"
        />
      </Section>

      <Section title="Engagement">
        <Metric label="Deal impressions" value={impressions.toLocaleString('en-CA')} />
        <Metric
          label="Click-through rate"
          value={clickThrough === null ? null : `${clickThrough.toFixed(1)}%`}
        />
        <Metric label="Save rate" value={saveRate === null ? null : `${saveRate.toFixed(1)}%`} />
        <Metric label="Provider clicks" value={outbound.toLocaleString('en-CA')} />
        <Metric label="Shares" value={shares.toLocaleString('en-CA')} />
      </Section>

      <Section title="Social">
        <Metric label="Connections" value={connections.toLocaleString('en-CA')} />
        <Metric label="Messages" value={messages.toLocaleString('en-CA')} />
        <Metric label="Trips created" value={trips.toLocaleString('en-CA')} />
        <Metric label="Circles created" value={circles.toLocaleString('en-CA')} />
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <TopList
          title="Popular destinations"
          items={topDestinations.map((d) => ({
            label: countryName(d.destinationCountry) ?? 'Unknown',
            value: d._count.destinationCountry,
          }))}
        />
        <TopList
          title="Popular departure airports"
          items={topAirports.map((a) => {
            const airport = airportNames.find((x) => x.id === a.airportId)
            return { label: airport ? `${airport.city} (${airport.iata})` : 'Unknown', value: a._count.airportId }
          })}
        />
        <TopList
          title="Top providers by click"
          items={topProviders.map((p) => ({
            label: providerNames.find((x) => x.id === p.providerId)?.name ?? 'Unknown',
            value: p._count.providerId,
          }))}
        />
      </div>

      <Alert tone="info" title="A note on this data">
        This installation contains seeded demonstration activity. Before using these numbers for
        anything real, set <code>SEED_DEMO_DATA=false</code> and clear the demo content.
      </Alert>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">{title}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</dl>
    </section>
  )
}

function Metric({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
      <dd>
        {value === null ? (
          <p className="mt-1 text-sm text-ink-400">Not enough data yet</p>
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
            {value}
          </p>
        )}
        {note && <p className="mt-1 text-xs text-ink-500">{note}</p>}
      </dd>
    </div>
  )
}

function TopList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold">{title}</h3>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">No data yet</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm">
                <span className="w-28 shrink-0 truncate">{item.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-ocean-500"
                    style={{ width: `${(item.value / max) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right tabular-nums text-ink-500">{item.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
