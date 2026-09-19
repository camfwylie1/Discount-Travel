import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser, hasMembership } from '@/lib/auth/guards'
import { dealFilterSchema } from '@/lib/validation'
import { searchDeals, PAGE_SIZE } from '@/lib/deals/search'
import { DealCard, DealCardSkeleton, countryName } from '@/components/deals/DealCard'
import { SearchFilters } from '@/components/deals/SearchFilters'
import { Alert, Badge, EmptyState, LinkButton } from '@/components/ui'
import { paywall, flagDefaults } from '@/config/flags'
import { track } from '@/lib/analytics/events'
import { plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Search trips', robots: { index: false } }
export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams
  return (
    <div className="container-page py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-display-md">Search</h1>
        <p className="mt-1.5 text-ink-600 text-pretty">
          Filter however you like — results are still ranked by how well they suit you.
        </p>
      </header>
      <Suspense fallback={<SearchSkeleton />}>
        <Results raw={raw} />
      </Suspense>
    </div>
  )
}

async function Results({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const user = await getCurrentUser()
  const member = hasMembership(user)

  // Normalise repeated query params into arrays before validating.
  const normalised: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    const multi = ['airports', 'countries', 'continents', 'months', 'tripTypes', 'tags', 'providers']
    normalised[key] = multi.includes(key) ? (Array.isArray(value) ? value : [value]) : value
  }
  const parsed = dealFilterSchema.safeParse(normalised)
  const filters = parsed.success ? parsed.data : {}

  const [result, options] = await Promise.all([
    searchDeals(filters, user?.id ?? null),
    loadFilterOptions(),
  ])

  if (user) {
    void track('search_performed', {
      userId: user.id,
      properties: { q: filters.q ?? null, filters: result.appliedFilters, results: result.total },
    }).catch(() => {})
  }

  const limit = member ? Infinity : paywall.preview.searchResults
  const isDiscovery = raw.mode === 'discovery'

  return (
    <div className="space-y-6">
      <SearchFilters
        options={{ ...options, airports: result.facets.airports.length ? result.facets.airports : options.airports }}
        appliedCount={result.appliedFilters}
      />

      {result.understood.length > 0 && (
        <p className="text-sm text-ink-600">
          Searching for{' '}
          {result.understood.map((part, i) => (
            <span key={part}>
              {i > 0 && ', '}
              <strong className="font-medium text-ink-900">{part}</strong>
            </span>
          ))}
          .
        </p>
      )}

      {isDiscovery && result.total > 0 && (
        <Alert tone="info" title="Places that fit what you asked for">
          These are ranked by how well each one suits how you travel, not by price.
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600" aria-live="polite">
          {result.total === 0
            ? 'No trips found'
            : `${result.total.toLocaleString('en-CA')} ${result.total === 1 ? 'trip' : 'trips'}`}
          {result.pageCount > 1 && ` · page ${result.page} of ${result.pageCount}`}
        </p>
        {result.facets.priceRange && result.total > 0 && (
          <Badge variant="neutral">
            ${Math.round(result.facets.priceRange.min / 100).toLocaleString('en-CA')}–$
            {Math.round(result.facets.priceRange.max / 100).toLocaleString('en-CA')}
          </Badge>
        )}
      </div>

      {result.total === 0 ? (
        <EmptyState
          title={
            result.emptyReason === 'all-filtered'
              ? 'Those trips are outside your travel settings'
              : 'No trips match all of those filters'
          }
          description={
            result.relaxation ? (
              <>
                {result.relaxation.suggestion}{' '}
                <strong className="font-semibold text-ink-900">
                  That would reveal {plural(result.relaxation.unlocks, 'trip')}.
                </strong>
              </>
            ) : result.emptyReason === 'all-filtered' ? (
              'We found trips like this, but every one of them falls outside a hard limit you have set — your maximum budget, your departure airports or your travel dates.'
            ) : (
              'Nothing in the marketplace matches that combination right now. Try fewer words, a wider date range, or a higher price.'
            )
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/search">Clear all filters</LinkButton>
              <LinkButton href="/settings/travel" variant="outline">
                Adjust my travel settings
              </LinkButton>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.deals.map((item, i) => (
              <DealCard
                key={item.deal.id}
                deal={item.deal}
                matchScore={item.score}
                reasons={item.reasons}
                saved={item.saved}
                locked={i >= limit}
                placement="search"
                position={(result.page - 1) * PAGE_SIZE + i}
              />
            ))}
          </div>

          {!member && flagDefaults.PAYWALL_ENABLED && result.total > limit && (
            <Alert tone="info" title={`${result.total - limit} more trips are waiting`}>
              Join Voyaj to see every result, with the full reasoning behind each match.{' '}
              <Link href="/upgrade" className="font-medium underline underline-offset-4">
                See membership
              </Link>
            </Alert>
          )}

          {result.pageCount > 1 && (
            <Pagination page={result.page} pageCount={result.pageCount} raw={raw} />
          )}
        </>
      )}
    </div>
  )
}

function Pagination({
  page,
  pageCount,
  raw,
}: {
  page: number
  pageCount: number
  raw: Record<string, string | string[] | undefined>
}) {
  const link = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined || key === 'page') continue
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
      else params.set(key, value)
    }
    params.set('page', String(target))
    return `/search?${params.toString()}`
  }

  return (
    <nav className="flex items-center justify-center gap-2 pt-4" aria-label="Pagination">
      {page > 1 && (
        <LinkButton href={link(page - 1)} variant="outline" size="sm">
          Previous
        </LinkButton>
      )}
      <span className="px-3 text-sm text-ink-600">
        Page {page} of {pageCount}
      </span>
      {page < pageCount && (
        <LinkButton href={link(page + 1)} variant="outline" size="sm">
          Next
        </LinkButton>
      )}
    </nav>
  )
}

async function loadFilterOptions() {
  const [airports, countries, providers, tags] = await Promise.all([
    prisma.airport.findMany({
      where: { isActive: true, country: 'CA', isGateway: true },
      orderBy: { sortOrder: 'asc' },
      select: { iata: true, city: true },
    }),
    prisma.deal.groupBy({
      by: ['destinationCountry'],
      where: { status: 'ACTIVE' },
      _count: { destinationCountry: true },
      orderBy: { _count: { destinationCountry: 'desc' } },
      take: 24,
    }),
    prisma.provider.findMany({
      where: { active: true, deals: { some: { status: 'ACTIVE' } } },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.tag.findMany({ select: { slug: true, label: true }, orderBy: { label: 'asc' } }),
  ])

  return {
    airports: airports.map((a) => ({ ...a, count: 0 })),
    countries: countries
      .filter((c) => c.destinationCountry)
      .map((c) => ({
        code: c.destinationCountry!,
        name: countryName(c.destinationCountry) ?? c.destinationCountry!,
        count: c._count.destinationCountry,
      })),
    providers,
    tags,
    tripTypes: [
      { value: 'flight-hotel', label: 'Flight + hotel' },
      { value: 'tour', label: 'Tour' },
      { value: 'cruise', label: 'Cruise' },
      { value: 'all-inclusive', label: 'All-inclusive' },
      { value: 'resort', label: 'Resort' },
      { value: 'adventure-tour', label: 'Adventure' },
      { value: 'hiking-tour', label: 'Hiking' },
      { value: 'cycling-tour', label: 'Cycling' },
      { value: 'wellness', label: 'Wellness' },
      { value: 'ski', label: 'Ski' },
      { value: 'food-wine', label: 'Food & wine' },
      { value: 'cultural', label: 'Cultural' },
      { value: 'city-break', label: 'City break' },
      { value: 'road-trip', label: 'Road trip' },
      { value: 'expedition', label: 'Expedition' },
      { value: 'solo-friendly', label: 'Solo friendly' },
      { value: 'group-travel', label: 'Group travel' },
    ],
  }
}

function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-11 w-full rounded-xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
