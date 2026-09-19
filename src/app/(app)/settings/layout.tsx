import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth/guards'

const TABS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/travel', label: 'How you travel' },
  { href: '/settings/privacy', label: 'Privacy & safety' },
  { href: '/settings/membership', label: 'Membership' },
  { href: '/settings/account', label: 'Account' },
]

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOnboardedUser()
  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <h1 className="text-display-md">Settings</h1>
      <nav className="hide-scrollbar mt-5 flex gap-1 overflow-x-auto border-b border-ink-200 pb-px" aria-label="Settings">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="shrink-0 whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  )
}
