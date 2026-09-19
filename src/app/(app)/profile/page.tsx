import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { RadarChart } from '@/components/personality/RadarChart'
import { Avatar } from '@/components/layout/AppNav'
import { Alert, Badge, Card, CardBody, LinkButton, SectionHeading } from '@/components/ui'
import { formatMoneyCompact } from '@/config/pricing'

export const metadata: Metadata = { title: 'Your profile', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const user = await requireOnboardedUser()

  const [record, counts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        personality: true,
        constraints: true,
        subscription: true,
        airports: { include: { airport: true }, orderBy: { rank: 'asc' } },
        wishlist: { orderBy: { createdAt: 'desc' } },
        preferences: { where: { rating: { gte: 4 } }, include: { dimension: true }, take: 200 },
      },
    }),
    Promise.all([
      prisma.savedDeal.count({ where: { userId: user.id } }),
      prisma.connection.count({
        where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      }),
      prisma.tripMember.count({ where: { userId: user.id, state: { in: ['CONFIRMED', 'INTERESTED'] } } }),
      prisma.userPreference.count({ where: { userId: user.id } }),
    ]),
  ])
  if (!record) return null

  const [savedCount, connectionCount, tripCount, answeredCount] = counts
  const radar = (record.personality?.radar ?? {}) as Record<string, number>
  const topInterests = record.preferences
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.dimension.engineWeight - a.dimension.engineWeight)
    .slice(0, 12)

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar
          url={record.profile?.photoThumbUrl}
          name={record.profile?.firstName}
          size={88}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-md">{record.profile?.firstName ?? 'Your profile'}</h1>
          <p className="mt-1 text-ink-600">
            {[record.profile?.homeCity, record.profile?.ageRange].filter(Boolean).join(' · ') ||
              'Add your home city in settings'}
          </p>
          {record.personality && (
            <Badge variant="terracotta" className="mt-3">{record.personality.title}</Badge>
          )}
        </div>
        <LinkButton href="/settings/profile" variant="outline">
          Edit profile
        </LinkButton>
      </div>

      {!user.emailVerifiedAt && (
        <Alert tone="warning" className="mt-6" title="Confirm your email address">
          You can browse and save trips, but you will need a confirmed address before messaging
          other travellers.{' '}
          <Link href="/verify" className="font-medium underline underline-offset-4">
            Confirm now
          </Link>
        </Alert>
      )}

      {/* Stats */}
      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Saved trips', value: savedCount, href: '/saved' },
          { label: 'Connections', value: connectionCount, href: '/people' },
          { label: 'Trips', value: tripCount, href: '/trips' },
          { label: 'Preferences set', value: answeredCount, href: '/settings/travel' },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-card border border-ink-200 bg-white p-4 transition-colors hover:border-ink-400">
            <dt className="text-xs uppercase tracking-wider text-ink-500">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
              {stat.value}
            </dd>
          </Link>
        ))}
      </dl>

      {/* Travel personality */}
      {record.personality && (
        <section className="mt-10">
          <SectionHeading
            as="h2"
            title="Your travel personality"
            action={
              <Link href="/settings/travel" className="text-sm font-medium text-terracotta-600 underline underline-offset-4">
                Retake the quiz
              </Link>
            }
          />
          <Card className="mt-4">
            <CardBody className="grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
                  {record.personality.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink-700 text-pretty">
                  {record.personality.description}
                </p>
                {record.personality.destinationIdeas.length > 0 && (
                  <p className="mt-4 text-sm text-ink-600">
                    <span className="font-medium">You might like:</span>{' '}
                    {record.personality.destinationIdeas.join(' · ')}
                  </p>
                )}
                <p className="mt-4 text-xs text-ink-500 text-pretty">
                  This describes how you like to travel. It is not a psychological assessment.
                </p>
              </div>
              <div>
                <RadarChart values={radar} size={300} />
              </div>
            </CardBody>
          </Card>
        </section>
      )}

      {/* What matters */}
      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">What matters most to you</h2>
          {topInterests.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {topInterests.map((pref) => (
                <Badge key={pref.id} variant={pref.rating === 5 ? 'terracotta' : 'neutral'}>
                  {pref.dimension.label}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-500">Nothing marked as important yet.</p>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">Your travel wishlist</h2>
          {record.wishlist.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {record.wishlist.map((item) => (
                <Badge key={item.id} variant="ocean">{item.label}</Badge>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-500">
              <Link href="/settings/travel" className="underline underline-offset-4">
                Add places you want to go
              </Link>{' '}
              and we will factor them in.
            </p>
          )}
        </div>
      </section>

      {/* Practical settings */}
      <section className="mt-10">
        <SectionHeading
          as="h2"
          title="How you travel"
          action={
            <Link href="/settings/travel" className="text-sm font-medium text-terracotta-600 underline underline-offset-4">
              Change
            </Link>
          }
        />
        <Card className="mt-4">
          <CardBody>
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Departure airports</dt>
                <dd className="mt-1 text-ink-900">
                  {record.airports.length > 0
                    ? record.airports.map((a) => a.airport.iata).join(', ')
                    : 'Not set'}
                  {record.constraints?.airportsAreHard && (
                    <span className="ml-2 text-xs text-terracotta-600">hard limit</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Budget</dt>
                <dd className="mt-1 text-ink-900">
                  {record.constraints?.budgetPreferred
                    ? `${formatMoneyCompact(record.constraints.budgetPreferred)} typical`
                    : 'Not set'}
                  {record.constraints?.budgetMax && (
                    <span className="block text-sm text-ink-500">
                      {formatMoneyCompact(record.constraints.budgetMax)} maximum
                      {record.constraints.budgetMaxIsHard && ' (hard limit)'}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Trip length</dt>
                <dd className="mt-1 text-ink-900">
                  {record.constraints?.durationMin && record.constraints?.durationMax
                    ? `${record.constraints.durationMin}–${record.constraints.durationMax} nights`
                    : 'Not set'}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </section>

      {/* Membership */}
      <section className="mt-10">
        <SectionHeading as="h2" title="Membership" />
        <Card className="mt-4">
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                {hasMembership(user) ? 'Active member' : 'Free account'}
              </p>
              <p className="mt-0.5 text-sm text-ink-600">
                {hasMembership(user)
                  ? 'You have full access to the marketplace and the social features.'
                  : 'The quiz and your travel personality are free. Membership unlocks everything else.'}
              </p>
            </div>
            <LinkButton
              href={hasMembership(user) ? '/settings/membership' : '/upgrade'}
              variant={hasMembership(user) ? 'outline' : 'primary'}
            >
              {hasMembership(user) ? 'Manage membership' : 'See membership'}
            </LinkButton>
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
