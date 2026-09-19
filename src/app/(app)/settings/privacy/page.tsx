import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser } from '@/lib/auth/guards'
import { PrivacyForm } from '@/components/settings/SettingsForms'
import { Alert, Card, CardBody } from '@/components/ui'
import { UnblockButton } from '@/components/settings/UnblockButton'

export const metadata: Metadata = { title: 'Privacy & safety', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function PrivacySettingsPage() {
  const user = await requireOnboardedUser()

  const [privacy, blocks] = await Promise.all([
    prisma.privacySetting.findUnique({ where: { userId: user.id } }),
    prisma.block.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: { id: true, profile: { select: { firstName: true } } } } },
    }),
  ])

  return (
    <div className="space-y-8">
      <Alert tone="info" title="What we never do">
        Voyaj never infers your gender, sexuality, ethnicity, religion, health or any other
        sensitive characteristic — not from your name, not from your photo, not from your
        behaviour. Traveller matching uses only what you have told us about how you travel.
      </Alert>

      <PrivacyForm initial={(privacy ?? {}) as unknown as Record<string, unknown>} />

      <section>
        <h2 className="text-lg font-semibold">Blocked members</h2>
        <Card className="mt-4">
          <CardBody>
            {blocks.length === 0 ? (
              <p className="text-sm text-ink-500">
                You have not blocked anyone. You can block someone from their profile at any time.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {blocks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="font-medium">
                      {block.blocked.profile?.firstName ?? 'Former member'}
                    </span>
                    <UnblockButton userId={block.blockedId} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      <p className="text-sm text-ink-500 text-pretty">
        Read our{' '}
        <Link href="/legal/privacy" className="underline underline-offset-4">privacy policy</Link>{' '}
        and{' '}
        <Link href="/legal/community" className="underline underline-offset-4">community guidelines</Link>.
      </p>
    </div>
  )
}
