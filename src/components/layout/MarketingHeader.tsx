'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { LinkButton } from '@/components/ui'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#personality', label: 'Travel personality' },
  { href: '/#matching', label: 'Traveller matching' },
  { href: '/pricing', label: 'Pricing' },
]

export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-ink-200/60 bg-sand-50/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center shrink-0" aria-label="Voyaj home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-600 transition-colors hover:text-ink-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <LinkButton href="/discover" size="sm">
              Go to your feed
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                Take the quiz
              </LinkButton>
            </>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-ink-700 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          'overflow-hidden border-t border-ink-200/60 bg-sand-50 md:hidden',
          open ? 'max-h-96' : 'max-h-0 border-t-0',
        )}
        style={{ transition: 'max-height 0.25s var(--ease-out-soft)' }}
      >
        <nav className="container-page flex flex-col gap-1 py-3" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-3 text-ink-700 hover:bg-ink-100"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 pb-2">
            {signedIn ? (
              <LinkButton href="/discover" fullWidth>
                Go to your feed
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/signup" fullWidth>
                  Take the quiz
                </LinkButton>
                <LinkButton href="/login" variant="outline" fullWidth>
                  Sign in
                </LinkButton>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
