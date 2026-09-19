'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

/**
 * APP NAVIGATION
 *
 * Mobile: a five-item bottom bar, which is what a native app would do and
 * what makes the eventual iOS/Android port a straight port.
 * Desktop: the same destinations in a top bar.
 */

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  match: (path: string) => boolean
  badge?: number
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

export function AppNav({
  unreadMessages = 0,
  notifications = 0,
  photoThumbUrl,
  firstName,
  isAdmin = false,
  socialEnabled = true,
}: {
  unreadMessages?: number
  notifications?: number
  photoThumbUrl?: string | null
  firstName?: string | null
  isAdmin?: boolean
  socialEnabled?: boolean
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const items: NavItem[] = [
    {
      href: '/discover',
      label: 'Discover',
      icon: icon('M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3Z'),
      match: (p) => p === '/discover' || p.startsWith('/deals'),
    },
    {
      href: '/search',
      label: 'Search',
      icon: icon('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35'),
      match: (p) => p.startsWith('/search'),
    },
    ...(socialEnabled
      ? [
          {
            href: '/people',
            label: 'People',
            icon: icon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'),
            match: (p: string) => p.startsWith('/people') || p.startsWith('/circles'),
          },
          {
            href: '/chats',
            label: 'Chats',
            icon: icon('M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z'),
            match: (p: string) => p.startsWith('/chats') || p.startsWith('/trips'),
            badge: unreadMessages,
          },
        ]
      : []),
    {
      href: '/profile',
      label: 'Profile',
      icon: icon('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'),
      match: (p) => p.startsWith('/profile') || p.startsWith('/saved') || p.startsWith('/settings'),
    },
  ]

  return (
    <>
      {/* ── Desktop / tablet ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 hidden border-b border-ink-200 bg-sand-50/90 backdrop-blur-md md:block">
        <div className="container-page flex h-16 items-center gap-6">
          <Link href="/discover" className="inline-flex min-h-11 items-center" aria-label="Voyaj home">
            <Logo size="sm" />
          </Link>

          <nav className="flex flex-1 items-center gap-1" aria-label="Main">
            {items.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                  )}
                >
                  {item.label}
                  {!!item.badge && item.badge > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[0.65rem] font-semibold text-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-600 hover:bg-ink-100"
              aria-label={notifications > 0 ? `${notifications} unread notifications` : 'Notifications'}
            >
              {icon('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0')}
              {notifications > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terracotta-500 ring-2 ring-sand-50" />
              )}
            </Link>
            {isAdmin && (
              <Link href="/admin" className="rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100">
                Admin
              </Link>
            )}
            <Link href="/profile" aria-label="Your profile">
              <Avatar url={photoThumbUrl} name={firstName} size={36} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-sand-50/95 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link
            href="/discover"
            className="inline-flex min-h-11 min-w-11 items-center"
            aria-label="Voyaj home"
          >
            <Logo size="sm" showWordmark={false} />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-ink-600"
              aria-label={notifications > 0 ? `${notifications} unread notifications` : 'Notifications'}
            >
              {icon('M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0')}
              {notifications > 0 && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-terracotta-500 ring-2 ring-sand-50" />
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-600"
              aria-expanded={menuOpen}
              aria-label="More"
            >
              {icon('M4 7h16M4 12h16M4 17h16')}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-ink-200 bg-white px-4 py-2" aria-label="More">
            {[
              { href: '/saved', label: 'Saved trips' },
              ...(socialEnabled ? [{ href: '/circles', label: 'Circles' }, { href: '/trips', label: 'Trips' }] : []),
              { href: '/settings', label: 'Settings' },
              ...(isAdmin ? [{ href: '/admin', label: 'Admin portal' }] : []),
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2 py-3 text-ink-700 hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
            <form action="/api/auth/logout" method="post" className="mt-1 border-t border-ink-100 pt-1">
              <button
                type="submit"
                className="w-full rounded-lg px-2 py-3 text-left text-ink-600 hover:bg-ink-50"
              >
                Sign out
              </button>
            </form>
          </nav>
        )}
      </header>

      {/* ── Mobile bottom bar ────────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 pb-safe backdrop-blur-md md:hidden"
        aria-label="Main"
      >
        <div className="flex">
          {items.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium transition-colors',
                  active ? 'text-terracotta-600' : 'text-ink-500',
                )}
              >
                <span className="relative">
                  {item.icon}
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[0.6rem] font-semibold text-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export function Avatar({
  url,
  name,
  size = 40,
  className,
}: {
  url?: string | null
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name ?? '?').charAt(0).toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand-300 ring-1 ring-ink-200',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        // User-supplied avatars can be data URIs or uploaded files; next/image
        // adds no value here and cannot handle data URIs.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          className="font-medium text-ink-600"
          style={{ fontSize: size * 0.42, fontFamily: 'var(--font-display)' }}
          aria-hidden="true"
        >
          {initial}
        </span>
      )}
    </span>
  )
}
