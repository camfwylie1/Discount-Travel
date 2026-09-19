import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { Avatar } from '@/components/layout/AppNav'
import { Badge, Card, CardBody, EmptyState, LinkButton, SectionHeading } from '@/components/ui'
import { CreateTripForm } from '@/components/trips/TripActions'
import { formatDateRange, plural } from '@/lib/utils'
import { flagDefaults } from '@/config/flags'

export const metadata: Metadata = { title: 'Trips', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function TripsPage() {
  const user = await requireOnboardedUser()

  if (!flagDefaults.GROUP_TRIPS_ENABLED || !hasMembership(user)) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title="Group trips are part of membership"
          description="Build a trip around a deal, invite people, vote on dates and airports, and chat it through."
          action={<LinkButton href="/upgrade">See membership</LinkButton>}
        />
      </div>
    )
  }

  const [trips, connections] = await Promise.all([
    prisma.tripGroup.findMany({
      where: { members: { some: { userId: user.id, state: { notIn: ['LEFT', 'DECLINED'] } } } },
      include: {
        deal: { select: { id: true, normalizedTitle: true, destinationCountry: true, images: { take: 1 } } },
        members: {
          include: { user: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
        },
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.connection.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: { id: true, profile: { select: { firstName: true } } } },
        addressee: { select: { id: true, profile: { select: { firstName: true } } } },
      },
      take: 60,
    }),
  ])

  const people = connections
    .map((c) => (c.requesterId === user.id ? c.addressee : c.requester))
    .map((u) => ({ id: u.id, firstName: u.profile?.firstName ?? 'Traveller' }))

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <h1 className="text-display-md">Trips</h1>
      <p className="mt-1.5 text-ink-600 text-pretty">
        A place to plan a trip with other people. Voyaj does not handle the booking.
      </p>

      {trips.length > 0 && (
        <section className="mt-8">
          <SectionHeading as="h2" title="Your trips" />
          <ul className="mt-4 space-y-4">
            {trips.map((trip) => {
              const confirmed = trip.members.filter((m) => m.state === 'CONFIRMED')
              const interested = trip.members.filter((m) => m.state === 'INTERESTED')
              return (
                <li key={trip.id}>
                  <Card interactive>
                    <CardBody className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            <Link href={`/trips/${trip.id}`} className="after:absolute after:inset-0 after:content-['']">
                              {trip.name}
                            </Link>
                          </h3>
                          {trip.deal && (
                            <p className="mt-0.5 truncate text-sm text-ink-500">{trip.deal.normalizedTitle}</p>
                          )}
                          {(trip.targetStart || trip.targetEnd) && (
                            <p className="mt-1 text-sm text-ink-600">
                              {formatDateRange(trip.targetStart, trip.targetEnd)}
                            </p>
                          )}
                        </div>
                        <Badge variant={trip.status === 'CONFIRMED' ? 'moss' : 'neutral'}>
                          {trip.status.toLowerCase()}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {trip.members.slice(0, 6).map((member) => (
                            <Avatar
                              key={member.id}
                              url={member.user.profile?.photoThumbUrl}
                              name={member.user.profile?.firstName}
                              size={30}
                              className="ring-2 ring-white"
                            />
                          ))}
                        </div>
                        <p className="text-sm text-ink-600">
                          {plural(confirmed.length, 'confirmed')}
                          {interested.length > 0 && ` · ${interested.length} interested`}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <SectionHeading
          as="h2"
          title={trips.length > 0 ? 'Start another trip' : 'Start a trip'}
          description="Give it a name, invite a few people, and sort out the details together."
        />
        <Card className="mt-4">
          <CardBody>
            {people.length === 0 ? (
              <EmptyState
                title="Connect with someone first"
                description="Trips work best with other people. Find travellers you match with, then come back."
                action={<LinkButton href="/people">Find travellers</LinkButton>}
              />
            ) : (
              <CreateTripForm connections={people} />
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
