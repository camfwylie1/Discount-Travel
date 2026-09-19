import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { Alert, Badge, Card, CardBody, EmptyState } from '@/components/ui'
import { DuplicateActions } from '@/components/admin/AdminActions'
import { formatMoneyCompact } from '@/config/pricing'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Duplicates', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function DuplicatesPage() {
  await requireAdmin()

  const candidates = await prisma.duplicateCandidate.findMany({
    where: { verdict: 'PENDING' },
    include: {
      dealA: {
        select: {
          id: true, normalizedTitle: true, salePriceCents: true, currency: true,
          departureDate: true, durationNights: true, destinationCountry: true,
          provider: { select: { name: true } },
        },
      },
      dealB: {
        select: {
          id: true, normalizedTitle: true, salePriceCents: true, currency: true,
          departureDate: true, durationNights: true, destinationCountry: true,
          provider: { select: { name: true } },
        },
      },
    },
    orderBy: { score: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-md">Possible duplicates</h1>
        <p className="mt-1 text-ink-600 text-pretty">
          The pipeline merges only what it is certain about. Anything uncertain comes here instead
          of being deleted.
        </p>
      </div>

      <Alert tone="info" title="Two providers selling a similar trip is not a duplicate">
        We want both, each with its own attribution. Only flag a pair as duplicate when it is
        genuinely the same product listed twice.
      </Alert>

      {candidates.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Uncertain duplicate matches will appear here after an import."
        />
      ) : (
        <ul className="space-y-4">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <Card>
                <CardBody>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={candidate.score > 0.85 ? 'berry' : 'gold'}>
                      {Math.round(candidate.score * 100)}% similar
                    </Badge>
                    <span className="text-xs text-ink-400">{formatDate(candidate.createdAt)}</span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[candidate.dealA, candidate.dealB].map((deal, i) => (
                      <div key={deal.id} className="rounded-xl border border-ink-200 p-4">
                        <p className="text-xs uppercase tracking-wider text-ink-500">
                          {i === 0 ? 'First' : 'Second'}
                        </p>
                        <Link href={`/deals/${deal.id}`} className="mt-1 block font-medium hover:underline">
                          {deal.normalizedTitle}
                        </Link>
                        <dl className="mt-2 space-y-0.5 text-xs text-ink-600">
                          <div>{deal.provider.name}</div>
                          <div>{formatMoneyCompact(deal.salePriceCents, deal.currency)}</div>
                          <div>
                            {formatDate(deal.departureDate)} · {deal.durationNights ?? '?'} nights
                          </div>
                          <div>{deal.destinationCountry ?? 'Destination not specified'}</div>
                        </dl>
                      </div>
                    ))}
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-ink-500">
                      Why they were flagged
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-50 p-3 text-xs">
                      {JSON.stringify(candidate.signals, null, 2)}
                    </pre>
                  </details>

                  <div className="mt-4 border-t border-ink-100 pt-4">
                    <DuplicateActions
                      candidateId={candidate.id}
                      dealAId={candidate.dealAId}
                      dealBId={candidate.dealBId}
                    />
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
