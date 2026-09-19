import Link from 'next/link'
import { requireModerator } from '@/lib/auth/guards'
import { Logo } from '@/components/brand/Logo'
import { Badge } from '@/components/ui'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/metrics', label: 'Metrics' },
  { href: '/admin/deals', label: 'Deals' },
  { href: '/admin/providers', label: 'Providers' },
  { href: '/admin/imports', label: 'Imports' },
  { href: '/admin/duplicates', label: 'Duplicates' },
  { href: '/admin/quality', label: 'Data quality' },
  { href: '/admin/users', label: 'Members' },
  { href: '/admin/reports', label: 'Moderation' },
  { href: '/admin/taxonomy', label: 'Taxonomy' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side authorisation. There is no client-side "isAdmin" check anywhere.
  const user = await requireModerator()

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/discover" aria-label="Back to the app">
              <Logo size="sm" />
            </Link>
            <Badge variant="dark">Admin</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-500 sm:inline">{user.email}</span>
            <Link href="/discover" className="text-ink-600 underline underline-offset-4 hover:text-ink-900">
              Back to Voyaj
            </Link>
          </div>
        </div>
        <nav className="hide-scrollbar border-t border-ink-100 bg-white" aria-label="Admin sections">
          <div className="container-page flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 whitespace-nowrap px-3 py-3 text-sm font-medium text-ink-600 hover:text-ink-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main id="main" className="container-page py-8">{children}</main>
    </div>
  )
}
