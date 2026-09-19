import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { Avatar } from '@/components/layout/AppNav'
import { Badge, Card, CardBody, EmptyState, LinkButton, SectionHeading } from '@/components/ui'
import { CreateCircleForm } from '@/components/people/CircleForm'
import { plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Circles', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CirclesPage() {
  const user = await requireOnboardedUser()

  if (!hasMembership(user)) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title="Circles are part of membership"
          description="Group your travel people — a Hiking Crew, a Food & Wine list — and share the right trips with the right ones."
          action={<LinkButton href="/upgrade">See membership</LinkButton>}
        />
      </div>
    )
  }

  const [circles, connections] = await Promise.all([
    prisma.circle.findMany({
      where: { ownerId: user.id },
      include: {
        members: {
          include: { user: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
        },
        conversation: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.connection.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } },
        addressee: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } },
      },
    }),
  ])

  const people = connections
    .map((c) => (c.requesterId === user.id ? c.addressee : c.requester))
    .map((u) => ({
      id: u.id,
      firstName: u.profile?.firstName ?? 'Traveller',
      photoThumbUrl: u.profile?.photoThumbUrl ?? null,
    }))

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <h1 className="text-display-md">Circles</h1>
      <p className="mt-1.5 text-ink-600 text-pretty">
        Small private groups of people you travel with. Nobody is told which circles they are in.
      </p>

      {circles.length > 0 && (
        <section className="mt-8">
          <SectionHeading as="h2" title="Your circles" />
          <ul className="mt-4 space-y-4">
            {circles.map((circle) => (
              <li key={circle.id}>
                <Card>
                  <CardBody>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{circle.name}</h3>
                        {circle.description && (
                          <p className="mt-0.5 text-sm text-ink-600 text-pretty">{circle.description}</p>
                        )}
                      </div>
                      <Badge variant="neutral">{plural(circle.members.length, 'member')}</Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="flex -space-x-2">
                        {circle.members.slice(0, 8).map((member) => (
                          <Avatar
                            key={member.id}
                            url={member.user.profile?.photoThumbUrl}
                            name={member.user.profile?.firstName}
                            size={30}
                            className="ring-2 ring-white"
                          />
                        ))}
                      </div>
                      <p className="text-sm text-ink-500">
                        {circle.members.slice(0, 3).map((m) => m.user.profile?.firstName).join(', ')}
                        {circle.members.length > 3 && ` and ${circle.members.length - 3} more`}
                      </p>
                      {circle.conversation && (
                        <Link
                          href={`/chats/${circle.conversation.id}`}
                          className="ml-auto text-sm font-medium text-terracotta-600 underline underline-offset-4"
                        >
                          Open chat
                        </Link>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <SectionHeading as="h2" title={circles.length > 0 ? 'Make another' : 'Make your first circle'} />
        <Card className="mt-4">
          <CardBody>
            {people.length === 0 ? (
              <EmptyState
                title="Connect with someone first"
                description="Circles are made from people you are connected to."
                action={<LinkButton href="/people">Find travellers</LinkButton>}
              />
            ) : (
              <CreateCircleForm connections={people} />
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
