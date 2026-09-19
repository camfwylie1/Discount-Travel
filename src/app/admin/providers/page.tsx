import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { Alert, Badge, Card, CardBody } from '@/components/ui'
import { formatDate, timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Providers', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_TONE: Record<string, 'moss' | 'gold' | 'berry' | 'neutral'> = {
  PERMITTED: 'moss',
  PERMITTED_WITH_CONDITIONS: 'gold',
  UNDER_REVIEW: 'gold',
  NOT_REVIEWED: 'neutral',
  BLOCKED: 'berry',
}

/**
 * THE PROVIDER INTEGRATION MATRIX.
 *
 * This is the answer to "are we actually allowed to use this provider's
 * content?" — and the ingestion pipeline enforces whatever is recorded here.
 */
export default async function ProvidersPage() {
  await requireAdmin()

  const providers = await prisma.provider.findMany({
    include: {
      compliance: true,
      _count: { select: { deals: true, clicks: true } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })

  const blocked = providers.filter((p) => p.compliance?.status === 'BLOCKED')
  const unreviewed = providers.filter(
    (p) => !p.compliance || p.compliance.status === 'NOT_REVIEWED',
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Providers</h1>
        <p className="mt-1 text-ink-600 text-pretty">
          The integration matrix. Whatever is recorded here is what the ingestion pipeline will
          allow — it is not advisory.
        </p>
      </div>

      {unreviewed.length > 0 && (
        <Alert tone="warning" title={`${unreviewed.length} provider(s) have not been reviewed`}>
          Nothing can be imported from a provider until someone has read their terms of service and
          recorded what is permitted. The pipeline refuses them.
        </Alert>
      )}
      {blocked.length > 0 && (
        <Alert tone="error" title={`${blocked.length} provider(s) are blocked`}>
          {blocked.map((p) => p.name).join(', ')} — ingestion is refused for these.
        </Alert>
      )}

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-ink-200 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Provider</th>
                <th className="px-5 py-3 font-medium">Compliance</th>
                <th className="px-5 py-3 font-medium">Permitted methods</th>
                <th className="px-5 py-3 font-medium">Affiliate</th>
                <th className="px-5 py-3 font-medium">Deals</th>
                <th className="px-5 py-3 font-medium">Clicks</th>
                <th className="px-5 py-3 font-medium">Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {providers.map((provider) => {
                const compliance = provider.compliance
                const status = compliance?.status ?? 'NOT_REVIEWED'
                return (
                  <tr key={provider.id} className={provider.active ? '' : 'opacity-60'}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-xs text-ink-500">{provider.websiteUrl}</p>
                      {provider.sponsored && <Badge variant="gold" className="mt-1">Sponsored</Badge>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_TONE[status] ?? 'neutral'}>
                        {status.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                      {compliance?.blockedReason && (
                        <p className="mt-1 max-w-xs text-xs text-berry-700">{compliance.blockedReason}</p>
                      )}
                      {compliance?.maxCacheHours && (
                        <p className="mt-1 text-xs text-ink-500">
                          Refresh every {compliance.maxCacheHours}h
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {compliance?.allowedMethods.length ? (
                        <div className="flex flex-wrap gap-1">
                          {compliance.allowedMethods.map((method) => (
                            <Badge key={method} variant="neutral">
                              {method.replace(/_/g, ' ').toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-400">none</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {compliance?.hasAffiliateProgram ? (
                        <>
                          <Badge variant="moss">yes</Badge>
                          {compliance.commissionModel && (
                            <p className="mt-1 max-w-[14rem] text-xs text-ink-500">
                              {compliance.commissionModel}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-400">no</span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{provider._count.deals}</td>
                    <td className="px-5 py-3 tabular-nums">{provider._count.clicks}</td>
                    <td className="px-5 py-3 text-xs text-ink-500">
                      {compliance?.termsReviewedAt ? formatDate(compliance.termsReviewedAt) : 'never'}
                      {compliance?.lastSyncAt && (
                        <p>synced {timeAgo(compliance.lastSyncAt)}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Alert tone="info" title="Adding a real provider">
        Create the provider, then complete their compliance record from the research you have on
        them: what their terms permit, whether they have an API or an affiliate feed, their
        attribution and caching requirements. Until that record says a method is permitted, the
        pipeline will refuse it. The full process is in DATA_INGESTION.md.
      </Alert>
    </div>
  )
}
