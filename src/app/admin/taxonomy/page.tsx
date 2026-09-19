import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/guards'
import { Alert, Badge, Card, CardBody } from '@/components/ui'
import { CATEGORY_META, RADAR_AXES } from '@/lib/taxonomy/dimensions'

export const metadata: Metadata = { title: 'Taxonomy', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * THE TAXONOMY
 *
 * Every interest the product understands. Adding one is a data change, not a
 * deploy — which is the point of storing it rather than hardcoding it.
 */
export default async function TaxonomyPage() {
  await requireAdmin()

  const [dimensions, usage, airports, destinations, tags] = await Promise.all([
    prisma.preferenceDimension.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.userPreference.groupBy({ by: ['dimensionId'], _count: { dimensionId: true } }),
    prisma.airport.count({ where: { isActive: true } }),
    prisma.destination.count({ where: { active: true } }),
    prisma.tag.count(),
  ])

  const usageById = new Map(usage.map((u) => [u.dimensionId, u._count.dimensionId]))
  const byCategory = new Map<string, typeof dimensions>()
  for (const dimension of dimensions) {
    const list = byCategory.get(dimension.category) ?? []
    list.push(dimension)
    byCategory.set(dimension.category, list)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-md">Taxonomy</h1>
        <p className="mt-1 text-ink-600">
          {dimensions.length} preference dimensions · {airports} airports · {destinations}{' '}
          destinations · {tags} tags
        </p>
      </div>

      <Alert tone="info" title="How the engine uses these">
        A member's 1–5 rating becomes an affinity between −1 and +1, so “actively avoid” genuinely
        counts against a trip. <strong>Engine weight</strong> lets a marquee interest like hiking
        count for more than a niche one like tennis. <strong>Radar axis</strong> decides which of
        the ten Travel DNA axes it rolls up into. The full formula is in RECOMMENDATIONS.md.
      </Alert>

      <section>
        <h2 className="text-lg font-semibold">Travel DNA axes</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {RADAR_AXES.map((axis) => (
            <Badge key={axis.key} variant="ocean">{axis.label}</Badge>
          ))}
        </div>
      </section>

      {[...byCategory.entries()].map(([category, items]) => (
        <section key={category}>
          <h2 className="text-lg font-semibold">
            {CATEGORY_META[category]?.label ?? category}{' '}
            <span className="text-sm font-normal text-ink-500">({items.length})</span>
          </h2>
          <Card className="mt-3">
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-ink-200 text-left">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Interest</th>
                    <th className="px-5 py-2.5 font-medium">Key</th>
                    <th className="px-5 py-2.5 font-medium">Radar axis</th>
                    <th className="px-5 py-2.5 font-medium">Engine weight</th>
                    <th className="px-5 py-2.5 font-medium">Answered by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {items.map((dimension) => (
                    <tr key={dimension.id} className={dimension.active ? '' : 'opacity-50'}>
                      <td className="px-5 py-2.5">
                        {dimension.label}
                        {dimension.isCore && <Badge variant="terracotta" className="ml-2">core</Badge>}
                        {dimension.kind === 'SPECTRUM' && (
                          <p className="text-xs text-ink-500">
                            {dimension.poleLowLabel} ←→ {dimension.poleHighLabel}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-ink-500">{dimension.key}</td>
                      <td className="px-5 py-2.5 text-ink-600">{dimension.radarAxis ?? '—'}</td>
                      <td className="px-5 py-2.5 tabular-nums">{dimension.engineWeight.toFixed(1)}</td>
                      <td className="px-5 py-2.5 tabular-nums text-ink-500">
                        {usageById.get(dimension.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </section>
      ))}
    </div>
  )
}
