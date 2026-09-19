import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Editorial panel — hidden on mobile where the form is all that matters. */}
      <aside className="relative hidden lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1400&q=75')",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 to-ink-950/85" aria-hidden="true" />
        <Link href="/" className="relative inline-flex min-h-11 items-center text-white" aria-label="Voyaj home">
          <Logo />
        </Link>
        <div className="relative max-w-sm">
          <p className="text-2xl leading-snug text-white text-balance" style={{ fontFamily: 'var(--font-display)' }}>
            “A mountain in the morning, local food in the afternoon, and a bar full of new
            people at night.”
          </p>
          <p className="mt-4 text-sm text-white/65">
            The Social Adventurer — one of the travel personalities you might turn out to be.
          </p>
        </div>
      </aside>

      <main id="main" className="flex flex-1 flex-col">
        <div className="border-b border-ink-200 px-4 py-4 lg:hidden">
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Voyaj home">
            <Logo size="sm" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  )
}
