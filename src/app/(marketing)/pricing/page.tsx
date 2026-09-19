import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { LinkButton, Card, CardBody, Alert } from '@/components/ui'
import { formatMoneyCompact, membership } from '@/config/pricing'
import { brand } from '@/config/brand'

export const metadata: Metadata = {
  title: 'Pricing',
  description: `${brand.name} membership is ${formatMoneyCompact(membership.priceCents)} a year. The travel quiz is free.`,
}
export const revalidate = 600

export default async function PricingPage() {
  const [dealCount, providerCount] = await Promise.all([
    prisma.deal.count({ where: { status: 'ACTIVE' } }),
    prisma.provider.count({ where: { active: true } }),
  ])

  return (
    <div className="container-page max-w-4xl py-16 sm:py-24">
      <div className="text-center">
        <h1 className="text-display-lg text-balance">One price. Everything included.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-600 text-pretty">
          Take the travel quiz and see your travel personality for nothing. Join when you want the
          whole marketplace.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody className="flex h-full flex-col p-7">
            <h2 className="text-xl font-semibold">Free</h2>
            <p className="mt-1 text-ink-600">Always, no card needed.</p>
            <p className="mt-6 text-4xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              $0
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {[
                'The full travel personality quiz',
                'Your Travel DNA profile, yours to keep',
                'A preview of trips matched to you',
                'Browse and search the marketplace',
              ].map((feature) => (
                <li key={feature} className="flex gap-3 text-[0.95rem] text-ink-700">
                  <Tick />
                  <span className="text-pretty">{feature}</span>
                </li>
              ))}
            </ul>
            <LinkButton href="/signup" variant="outline" fullWidth className="mt-7">
              Take the quiz
            </LinkButton>
          </CardBody>
        </Card>

        <Card className="border-terracotta-300 ring-1 ring-terracotta-300">
          <CardBody className="flex h-full flex-col p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Membership</h2>
              <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-semibold text-terracotta-700">
                Everything
              </span>
            </div>
            <p className="mt-1 text-ink-600">Billed once a year.</p>
            <p className="mt-6">
              <span className="text-4xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                {formatMoneyCompact(membership.priceCents)}
              </span>
              <span className="ml-1 text-ink-500">
                / {membership.interval} {membership.currency}
              </span>
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {[
                `All ${dealCount.toLocaleString('en-CA')} trips from ${providerCount} providers`,
                'The full reasoning behind every match score',
                'Save, share and track trips',
                'Traveller matching and connections',
                'Circles, group trips and messaging',
                'Open any provider’s page directly',
                'Cancel any time, no notice period',
              ].map((feature) => (
                <li key={feature} className="flex gap-3 text-[0.95rem] text-ink-700">
                  <Tick />
                  <span className="text-pretty">{feature}</span>
                </li>
              ))}
            </ul>
            <LinkButton href="/signup" fullWidth className="mt-7">
              Start with the free quiz
            </LinkButton>
          </CardBody>
        </Card>
      </div>

      <Alert tone="info" className="mt-10" title="We do not sell travel">
        {brand.name} is a discovery service. When you find a trip you want, we send you to the
        provider — you book with them, at their price, under their terms. Some providers pay us a
        commission when you do; that never affects your match score. See our{' '}
        <Link href="/legal/affiliate" className="font-medium underline underline-offset-4">
          affiliate disclosure
        </Link>
        .
      </Alert>

      <div className="mt-12 text-center">
        <p className="text-sm text-ink-600">
          Questions? Read the{' '}
          <Link href="/faq" className="font-medium text-terracotta-600 underline underline-offset-4">
            FAQ
          </Link>{' '}
          or the{' '}
          <Link href="/legal/subscription" className="font-medium text-terracotta-600 underline underline-offset-4">
            subscription terms
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-moss-500" fill="currentColor" aria-hidden="true">
      <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0Z" />
    </svg>
  )
}
