import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { ImportPanel } from '@/components/admin/ImportPanel'
import { Alert, Badge, Card, CardBody } from '@/components/ui'
import { timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Imports', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  await requireAdmin()

  const [providers, batches] = await Promise.all([
    prisma.provider.findMany({
      include: { compliance: true },
      orderBy: { name: 'asc' },
    }),
    prisma.importBatch.findMany({
      include: { provider: { select: { name: true } }, uploadedBy: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Import deals</h1>
        <p className="mt-1 text-ink-600 text-pretty">
          Upload a CSV, JSON or XML file. Always validate first — it tells you exactly what would
          happen without writing anything.
        </p>
      </div>

      <Alert tone="info" title="The compliance gate runs first">
        A provider whose terms have not been reviewed, or who does not permit the method you are
        using, is refused before the file is read at all. Set that up on the Providers page.
      </Alert>

      <Card>
        <CardBody>
          <ImportPanel
            providers={providers.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.compliance?.status ?? 'NOT_REVIEWED',
              allowedMethods: p.compliance?.allowedMethods ?? [],
            }))}
          />
        </CardBody>
      </Card>

      <section>
        <h2 className="text-lg font-semibold">Recent imports</h2>
        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Nothing imported yet.</p>
        ) : (
          <Card className="mt-3">
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-200 text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">When</th>
                    <th className="px-5 py-3 font-medium">Provider</th>
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-5 py-3 font-medium">Result</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {batches.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-5 py-3 text-ink-500">{timeAgo(batch.createdAt)}</td>
                      <td className="px-5 py-3">{batch.provider?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-ink-600">
                        {batch.filename ?? batch.format.toUpperCase()}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {batch.importedRows}/{batch.totalRows} imported
                        {batch.invalidRows > 0 && (
                          <span className="ml-2 text-berry-500">{batch.invalidRows} rejected</span>
                        )}
                        {batch.duplicateRows > 0 && (
                          <span className="ml-2 text-gold-700">{batch.duplicateRows} duplicate</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            batch.status === 'COMPLETED'
                              ? 'moss'
                              : batch.status === 'FAILED'
                                ? 'berry'
                                : batch.status === 'COMPLETED_WITH_ERRORS'
                                  ? 'gold'
                                  : 'neutral'
                          }
                        >
                          {batch.status.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  )
}
