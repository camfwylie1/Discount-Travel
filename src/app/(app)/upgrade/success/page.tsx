import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { LinkButton, Alert, Card, CardBody } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Welcome to Voyaj', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * The post-checkout page.
 *
 * Membership is granted by the WEBHOOK, not by arriving here — so this page
 * reports whatever state the webhook has already written, and says plainly
 * when it has not landed yet rather than pretending.
 */
export default async function CheckoutSuccessPage() {
  const user = await requireUser()
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } })
  const active = subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING'

  return (
    <div className="container-page max-w-lg py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-moss-100">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-moss-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mt-6 text-display-md">
        {active ? 'You are a member' : 'Payment received'}
      </h1>

      {active ? (
        <>
          <p className="mt-3 text-ink-600 text-pretty">
            Everything is unlocked. Your membership runs until{' '}
            {formatDate(subscription?.currentPeriodEnd)}.
          </p>
          <Card className="mt-6 text-left">
            <CardBody>
              <h2 className="text-sm font-semibold">What to do first</h2>
              <ol className="mt-2 space-y-1.5 text-sm text-ink-600">
                <li>1. Look through your full feed — every trip is now ranked for you.</li>
                <li>2. Find a few travellers you match with.</li>
                <li>3. Start a trip around something you have saved.</li>
              </ol>
            </CardBody>
          </Card>
          <LinkButton href="/discover" size="lg" className="mt-7">
            See my trips
          </LinkButton>
        </>
      ) : (
        <>
          <Alert tone="info" className="mt-5 text-left" title="Just finishing up">
            Stripe has taken the payment and we are waiting for their confirmation, which usually
            lands within a few seconds. Refresh this page in a moment. If it still has not appeared
            after a minute, nothing is lost — contact us and we will sort it out.
          </Alert>
          <LinkButton href="/upgrade/success" variant="outline" className="mt-6">
            Refresh
          </LinkButton>
        </>
      )}
    </div>
  )
}
