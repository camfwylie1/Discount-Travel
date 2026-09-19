import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireOnboardedUser } from '@/lib/auth/guards'
import { DealCard } from '@/components/deals/DealCard'
import { toCardData } from '@/lib/deals/feed'
import { DEAL_INCLUDE } from '@/lib/recommendations/service'
import { Alert, Badge, EmptyState, LinkButton, SectionHeading } from '@/components/ui'
import { SavedStateControl } from '@/components/deals/SavedStateControl'

export const metadata: Metadata = { title: 'Saved trips', robots: { index: false } }
export const dynamic = 'force-dynamic'

const GROUPS = [
  { state: 'PLANNING', title: 'Planning', blurb: 'Trips you are actively working on.' },
  { state: 'INTERESTED', title: 'Interested', blurb: 'Worth another look.' },
  { state: 'SAVED', title: 'Saved', blurb: 'Kept for later.' },
  { state: 'BOOKED', title: 'Booked', blurb: 'You told us you booked these.' },
  { state: 'PAST', title: 'Past trips', blurb: 'Where you have already been.' },
] as const

export default async function SavedPage() {
  const user = await requireOnboardedUser()

  const saved = await prisma.savedDeal.findMany({
    where: { userId: user.id, state: { not: 'NOT_INTERESTED' } },
    include: { deal: { include: DEAL_INCLUDE } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })

  if (saved.length === 0) {
    return (
      <div className="container-page py-10">
        <h1 className="mb-6 text-display-md">Saved trips</h1>
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any trip and it will appear here, ready to share or turn into a group trip."
          action={<LinkButton href="/discover">Find something</LinkButton>}
        />
      </div>
    )
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <header className="mb-8">
        <h1 className="text-display-md">Saved trips</h1>
        <p className="mt-1.5 text-ink-600">{saved.length} saved</p>
      </header>

      <div className="space-y-12">
        {GROUPS.map((group) => {
          const items = saved.filter((s) => s.state === group.state)
          if (items.length === 0) return null
          return (
            <section key={group.state}>
              <SectionHeading
                as="h2"
                title={group.title}
                description={group.blurb}
                action={<Badge variant="neutral">{items.length}</Badge>}
              />
              {group.state === 'BOOKED' && (
                <Alert tone="info" className="mt-3">
                  You marked these as booked yourself. Voyaj does not process bookings, so we have
                  no record of them beyond what you told us.
                </Alert>
              )}
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <DealCard deal={toCardData(item.deal)} saved showMatch={false} placement="saved" />
                    <SavedStateControl dealId={item.dealId} state={item.state} />
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
