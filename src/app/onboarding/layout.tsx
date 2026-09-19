import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { requireUser } from '@/lib/auth/guards'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/login?next=/onboarding')
  return (
    <div className="flex min-h-dvh flex-col bg-sand-50">
      <header className="border-b border-ink-200 bg-white/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Voyaj home">
            <Logo size="sm" />
          </Link>
          <Link href="/discover" className="text-sm text-ink-500 underline underline-offset-4 hover:text-ink-800">
            Finish later
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1 pb-20">{children}</main>
    </div>
  )
}
