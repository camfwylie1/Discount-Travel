import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { compareTravelers } from '@/lib/recommendations/service'
import { explainTravelerMatch } from '@/lib/recommendations/explain'
import { canSee, getRelationship } from '@/lib/social/visibility'
import { RadarChart } from '@/components/personality/RadarChart'
import { MatchScoreRing } from '@/components/deals/MatchScoreRing'
import { Avatar } from '@/components/layout/AppNav'
import { ConnectButton, MessageButton, SafetyActions } from '@/components/people/PeopleActions'
import { Alert, Badge, Card, CardBody, Divider } from '@/components/ui'
import { track } from '@/lib/analytics/events'

export const metadata: Metadata = { title: 'Traveller', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * A traveller's profile.
 *
 * Every field is gated on what this viewer may see. A private profile is not
 * hidden with CSS — the data is never loaded into the page at all.
 */
export default async function TravelerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await requireOnboardedUser()

  if (id === viewer.id) {
    // Your own profile lives somewhere nicer.
    const { redirect } = await import('next/navigation')
    redirect('/profile')
  }

  const relationship = await getRelationship(viewer.id, id)
  if (relationship === 'blocked') notFound()

  const target = await prisma.user.findFirst({
    where: { id, status: 'ACTIVE', ageConfirmed18: true },
    include: {
      profile: true,
      privacy: true,
      personality: true,
      wishlist: { include: { destination: { select: { name: true } } }, take: 12 },
      airports: { include: { airport: { select: { iata: true, city: true } } } },
      constraints: true,
    },
  })
  if (!target) notFound()

  const privacy = target.privacy
  const profileVisible = canSee(privacy?.profileVisibility ?? 'CONNECTIONS', relationship)

  if (!profileVisible && !privacy?.discoverable) notFound()

  const visible = {
    photo: canSee(privacy?.photoVisibility ?? 'CONNECTIONS', relationship),
    age: canSee(privacy?.ageVisibility ?? 'CONNECTIONS', relationship),
    city: canSee(privacy?.cityVisibility ?? 'CONNECTIONS', relationship),
    wishlist: canSee(privacy?.wishlistVisibility ?? 'CONNECTIONS', relationship),
    trips: canSee(privacy?.upcomingTripVisibility ?? 'PRIVATE', relationship),
  }

  const compatibility = await compareTravelers(viewer.id, id)
  const explanation = compatibility ? explainTravelerMatch(compatibility) : null
  const firstName = target.profile?.firstName ?? 'This traveller'
  const canMessageThem = hasMembership(viewer) && relationship === 'connected'

  void track('profile_viewed', { userId: viewer.id, properties: { targetId: id } }).catch(() => {})

  return (
    <div className="container-page max-w-4xl py-6 sm:py-10">
      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <Avatar
          url={visible.photo ? target.profile?.photoThumbUrl : null}
          name={firstName}
          size={96}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-md">
            {firstName}
            {target.profile?.lastInitial ? ` ${target.profile.lastInitial}.` : ''}
          </h1>
          <p className="mt-1 text-ink-600">
            {[visible.age ? target.profile?.ageRange : null, visible.city ? target.profile?.homeCity : null]
              .filter(Boolean)
              .join(' · ') || 'Traveller'}
          </p>
          {target.personality?.title && (
            <Badge variant="terracotta" className="mt-3">{target.personality.title}</Badge>
          )}
          {target.profile?.headline && (
            <p className="mt-3 text-lg text-ink-700 text-pretty">{target.profile.headline}</p>
          )}
        </div>

        {compatibility && (
          <div className="shrink-0 text-center">
            <MatchScoreRing score={compatibility.score} size={92} label="travel match" />
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ConnectButton
          userId={id}
          status={relationship === 'connected' ? 'ACCEPTED' : relationship === 'pending' ? 'PENDING' : null}
          firstName={firstName}
          fullWidth={false}
        />
        {canMessageThem && <MessageButton userId={id} firstName={firstName} />}
      </div>

      {/* Compatibility breakdown */}
      {compatibility && explanation && (
        <Card className="mt-8">
          <CardBody>
            <h2 className="text-lg font-semibold">{explanation.headline}</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-moss-700">
                  You both love
                </h3>
                {explanation.bothLove.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {explanation.bothLove.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-moss-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-ink-400">Nothing strongly shared yet.</p>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ocean-700">
                  Similar
                </h3>
                {explanation.similar.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {explanation.similar.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ocean-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-ink-400">Not enough in common yet.</p>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gold-700">
                  Where you differ
                </h3>
                {explanation.differences.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {explanation.differences.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-ink-400">Nothing obvious.</p>
                )}
              </div>
            </div>
            <p className="mt-5 text-xs text-ink-500 text-pretty">
              Worked out from travel characteristics only — pace, budget, interests, trip length
              and when you can travel. Never from anything about who either of you is.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Travel DNA, side by side */}
      {target.personality?.radar && compatibility && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Travel DNA, compared</h2>
          <div className="mt-4 rounded-card border border-ink-200 bg-white p-6">
            <RadarChart
              values={(target.personality.radar ?? {}) as Record<string, number>}
              compareValues={await viewerRadar(viewer.id)}
              primaryLabel={firstName}
              compareLabel="You"
              size={340}
            />
          </div>
        </section>
      )}

      {profileVisible && target.profile?.bio && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">About {firstName}</h2>
          <p className="mt-2 leading-relaxed text-ink-700 text-pretty">{target.profile.bio}</p>
        </section>
      )}

      {visible.wishlist && target.wishlist.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Wants to visit</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {target.wishlist.map((item) => (
              <Badge key={item.id} variant="ocean">{item.label}</Badge>
            ))}
          </div>
        </section>
      )}

      {relationship !== 'connected' && (
        <Alert tone="info" className="mt-8">
          Some of {firstName}’s profile is only visible to their connections.
        </Alert>
      )}

      <Divider className="my-10" />

      <SafetyActions userId={id} firstName={firstName} />
    </div>
  )
}

async function viewerRadar(userId: string): Promise<Record<string, number>> {
  const personality = await prisma.travelPersonality.findUnique({
    where: { userId },
    select: { radar: true },
  })
  return (personality?.radar ?? {}) as Record<string, number>
}
