import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser } from '@/lib/auth/guards'
import { PreferenceCards } from '@/components/onboarding/PreferenceCards'
import { SpectrumSliders } from '@/components/onboarding/SpectrumSliders'
import { AirportPicker } from '@/components/onboarding/AirportPicker'
import { BudgetStep } from '@/components/onboarding/BudgetStep'
import { WishlistStep } from '@/components/onboarding/WishlistStep'
import { Alert, Card, CardBody, LinkButton } from '@/components/ui'
import { CATEGORY_META } from '@/lib/taxonomy/dimensions'

export const metadata: Metadata = { title: 'How you travel', robots: { index: false } }
export const dynamic = 'force-dynamic'

const SECTIONS = [
  { key: 'airports', label: 'Departure airports' },
  { key: 'budget', label: 'Budget, dates and trip length' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'TRAVEL_STYLE', label: 'Travel style' },
  { key: 'ACTIVITY', label: 'Activities' },
  { key: 'FOOD_DRINK', label: 'Food and drink' },
  { key: 'CULTURE', label: 'Culture' },
  { key: 'SOCIAL', label: 'Social style' },
  { key: 'ACCOMMODATION', label: 'Comfort' },
  { key: 'SPECTRUM', label: 'Travel spectrum' },
]

export default async function TravelSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const { section = 'airports' } = await searchParams
  const user = await requireOnboardedUser()

  return (
    <div className="space-y-6">
      <Alert tone="info">
        Nothing here is locked in. Change anything and your recommendations update immediately.
      </Alert>

      <nav className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Preference sections">
        {SECTIONS.map((item) => (
          <Link
            key={item.key}
            href={`/settings/travel?section=${item.key}`}
            aria-current={section === item.key ? 'page' : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2 text-sm transition-colors ${
              section === item.key
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-300 bg-white text-ink-700 hover:border-ink-500'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <SectionBody section={section} userId={user.id} />

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium">Want to start over?</p>
            <p className="mt-0.5 text-sm text-ink-600">
              Retake the whole quiz. Your existing answers are kept until you overwrite them.
            </p>
          </div>
          <LinkButton href="/onboarding/scenarios" variant="outline">
            Retake the quiz
          </LinkButton>
        </CardBody>
      </Card>
    </div>
  )
}

async function SectionBody({ section, userId }: { section: string; userId: string }) {
  const here = '/settings/travel'

  if (section === 'airports') {
    const [airports, selected, constraints] = await Promise.all([
      prisma.airport.findMany({ where: { isActive: true, country: 'CA' }, orderBy: { sortOrder: 'asc' } }),
      prisma.userAirport.findMany({
        where: { userId, isTemporary: false },
        orderBy: { rank: 'asc' },
        include: { airport: { select: { iata: true } } },
      }),
      prisma.travelConstraint.findUnique({ where: { userId } }),
    ])
    const toOption = (a: (typeof airports)[number]) => ({
      iata: a.iata, name: a.name, city: a.city, region: a.region, isGateway: a.isGateway,
    })
    return (
      <AirportPicker
        nextHref={`${here}?section=budget`}
        backHref={null}
        gateways={airports.filter((a) => a.isGateway).map(toOption)}
        secondary={airports.filter((a) => !a.isGateway).map(toOption)}
        selected={selected.map((s) => s.airport.iata)}
        airportsAreHard={constraints?.airportsAreHard ?? false}
        includeNearby={constraints?.includeNearbyAirports ?? true}
      />
    )
  }

  if (section === 'budget') {
    const constraints = await prisma.travelConstraint.findUnique({ where: { userId } })
    return (
      <BudgetStep
        nextHref={`${here}?section=wishlist`}
        backHref={null}
        initial={{
          budgetPreferred: constraints?.budgetPreferred ?? null,
          budgetMax: constraints?.budgetMax ?? null,
          budgetMaxIsHard: constraints?.budgetMaxIsHard ?? true,
          durationMin: constraints?.durationMin ?? null,
          durationMax: constraints?.durationMax ?? null,
          durationPreferred: constraints?.durationPreferred ?? null,
          durationIsHard: constraints?.durationIsHard ?? false,
          preferredMonths: constraints?.preferredMonths ?? [],
          partySize: constraints?.partySize ?? 1,
          dateFlexibilityDays: constraints?.dateFlexibilityDays ?? 7,
        }}
      />
    )
  }

  if (section === 'wishlist') {
    const [destinations, existing] = await Promise.all([
      prisma.destination.findMany({
        where: { kind: 'COUNTRY', active: true },
        orderBy: { name: 'asc' },
        select: { slug: true, name: true },
      }),
      prisma.wishlistItem.findMany({ where: { userId }, select: { id: true, label: true } }),
    ])
    return (
      <WishlistStep
        nextHref={`${here}?section=TRAVEL_STYLE`}
        backHref={null}
        existing={existing}
        suggestions={destinations.map((d) => ({ slug: d.slug, name: d.name, kind: 'COUNTRY' as const }))}
      />
    )
  }

  if (section === 'SPECTRUM') {
    const [dimensions, answers] = await Promise.all([
      prisma.preferenceDimension.findMany({ where: { kind: 'SPECTRUM', active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.userPreference.findMany({ where: { userId }, select: { dimensionId: true, spectrum: true } }),
    ])
    const byId = new Map(answers.map((a) => [a.dimensionId, a.spectrum]))
    return (
      <SpectrumSliders
        step=""
        nextHref={here}
        backHref={null}
        spectrums={dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          lowLabel: d.poleLowLabel ?? 'Less',
          highLabel: d.poleHighLabel ?? 'More',
          value: byId.get(d.id) ?? null,
        }))}
      />
    )
  }

  const meta = CATEGORY_META[section]
  if (!meta) return <Alert tone="warning">Pick a section above.</Alert>

  const [dimensions, answers] = await Promise.all([
    prisma.preferenceDimension.findMany({
      where: { category: section as 'TRAVEL_STYLE', active: true, kind: 'RATING' },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.userPreference.findMany({ where: { userId }, select: { dimensionId: true, rating: true } }),
  ])
  const byId = new Map(answers.map((a) => [a.dimensionId, a.rating]))

  return (
    <div>
      <h2 className="text-lg font-semibold">{meta.label}</h2>
      <p className="mb-4 mt-1 text-sm text-ink-600">{meta.blurb}</p>
      <PreferenceCards
        step=""
        nextHref={here}
        backHref={null}
        dimensions={dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          description: d.description,
          rating: byId.get(d.id) ?? null,
        }))}
      />
    </div>
  )
}
