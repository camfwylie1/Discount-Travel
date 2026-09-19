import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser } from '@/lib/auth/guards'
import { DeleteAccountForm, SignOutButton } from '@/components/settings/SettingsForms'
import { Card, CardBody, LinkButton } from '@/components/ui'
import { formatDate, timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Account', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const user = await requireOnboardedUser()
  const [record, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, createdAt: true, emailVerifiedAt: true, marketingOptIn: true },
    }),
    prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { lastActiveAt: 'desc' },
      select: { id: true, createdAt: true, lastActiveAt: true, userAgent: true },
      take: 10,
    }),
  ])
  if (!record) return null

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Account</h2>
        <Card className="mt-4">
          <CardBody>
            <dl className="space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">Email address</dt>
                <dd className="font-medium">{record.email}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">Email confirmed</dt>
                <dd className="font-medium">
                  {record.emailVerifiedAt ? (
                    formatDate(record.emailVerifiedAt)
                  ) : (
                    <Link href="/verify" className="text-terracotta-600 underline underline-offset-4">
                      Not yet — confirm now
                    </Link>
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-600">Member since</dt>
                <dd className="font-medium">{formatDate(record.createdAt)}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <LinkButton href="/forgot" variant="outline">Change password</LinkButton>
              <SignOutButton />
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Where you are signed in</h2>
        <Card className="mt-4">
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {sessions.map((session) => (
                <li key={session.id} className="px-5 py-3.5">
                  <p className="text-sm font-medium">{describeDevice(session.userAgent)}</p>
                  <p className="text-xs text-ink-500">
                    Last active {timeAgo(session.lastActiveAt)} · started {formatDate(session.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <p className="mt-2 text-xs text-ink-500">
          Changing your password signs out every device except the one you change it on.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Your data</h2>
        <Card className="mt-4">
          <CardBody>
            <p className="text-sm text-ink-600 text-pretty">
              Download everything Voyaj holds about you as a JSON file. It includes your profile,
              preferences, saved trips, membership and the messages you have sent. It deliberately
              excludes other people’s information.
            </p>
            <a
              href="/api/profile/export"
              className="mt-4 inline-flex h-11 items-center rounded-xl border border-ink-300 bg-white px-5 text-[0.95rem] font-medium hover:bg-ink-50"
              download
            >
              Download my data
            </a>
          </CardBody>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-berry-700">Delete your account</h2>
        <div className="mt-4">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  )
}

/** A rough, privacy-respecting description. We never store a full fingerprint. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  if (/iPhone/i.test(userAgent)) return 'iPhone'
  if (/iPad/i.test(userAgent)) return 'iPad'
  if (/Android/i.test(userAgent)) return 'Android device'
  if (/Macintosh/i.test(userAgent)) return 'Mac'
  if (/Windows/i.test(userAgent)) return 'Windows PC'
  if (/Linux/i.test(userAgent)) return 'Linux computer'
  return 'Web browser'
}
