import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { Badge, Card, CardBody } from '@/components/ui'
import { timeAgo } from '@/lib/utils'
import { expiringSoonWindow, staleBefore, STALE_AFTER_HOURS } from '@/lib/admin/timeWindows'

export const metadata: Metadata = { title: 'Data quality', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * DATA QUALITY
 *
 * The honest view of the marketplace: what is stale, what is incomplete, and
 * what we are showing as "Not specified" most often. This is what tells the
 * founder which provider relationships actually need improving.
 */
export default async function QualityPage() {
  await requireAdmin()

  const staleThreshold = staleBefore()
  const expiring = expiringSoonWindow()

  const [stale, lowConfidence, missingImages, missingAirfare, expiringSoon, byProvider] =
    await Promise.all([
      prisma.deal.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ sourceLastCheckedAt: null }, { sourceLastCheckedAt: { lt: staleThreshold } }],
        },
        select: {
          id: true, normalizedTitle: true, sourceLastCheckedAt: true,
          provider: { select: { name: true } },
        },
        orderBy: { sourceLastCheckedAt: 'asc' },
        take: 25,
      }),
      prisma.deal.count({ where: { status: 'ACTIVE', overallConfidence: { lt: 0.5 } } }),
      prisma.deal.count({ where: { status: 'ACTIVE', images: { none: {} } } }),
      prisma.deal.count({ where: { status: 'ACTIVE', airfareIncluded: null } }),
      prisma.deal.count({
        where: {
          status: 'ACTIVE',
          expiresAt: { gte: expiring.from, lte: expiring.to },
        },
      }),
      prisma.deal.groupBy({
        by: ['providerId'],
        where: { status: 'ACTIVE' },
        _avg: { overallConfidence: true },
        _count: { providerId: true },
      }),
    ])

  const providers = await prisma.provider.findMany({
    where: { id: { in: byProvider.map((p) => p.providerId) } },
    select: { id: true, name: true },
  })

  const providerQuality = byProvider
    .map((row) => ({
      name: providers.find((p) => p.id === row.providerId)?.name ?? 'Unknown',
      confidence: row._avg.overallConfidence ?? 0,
      count: row._count.providerId,
    }))
    .sort((a, b) => a.confidence - b.confidence)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Data quality</h1>
        <p className="mt-1 text-ink-600 text-pretty">
          What we do not know, and which providers give us the least. This is the list that tells
          you which relationships to improve.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: `Not checked in ${STALE_AFTER_HOURS}h`, value: stale.length, tone: 'gold' as const },
          { label: 'Low confidence', value: lowConfidence, tone: 'gold' as const },
          { label: 'No images', value: missingImages, tone: 'berry' as const },
          { label: 'Airfare unknown', value: missingAirfare, tone: 'neutral' as const },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-200 bg-white p-4">
            <dt className="text-xs uppercase tracking-wider text-ink-500">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-lg font-semibold">Average data completeness by provider</h2>
        <Card className="mt-3">
          <CardBody>
            <ul className="space-y-2.5">
              {providerQuality.map((provider) => (
                <li key={provider.name} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 truncate">{provider.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span
                      className={`block h-full rounded-full ${
                        provider.confidence >= 0.75
                          ? 'bg-moss-500'
                          : provider.confidence >= 0.5
                            ? 'bg-gold-500'
                            : 'bg-berry-500'
                      }`}
                      style={{ width: `${provider.confidence * 100}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums text-ink-600">
                    {Math.round(provider.confidence * 100)}%
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-ink-400">
                    {provider.count} deals
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Oldest unchecked deals</h2>
        <p className="mt-1 text-sm text-ink-600">
          These are still shown, but with an honest “last checked” note on the card.
        </p>
        <Card className="mt-3">
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {stale.map((deal) => (
                <li key={deal.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <Link href={`/deals/${deal.id}`} className="min-w-0 truncate hover:underline">
                    {deal.normalizedTitle}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-500">{deal.provider.name}</span>
                  <Badge variant="gold">
                    {deal.sourceLastCheckedAt ? timeAgo(deal.sourceLastCheckedAt) : 'never checked'}
                  </Badge>
                </li>
              ))}
              {stale.length === 0 && (
                <li className="px-5 py-4 text-sm text-ink-500">Everything has been checked recently.</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </section>

      {expiringSoon > 0 && (
        <p className="text-sm text-ink-600">
          {expiringSoon} deal(s) expire within a week and will move to “possibly expired”
          automatically.
        </p>
      )}
    </div>
  )
}
