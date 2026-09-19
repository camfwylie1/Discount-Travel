import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { Badge, Card, CardBody, Input } from '@/components/ui'
import { DealRowActions } from '@/components/admin/AdminActions'
import { formatMoneyCompact } from '@/config/pricing'
import { formatDate, timeAgo } from '@/lib/utils'
import { countryName } from '@/components/deals/DealCard'

export const metadata: Metadata = { title: 'Deals', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, 'moss' | 'gold' | 'berry' | 'neutral'> = {
  ACTIVE: 'moss', DRAFT: 'neutral', POSSIBLY_EXPIRED: 'gold',
  EXPIRED: 'berry', SOLD_OUT: 'berry', UNKNOWN: 'neutral', ARCHIVED: 'neutral',
}

export default async function AdminDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; provider?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const deals = await prisma.deal.findMany({
    where: {
      ...(params.status ? { status: params.status as 'ACTIVE' } : {}),
      ...(params.provider ? { provider: { slug: params.provider } } : {}),
      ...(params.q
        ? { normalizedTitle: { contains: params.q, mode: 'insensitive' as const } }
        : {}),
    },
    include: {
      provider: { select: { name: true, slug: true } },
      departureAirport: { select: { iata: true } },
      _count: { select: { savedBy: true, clicks: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const statusCounts = await prisma.deal.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Deals</h1>
        <p className="mt-1 text-ink-600">
          {deals.length} shown. Change a status, feature a deal, or mark one as re-verified.
        </p>
      </div>

      <form className="flex flex-wrap gap-3">
        <Input name="q" defaultValue={params.q ?? ''} placeholder="Search titles…" className="max-w-xs" aria-label="Search deals" />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="rounded-xl border border-ink-300 bg-white px-3 py-2.5 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statusCounts.map((s) => (
            <option key={s.status} value={s.status}>
              {s.status.replace(/_/g, ' ').toLowerCase()} ({s._count.status})
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-ink-900 px-5 text-sm font-medium text-white">
          Filter
        </button>
      </form>

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="border-b border-ink-200 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Deal</th>
                <th className="px-5 py-3 font-medium">Provider</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Departs</th>
                <th className="px-5 py-3 font-medium">Quality</th>
                <th className="px-5 py-3 font-medium">Engagement</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td className="max-w-xs px-5 py-3">
                    <Link href={`/deals/${deal.id}`} className="font-medium hover:underline">
                      {deal.normalizedTitle}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {countryName(deal.destinationCountry)} · {deal.durationNights ?? '?'} nights
                      {deal.isDemoContent && <span className="ml-1 text-gold-700">· demo</span>}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-ink-600">{deal.provider.name}</td>
                  <td className="px-5 py-3 tabular-nums">
                    {formatMoneyCompact(deal.salePriceCents, deal.currency)}
                    {deal.discountPercent && (
                      <span className="ml-1 text-xs text-terracotta-600">
                        −{Math.round(deal.discountPercent)}%
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {deal.departureAirport?.iata ?? '—'}
                    <p className="text-xs text-ink-500">{formatDate(deal.departureDate)}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="tabular-nums">{Math.round(deal.overallConfidence * 100)}%</span>
                    {deal.qualityIssues.length > 0 && (
                      <p className="text-xs text-gold-700">{deal.qualityIssues.length} issues</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-500">
                    {deal._count.savedBy} saves · {deal._count.clicks} clicks
                    <p>checked {deal.sourceLastCheckedAt ? timeAgo(deal.sourceLastCheckedAt) : 'never'}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={STATUS_TONE[deal.status] ?? 'neutral'}>
                      {deal.status.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                    {deal.featured && <Badge variant="gold" className="ml-1">featured</Badge>}
                  </td>
                  <td className="px-5 py-3">
                    <DealRowActions dealId={deal.id} status={deal.status} featured={deal.featured} />
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
