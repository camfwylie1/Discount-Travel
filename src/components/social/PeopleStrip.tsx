import Link from 'next/link'
import { prisma } from '@/lib/db'
import { Badge, Card, CardBody, LinkButton } from '@/components/ui'

/**
 * WHO IS AROUND
 *
 * The first thing a member sees when they open Voyaj, because this is a social
 * network that searches travel offers rather than a deal site with a friends
 * list. If the top of the page were a grid of prices, that ordering would be a
 * claim about what the product is, and it would be the wrong one.
 *
 * Everything here is a real count from the database. Where there is nothing
 * yet, it says so and offers the action that fixes it, rather than padding the
 * space with invented activity.
 */
export async function PeopleStrip({ userId }: { userId: string }) {
  const [pendingRequests, circles, upcomingTrips, conversations] = await Promise.all([
    prisma.connection.count({ where: { addresseeId: userId, status: 'PENDING' } }),
    prisma.circleMember.count({ where: { userId } }),
    prisma.tripMember.count({
      where: { userId, trip: { status: { in: ['PLANNING', 'CONFIRMED'] } } },
    }),
    prisma.conversationMember.count({ where: { userId, leftAt: null } }),
  ])

  const hasAnyone = circles > 0 || upcomingTrips > 0 || conversations > 0

  if (!hasAnyone && pendingRequests === 0) {
    return (
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Start with the people</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-600 text-pretty">
              Voyaj works best once you have a few travellers you would actually go away with.
              Choosing a trip is far easier when you know who you are choosing it for.
            </p>
          </div>
          <LinkButton href="/people">Find travellers like you</LinkButton>
        </CardBody>
      </Card>
    )
  }

  return (
    <section aria-labelledby="your-people">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="your-people" className="text-lg font-semibold">
          Your people
        </h2>
        <Link
          href="/people"
          className="text-sm font-medium text-terracotta-600 underline underline-offset-4"
        >
          Find more travellers
        </Link>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StripCard
          href="/people"
          label="Connection requests"
          value={pendingRequests}
          highlight={pendingRequests > 0}
        />
        <StripCard href="/circles" label="Circles" value={circles} />
        <StripCard href="/trips" label="Trips being planned" value={upcomingTrips} />
        <StripCard href="/chats" label="Conversations" value={conversations} />
      </div>
    </section>
  )
}

function StripCard({
  href,
  label,
  value,
  highlight = false,
}: {
  href: string
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between rounded-card border border-ink-200 bg-white px-4 py-3 transition-colors hover:border-ink-400"
    >
      <span className="text-sm text-ink-700">{label}</span>
      {highlight ? (
        <Badge variant="terracotta">{value}</Badge>
      ) : (
        <span className="text-lg font-semibold tabular-nums text-ink-900">{value}</span>
      )}
    </Link>
  )
}
