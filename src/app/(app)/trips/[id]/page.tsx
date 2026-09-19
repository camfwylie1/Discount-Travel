import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireMembership } from '@/lib/auth/guards'
import { getScoreableUser, getDimensionMap, getAirportCoordMap, toScoreableDeal, DEAL_INCLUDE } from '@/lib/recommendations/service'
import { scoreDealForGroup, type GroupMember } from '@/lib/recommendations/groupScore'
import { JoinTripButton, TripVoting } from '@/components/trips/TripActions'
import { Avatar } from '@/components/layout/AppNav'
import { Alert, Badge, Card, CardBody, LinkButton, SectionHeading } from '@/components/ui'
import { MatchScoreRing } from '@/components/deals/MatchScoreRing'
import { DealCard } from '@/components/deals/DealCard'
import { toCardData } from '@/lib/deals/feed'
import { formatDate, formatDateRange, plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Trip', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * THE TRIP PAGE
 *
 * This is where group recommendations earn their keep: it shows how the trip
 * scores for EVERY member, leads with the least happy one, and names the
 * specific disagreements rather than hiding them in an average.
 */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireMembership()

  const trip = await prisma.tripGroup.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, profile: { select: { firstName: true } } } },
      deal: { include: DEAL_INCLUDE },
      members: {
        include: {
          user: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      votes: true,
      conversation: { select: { id: true } },
      shares: {
        include: { deal: { include: DEAL_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      },
    },
  })
  if (!trip) notFound()

  const myMembership = trip.members.find((m) => m.userId === user.id)
  // A private trip is only visible to its members.
  if (trip.isPrivate && !myMembership) notFound()

  const active = trip.members.filter((m) => m.state !== 'LEFT' && m.state !== 'DECLINED')
  const confirmed = active.filter((m) => m.state === 'CONFIRMED')
  const interested = active.filter((m) => m.state === 'INTERESTED')

  // ── Group compatibility for the attached deal
  let groupResult: Awaited<ReturnType<typeof computeGroup>> = null
  if (trip.deal) groupResult = await computeGroup(trip.deal, active.map((m) => m.user))

  // ── Voting tallies
  const dateOptions = buildDateOptions(trip.targetStart)
  const airportOptions = await buildAirportOptions(active.map((m) => m.user.id))
  const tallyFor = (kind: string) => {
    const out: Record<string, number> = {}
    for (const vote of trip.votes.filter((v) => v.kind === kind)) {
      out[vote.optionKey] = (out[vote.optionKey] ?? 0) + vote.value
    }
    return out
  }
  const myVote = (kind: string) =>
    trip.votes.find((v) => v.kind === kind && v.userId === user.id)?.optionKey ?? null

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-display-md text-balance">{trip.name}</h1>
            <p className="mt-1.5 text-ink-600">
              Organised by {trip.owner.profile?.firstName ?? 'a traveller'}
              {(trip.targetStart || trip.targetEnd) && ` · ${formatDateRange(trip.targetStart, trip.targetEnd)}`}
            </p>
          </div>
          <Badge variant={trip.status === 'CONFIRMED' ? 'moss' : 'neutral'}>
            {trip.status.toLowerCase()}
          </Badge>
        </div>
        {trip.description && (
          <p className="mt-4 leading-relaxed text-ink-700 text-pretty">{trip.description}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <JoinTripButton tripId={trip.id} state={myMembership?.state ?? null} />
          {trip.conversation && (
            <LinkButton href={`/chats/${trip.conversation.id}`} variant="outline">
              Open the chat
            </LinkButton>
          )}
        </div>
      </header>

      {/* Members */}
      <section className="mt-9">
        <SectionHeading
          as="h2"
          title="Who is coming"
          description={`${plural(confirmed.length, 'person')} confirmed${interested.length > 0 ? `, ${interested.length} interested` : ''}`}
        />
        <ul className="mt-4 flex flex-wrap gap-3">
          {active.map((member) => (
            <li key={member.id}>
              <Link
                href={`/people/${member.userId}`}
                className="flex items-center gap-2.5 rounded-full border border-ink-200 bg-white py-1.5 pl-1.5 pr-4 transition-colors hover:border-ink-400"
              >
                <Avatar
                  url={member.user.profile?.photoThumbUrl}
                  name={member.user.profile?.firstName}
                  size={30}
                />
                <span className="text-sm font-medium">{member.user.profile?.firstName}</span>
                <span
                  className={`text-xs ${member.state === 'CONFIRMED' ? 'text-moss-700' : 'text-ink-400'}`}
                >
                  {member.state === 'CONFIRMED' ? 'in' : member.state.toLowerCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── GROUP COMPATIBILITY: the honest bit ──────────────────────── */}
      {trip.deal && groupResult && (
        <section className="mt-10">
          <SectionHeading
            as="h2"
            title="How this trip suits the group"
            description="We lead with whoever fits it least — averaging that away would not help anyone."
          />

          <Card className="mt-4">
            <CardBody>
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <MatchScoreRing score={groupResult.minimumScore} size={82} label="worst fit" />
                  <p className="mt-1.5 text-xs text-ink-500">Least happy member</p>
                </div>
                <div className="text-center">
                  <MatchScoreRing score={groupResult.averageScore} size={62} label="average" />
                  <p className="mt-1.5 text-xs text-ink-500">Group average</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-700 text-pretty">
                    {groupResult.everyoneCanGo
                      ? 'Everyone can go on this trip — nobody is blocked by budget, dates or departure airport.'
                      : 'Some members cannot take this trip within their own limits.'}
                  </p>
                </div>
              </div>

              {/* Per-member scores — nobody is invisible */}
              <ul className="mt-6 space-y-2">
                {groupResult.members
                  .slice()
                  .sort((a, b) => a.score - b.score)
                  .map((member) => (
                    <li key={member.userId} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-sm">{member.displayName}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={`h-full rounded-full ${member.score >= 70 ? 'bg-moss-500' : member.score >= 50 ? 'bg-gold-500' : 'bg-berry-500'}`}
                          style={{ width: `${member.score}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-ink-600">
                        {member.score}%
                      </span>
                      {!member.passed && (
                        <span className="shrink-0 text-xs text-berry-500">
                          {member.failures[0]?.label}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>

              {/* The disagreements, named */}
              {groupResult.disagreements.length > 0 && (
                <div className="mt-6 space-y-3 border-t border-ink-100 pt-5">
                  <h3 className="text-sm font-semibold">Where the group does not agree</h3>
                  {groupResult.disagreements.map((d) => (
                    <div
                      key={d.dimensionKey}
                      className={`rounded-xl p-3.5 ${d.severity === 'dealbreaker' ? 'bg-berry-100' : 'bg-gold-100'}`}
                    >
                      <p className="text-sm font-medium text-ink-900">
                        {d.label}
                        {d.severity === 'dealbreaker' && (
                          <Badge variant="berry" className="ml-2">Dealbreaker</Badge>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-ink-700 text-pretty">{d.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {groupResult.disagreements.length === 0 && (
                <p className="mt-5 border-t border-ink-100 pt-5 text-sm text-moss-700">
                  No real disagreements on this one — it suits everybody’s stated preferences.
                </p>
              )}
            </CardBody>
          </Card>
        </section>
      )}

      {/* The trip itself */}
      {trip.deal && (
        <section className="mt-10">
          <SectionHeading as="h2" title="The trip" />
          <div className="mt-4 max-w-sm">
            <DealCard deal={toCardData(trip.deal)} showMatch={false} placement="trip" />
          </div>
        </section>
      )}

      {/* Voting */}
      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">When should we go?</h2>
          <p className="mt-1 text-sm text-ink-600">Everyone gets one vote.</p>
          <div className="mt-3">
            <TripVoting
              tripId={trip.id}
              kind="DATE_WINDOW"
              options={dateOptions}
              myVote={myVote('DATE_WINDOW')}
              tally={tallyFor('DATE_WINDOW')}
            />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Which airport?</h2>
          <p className="mt-1 text-sm text-ink-600">Based on where the group flies from.</p>
          <div className="mt-3">
            <TripVoting
              tripId={trip.id}
              kind="AIRPORT"
              options={airportOptions}
              myVote={myVote('AIRPORT')}
              tally={tallyFor('AIRPORT')}
            />
          </div>
        </div>
      </section>

      {/* Alternatives shared into the trip */}
      {trip.shares.length > 0 && (
        <section className="mt-10">
          <SectionHeading as="h2" title="Other options people have shared" />
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trip.shares.slice(0, 3).map((share) => (
              <DealCard key={share.id} deal={toCardData(share.deal)} showMatch={false} placement="trip-share" />
            ))}
          </div>
        </section>
      )}

      <Alert tone="info" className="mt-10">
        Voyaj does not process the booking. When the group has agreed, each of you books directly
        with the provider.
      </Alert>
    </div>
  )
}

async function computeGroup(
  deal: Parameters<typeof toScoreableDeal>[0],
  users: { id: string; profile: { firstName: string | null } | null }[],
) {
  const [dimensions, airportCoords] = await Promise.all([getDimensionMap(), getAirportCoordMap()])
  const members: GroupMember[] = []
  for (const u of users) {
    const scoreable = await getScoreableUser(u.id)
    if (!scoreable) continue
    members.push({ user: scoreable, displayName: u.profile?.firstName ?? 'Traveller' })
  }
  if (members.length === 0) return null
  return scoreDealForGroup(members, toScoreableDeal(deal), { dimensions, airportCoords })
}

/** Three candidate date windows around the trip's target start. */
function buildDateOptions(targetStart: Date | null) {
  const base = targetStart ?? new Date(Date.now() + 90 * 86_400_000)
  return [0, 7, 21].map((offset) => {
    const date = new Date(base.getTime() + offset * 86_400_000)
    return { key: date.toISOString().slice(0, 10), label: `Week of ${formatDate(date)}` }
  })
}

/** The airports this group actually flies from. */
async function buildAirportOptions(userIds: string[]) {
  const rows = await prisma.userAirport.findMany({
    where: { userId: { in: userIds } },
    include: { airport: { select: { iata: true, city: true } } },
  })
  const counts = new Map<string, { city: string; count: number }>()
  for (const row of rows) {
    const entry = counts.get(row.airport.iata) ?? { city: row.airport.city, count: 0 }
    entry.count += 1
    counts.set(row.airport.iata, entry)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([iata, v]) => ({ key: iata, label: `${v.city} (${iata})` }))
}
