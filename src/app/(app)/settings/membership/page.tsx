import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { stripeConfigured } from '@/lib/billing/stripe'
import { ManageBillingButton } from '@/components/billing/UpgradePanel'
import { Alert, Badge, Card, CardBody, LinkButton } from '@/components/ui'
import { formatMoney, formatMoneyCompact, membership } from '@/config/pricing'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Membership', robots: { index: false } }
export const dynamic = 'force-dynamic'

const STATUS_COPY: Record<string, { label: string; tone: 'moss' | 'gold' | 'berry' | 'neutral' }> = {
  ACTIVE: { label: 'Active', tone: 'moss' },
  TRIALING: { label: 'Trial', tone: 'moss' },
  PAST_DUE: { label: 'Payment failed', tone: 'berry' },
  CANCELED: { label: 'Cancelled', tone: 'neutral' },
  INCOMPLETE: { label: 'Not finished', tone: 'gold' },
  UNPAID: { label: 'Unpaid', tone: 'berry' },
  NONE: { label: 'Free account', tone: 'neutral' },
}

export default async function MembershipPage() {
  const user = await requireOnboardedUser()
  const [subscription, payments] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ])

  const status = subscription?.status ?? 'NONE'
  const copy = STATUS_COPY[status] ?? STATUS_COPY.NONE!
  const active = hasMembership(user)
  const isSeeded = active && !subscription?.stripeSubscriptionId

  return (
    <div className="space-y-8">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Voyaj membership</h2>
                <Badge variant={copy.tone}>{copy.label}</Badge>
              </div>
              {active ? (
                <p className="mt-2 text-ink-600">
                  {formatMoney(subscription?.priceCents ?? membership.priceCents, subscription?.currency)} a{' '}
                  {subscription?.interval ?? membership.interval}
                  {subscription?.currentPeriodEnd && (
                    <>
                      {subscription.cancelAtPeriodEnd ? ' · ends ' : ' · renews '}
                      {formatDate(subscription.currentPeriodEnd)}
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-ink-600 text-pretty">
                  You are on a free account. The quiz and your travel personality are yours to keep.
                </p>
              )}
            </div>
            {active ? (
              stripeConfigured() && subscription?.stripeCustomerId ? (
                <ManageBillingButton />
              ) : null
            ) : (
              <LinkButton href="/upgrade">Join for {formatMoneyCompact(membership.priceCents)}</LinkButton>
            )}
          </div>

          {isSeeded && (
            <Alert tone="warning" className="mt-5" title="Demonstration membership">
              This membership was created by the seed script for the investor demo. There is no
              Stripe subscription behind it and nothing has been charged.
            </Alert>
          )}

          {status === 'PAST_DUE' && (
            <Alert tone="error" className="mt-5" title="Your last payment did not go through">
              Update your payment method to keep your membership. Your access continues for now.
            </Alert>
          )}

          {subscription?.cancelAtPeriodEnd && (
            <Alert tone="info" className="mt-5">
              Your membership is set to end on {formatDate(subscription.currentPeriodEnd)}. You keep
              full access until then, and you can restart any time.
            </Alert>
          )}
        </CardBody>
      </Card>

      {payments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Payment history</h2>
          <Card className="mt-4">
            <CardBody className="p-0">
              <ul className="divide-y divide-ink-100">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium">{payment.description ?? 'Voyaj membership'}</p>
                      <p className="text-xs text-ink-500">{formatDate(payment.paidAt ?? payment.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">
                        {formatMoney(payment.amountCents, payment.currency)}
                      </p>
                      <p className={`text-xs ${payment.status === 'paid' ? 'text-moss-700' : 'text-berry-500'}`}>
                        {payment.status}
                      </p>
                    </div>
                    {payment.receiptUrl && (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-terracotta-600 underline underline-offset-4"
                      >
                        Receipt
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </section>
      )}

      <p className="text-sm text-ink-500 text-pretty">
        Cancelling is instant and takes effect at the end of the period you have paid for. See the{' '}
        <Link href="/legal/subscription" className="underline underline-offset-4">subscription terms</Link>{' '}
        and{' '}
        <Link href="/legal/cancellation" className="underline underline-offset-4">cancellation policy</Link>.
      </p>
    </div>
  )
}
