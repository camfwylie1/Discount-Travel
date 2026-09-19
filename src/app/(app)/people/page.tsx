import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { findCompatibleTravelers } from '@/lib/recommendations/service'
import { canSee, getRelationship } from '@/lib/social/visibility'
import { TravelerCard, TravelerCardSkeleton, type TravelerCardData } from '@/components/people/TravelerCard'
import { RespondToRequest } from '@/components/people/PeopleActions'
import { Alert, EmptyState, LinkButton, SectionHeading } from '@/components/ui'
import { Avatar } from '@/components/layout/AppNav'
import { paywall, flagDefaults } from '@/config/flags'
import { track } from '@/lib/analytics/events'
import { plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'People', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const user = await requireOnboardedUser()
  if (!flagDefaults.SOCIAL_ENABLED) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title="Traveller matching is not switched on"
          description="An administrator can enable it from the admin portal."
        />
      </div>
    )
  }
  return (
    <div className="container-page py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="text-display-md">Travellers you might click with</h1>
        <p className="mt-1.5 text-ink-600 text-pretty">
          Matched on how you travel — pace, budget, interests and trip length. Never on anything
          else about you.
        </p>
      </header>
      <Suspense fallback={<PeopleSkeleton />}>
        <PeopleList userId={user.id} member={hasMembership(user)} />
      </Suspense>
    </div>
  )
}

async function PeopleList({ userId, member }: { userId: string; member: boolean }) {
  const [matches, incoming, connections] = await Promise.all([
    findCompatibleTravelers(userId, { limit: 24 }),
    prisma.connection.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastInitial: true, photoThumbUrl: true, headline: true } },
            personality: { select: { title: true } },
          },
        },
      },
      take: 20,
    }),
    prisma.connection.count({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    }),
  ])

  void track('people_viewed', { userId, properties: { results: matches.length } }).catch(() => {})

  const limit = member ? Infinity : paywall.preview.peopleMatches

  // Build each card from what THIS viewer may see.
  const cards: { data: TravelerCardData; score: number; shared: typeof matches[number]['match']['shared']; conflicts: typeof matches[number]['match']['conflicts']; status: string | null }[] = []
  for (const candidate of matches) {
    const relationship = await getRelationship(userId, candidate.user.id)
    if (relationship === 'blocked') continue
    const privacy = candidate.user.privacy
    cards.push({
      data: {
        id: candidate.user.id,
        firstName: candidate.user.profile?.firstName ?? 'Traveller',
        lastInitial: candidate.user.profile?.lastInitial ?? null,
        headline: candidate.user.profile?.headline ?? null,
        photoThumbUrl: candidate.user.profile?.photoThumbUrl ?? null,
        ageRange: candidate.user.profile?.ageRange ?? null,
        homeCity: candidate.user.profile?.homeCity ?? null,
        personalityTitle: candidate.user.personality?.title ?? null,
        topInterests: candidate.user.personality?.topInterests ?? [],
        wishlist: candidate.user.wishlist.map((w) => w.label).slice(0, 5),
        visible: {
          photo: canSee(privacy?.photoVisibility ?? 'CONNECTIONS', relationship),
          age: canSee(privacy?.ageVisibility ?? 'CONNECTIONS', relationship),
          city: canSee(privacy?.cityVisibility ?? 'CONNECTIONS', relationship),
          wishlist: canSee(privacy?.wishlistVisibility ?? 'CONNECTIONS', relationship),
        },
      },
      score: candidate.match.score,
      shared: candidate.match.shared,
      conflicts: candidate.match.conflicts,
      status: candidate.connectionStatus,
    })
  }

  return (
    <div className="space-y-10">
      {/* Connection requests */}
      {incoming.length > 0 && (
        <section aria-labelledby="requests">
          <SectionHeading as="h2" title={`${plural(incoming.length, 'connection request')}`} />
          <ul className="mt-4 divide-y divide-ink-100 rounded-card border border-ink-200 bg-white">
            {incoming.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-4 p-4">
                <Avatar
                  url={request.requester.profile?.photoThumbUrl}
                  name={request.requester.profile?.firstName}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/people/${request.requester.id}`} className="font-medium hover:underline">
                    {request.requester.profile?.firstName ?? 'A traveller'}
                  </Link>
                  {request.requester.personality?.title && (
                    <p className="text-xs text-terracotta-600">{request.requester.personality.title}</p>
                  )}
                  {request.message && (
                    <p className="mt-1 text-sm text-ink-600 text-pretty">“{request.message}”</p>
                  )}
                </div>
                <RespondToRequest
                  connectionId={request.id}
                  firstName={request.requester.profile?.firstName ?? 'They'}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Matches */}
      <section aria-labelledby="matches">
        <SectionHeading
          as="h2"
          title="Your best travel matches"
          description="Compatibility is calculated from travel characteristics only."
          action={
            connections > 0 ? (
              <Link href="/circles" className="text-sm font-medium text-terracotta-600 underline underline-offset-4">
                {plural(connections, 'connection')}
              </Link>
            ) : undefined
          }
        />

        {cards.length === 0 ? (
          <EmptyState
            className="mt-5"
            title="No travellers to show yet"
            description="As more people join, we will match you with the ones who travel like you. In the meantime, your trip recommendations work perfectly without anyone else."
            action={<LinkButton href="/discover">Back to your trips</LinkButton>}
          />
        ) : (
          <>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cards.slice(0, member ? cards.length : limit).map((card) => (
                <TravelerCard
                  key={card.data.id}
                  traveler={card.data}
                  score={card.score}
                  shared={card.shared}
                  conflicts={card.conflicts}
                  connectionStatus={card.status}
                />
              ))}
            </div>

            {!member && cards.length > limit && (
              <Alert tone="info" className="mt-6" title={`${cards.length - limit} more matches`}>
                Traveller matching, connections and messaging are part of Voyaj membership.{' '}
                <Link href="/upgrade" className="font-medium underline underline-offset-4">
                  See membership
                </Link>
              </Alert>
            )}
          </>
        )}
      </section>

      <Alert tone="info" title="How we match people">
        We only ever use what you have told us about how you travel. We never infer anything about
        who you are, and any community space is something you opt into yourself in{' '}
        <Link href="/settings/privacy" className="font-medium underline underline-offset-4">
          your privacy settings
        </Link>
        .
      </Alert>
    </div>
  )
}

function PeopleSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <TravelerCardSkeleton key={i} />
      ))}
    </div>
  )
}
