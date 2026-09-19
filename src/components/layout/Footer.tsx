import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { brand } from '@/config/brand'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#personality', label: 'Travel personality' },
      { href: '/#matching', label: 'Traveller matching' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms of service' },
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/cookies', label: 'Cookie policy' },
      { href: '/legal/community', label: 'Community guidelines' },
      { href: '/legal/subscription', label: 'Subscription terms' },
      { href: '/legal/affiliate', label: 'Affiliate disclosure' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-200 bg-white">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-600 text-pretty">{brand.tagline}</p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-ink-500 text-pretty">
              {brand.name} is a travel discovery service. We do not sell travel. Bookings,
              prices and terms are handled by the travel provider.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold text-ink-900">{column.title}</h2>
              <ul className="mt-3 space-y-0 md:space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex min-h-11 w-full items-center text-sm text-ink-600 hover:text-ink-900 md:inline-flex md:min-h-0 md:w-auto"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-ink-200 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.legalName}. Prices in CAD.
          </p>
          <p>Made for travellers leaving from Canada.</p>
        </div>
      </div>
    </footer>
  )
}
