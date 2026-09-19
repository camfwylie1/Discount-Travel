import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { buildFeed } from '@/lib/deals/feed'
import { getCircleSavedDeals } from '@/lib/deals/socialProof'
import { toCardData } from '@/lib/deals/feed'
import { DealCard, DealCardSkeleton } from '@/components/deals/DealCard'
import { Alert, Badge, EmptyState, LinkButton, SectionHeading } from '@/components/ui'
import { DEAL_INCLUDE } from '@/lib/recommendations/service'
import { paywall, flagDefaults } from '@/config/flags'
import { trackImpressions } from '@/lib/analytics/events'
import { plural } from '@/lib/utils'
import { DiscoveryMode } from '@/components/deals/DiscoveryMode'

export const metadata: Metadata = { title: 'Discover', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const user = await requireOnboardedUser()
  return (
    <div className="container-page py-6 sm:py-8">
      <Suspense fallback={<FeedSkeleton />}>
        <Feed userId={user.id} firstName={user.firstName ?? 'there'} member={hasMembership(user)} />
      </Suspense>
    </div>
  )
}

async function Feed({
  userId,
  firstName,
  member,
}: {
  userId: string
  firstName: string
  member: boolean
}) {
  const [feed, personality, circleSaved] = await Promise.all([
    buildFeed(userId),
    prisma.travelPersonality.findUnique({
      where: { userId },
      select: { title: true, topInterests: true },
    }),
    flagDefaults.SOCIAL_ENABLED ? getCircleSavedDeals(userId) : Promise.resolve([]),
  ])

  const limit = member ? Infinity : paywall.preview.feedDeals

  // Record impressions for the recommendation feedback loop.
  void trackImpressions(
    userId,
    feed.topMatches.map((d, i) => ({ dealId: d.deal.id, position: i, score: d.score })),
    'discover',
  ).catch(() => {})

  if (feed.totalPassing === 0) {
    return (
      <EmptyState
        title="No trips match all of your settings yet"
        description={
          feed.relaxation ? (
            <>
              {feed.relaxation.suggestion}{' '}
              <strong className="font-semibold text-ink-900">
                That would reveal {plural(feed.relaxation.unlocks, 'more trip')}.
              </strong>
            </>
          ) : (
            'Try widening your budget, dates or departure airports.'
          )
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <LinkButton href="/settings/travel">Adjust my travel settings</LinkButton>
            <LinkButton href="/search" variant="outline">
              Browse everything
            </LinkButton>
          </div>
        }
      />
    )
  }

  // Circle-saved section needs its own query, so it is assembled here.
  const circleDeals = circleSaved.length
    ? await prisma.deal.findMany({
        where: { id: { in: circleSaved.map((c) => c.dealId) }, status: 'ACTIVE' },
        include: DEAL_INCLUDE,
      })
    : []

  /**
   * A non-member sees the first `limit` cards on the page and the rest come up
   * locked, counted in the order they are painted. The offsets are worked out
   * here rather than with a counter that a render callback mutates, so the
   * result does not depend on the order React happens to evaluate the tree in.
   */
  const topSlice = feed.topMatches.slice(0, 6)
  const circleSlice = circleDeals.length >= 2 ? circleDeals.slice(0, 3) : []
  const sectionSlices = feed.sections.map((section) => section.deals.slice(0, 3))

  const circleOffset = topSlice.length
  const sectionOffsets: number[] = []
  let cursor = circleOffset + circleSlice.length
  for (const slice of sectionSlices) {
    sectionOffsets.push(cursor)
    cursor += slice.length
  }

  const isLocked = (index: number) => index >= limit

  return (
    <div className="space-y-12">
      {/* Greeting */}
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-md">Hello, {firstName}</h1>
          {personality && <Badge variant="terracotta">{personality.title}</Badge>}
        </div>
        <p className="mt-2 text-ink-600 text-pretty">
          {feed.totalPassing} of {feed.totalCandidates} trips fit your budget, dates and departure
          airports{feed.homeAirports.length > 0 && ` (${feed.homeAirports.join(', ')})`}.
        </p>
      </header>

      <DiscoveryMode />

      {!member && flagDefaults.PAYWALL_ENABLED && (
        <Alert tone="info" title="You are seeing a preview">
          The first {paywall.preview.feedDeals} trips are ranked for you in full. Join to unlock
          the whole marketplace, match explanations, saving and messaging.{' '}
          <Link href="/upgrade" className="font-medium underline underline-offset-4">
            See membership
          </Link>
        </Alert>
      )}

      {/* Top matches */}
      <section aria-labelledby="top-matches">
        <SectionHeading
          as="h2"
          title="Top matches for you"
          description="Ranked by how well each trip fits how you travel — not by price."
          action={
            <Link href="/search?sort=match" className="text-sm font-medium text-terracotta-600 underline underline-offset-4">
              See all
            </Link>
          }
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {topSlice.map((item, i) => (
            <DealCard
              key={item.deal.id}
              deal={item.deal}
              matchScore={item.score}
              reasons={item.reasons}
              saved={item.saved}
              locked={isLocked(i)}
              placement="discover-top"
              position={i}
            />
          ))}
        </div>
      </section>

      {/* Circle activity — real counts only */}
      {circleSlice.length > 0 && (
        <section aria-labelledby="circle-saved">
          <SectionHeading
            as="h2"
            title="Trips your circles saved"
            description="What the people you travel with are looking at."
          />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {circleSlice.map((deal, i) => (
              <DealCard
                key={deal.id}
                deal={toCardData(deal)}
                showMatch={false}
                locked={isLocked(circleOffset + i)}
                placement="discover-circles"
              />
            ))}
          </div>
        </section>
      )}

      {/* Generated sections */}
      {feed.sections.map((section, sectionIndex) => (
        <section key={section.key} aria-labelledby={`section-${section.key}`}>
          <SectionHeading
            as="h2"
            title={section.title}
            description={section.description}
            action={
              section.href && (
                <Link href={section.href} className="text-sm font-medium text-terracotta-600 underline underline-offset-4">
                  See all
                </Link>
              )
            }
          />
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sectionSlices[sectionIndex].map((item, i) => (
              <DealCard
                key={item.deal.id}
                deal={item.deal}
                matchScore={item.score}
                reasons={item.reasons}
                saved={item.saved}
                locked={isLocked(sectionOffsets[sectionIndex] + i)}
                placement={`discover-${section.key}`}
                position={i}
              />
            ))}
          </div>
        </section>
      ))}

      {feed.relaxation && feed.relaxation.unlocks >= 3 && (
        <Alert tone="info">
          {feed.relaxation.suggestion}{' '}
          <strong className="font-semibold">
            That would add {plural(feed.relaxation.unlocks, 'trip')} to your feed.
          </strong>{' '}
          <Link href="/settings/travel" className="underline underline-offset-4">
            Adjust your settings
          </Link>
        </Alert>
      )}
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <div className="skeleton h-9 w-60 rounded" />
        <div className="skeleton h-4 w-96 max-w-full rounded" />
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="space-y-5">
          <div className="skeleton h-7 w-48 rounded" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <DealCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
