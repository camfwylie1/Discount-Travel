import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireUser, hasMembership } from '@/lib/auth/guards'
import { stripeConfigured } from '@/lib/billing/stripe'
import { CheckoutButton } from '@/components/billing/UpgradePanel'
import { Alert, Badge, Card, CardBody } from '@/components/ui'
import { formatMoneyCompact, membership } from '@/config/pricing'
import { brand } from '@/config/brand'
import { track } from '@/lib/analytics/events'
import { plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Membership', robots: { index: false } }
export const dynamic = 'force-dynamic'

const REASONS: Record<string, string> = {
  save: 'Saving trips is part of membership.',
  'view-deal': 'Opening a provider’s page is part of membership.',
  share: 'Sharing trips is part of membership.',
  connect: 'Connecting with travellers is part of membership.',
  message: 'Messaging is part of membership.',
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const user = await requireUser()
  if (hasMembership(user)) redirect('/settings/membership')

  const [personality, dealCount, matchCount] = await Promise.all([
    prisma.travelPersonality.findUnique({
      where: { userId: user.id },
      select: { title: true, topInterests: true },
    }),
    prisma.deal.count({ where: { status: 'ACTIVE' } }),
    prisma.matchScore.count({ where: { userId: user.id, score: { gte: 75 }, hardFiltered: false } }),
  ])

  void track('paywall_viewed', { userId: user.id, properties: { from: params.from } }).catch(() => {})

  return (
    <div className="container-page max-w-2xl py-8 sm:py-14">
      {params.cancelled === '1' && (
        <Alert tone="info" className="mb-6">
          No problem — nothing has been charged. You can join whenever you are ready.
        </Alert>
      )}
      {params.from && REASONS[params.from] && (
        <Alert tone="info" className="mb-6">
          {REASONS[params.from]}
        </Alert>
      )}

      <div className="text-center">
        {personality && <Badge variant="terracotta">{personality.title}</Badge>}
        <h1 className="mt-4 text-display-lg text-balance">
          {matchCount > 0
            ? `We found ${plural(matchCount, 'strong match')} for you`
            : 'Unlock the whole marketplace'}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-ink-600 text-pretty">
          Your travel personality is yours to keep, free. Membership opens up all{' '}
          {dealCount.toLocaleString('en-CA')} trips, the full reasoning behind every match, and the
          people side of {brand.name}.
        </p>
      </div>

      <Card className="mt-9">
        <CardBody className="p-7 sm:p-9">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              {formatMoneyCompact(membership.priceCents)}
            </span>
            <span className="text-ink-500">
              / {membership.interval} {membership.currency}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-600">
            That is about {formatMoneyCompact(Math.round(membership.priceCents / 12))} a month,
            billed once a year.
          </p>

          <ul className="mt-7 space-y-3">
            {[
              `All ${dealCount.toLocaleString('en-CA')} trips, ranked for you`,
              'The full explanation behind every match score',
              'Save, share and track trips',
              'Traveller matching and connections',
              'Circles, group trips and messaging',
              'Open any provider’s page directly',
              'Cancel any time — no notice period',
            ].map((feature) => (
              <li key={feature} className="flex gap-3 text-[0.95rem] text-ink-700">
                <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-moss-500" fill="currentColor" aria-hidden="true">
                  <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0Z" />
                </svg>
                <span className="text-pretty">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <CheckoutButton
              configured={stripeConfigured()}
              publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null}
              priceLabel={`${formatMoneyCompact(membership.priceCents)} a ${membership.interval}`}
            />
          </div>
        </CardBody>
      </Card>

      <p className="mt-6 text-center text-sm text-ink-500 text-pretty">
        {brand.name} does not sell travel. You book with the provider, on their site, at their
        price. Read the{' '}
        <Link href="/legal/subscription" className="underline underline-offset-4">
          subscription terms
        </Link>{' '}
        and{' '}
        <Link href="/legal/affiliate" className="underline underline-offset-4">
          how we make money
        </Link>
        .
      </p>
    </div>
  )
}
