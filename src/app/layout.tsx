import type { Metadata, Viewport } from 'next'
import './globals.css'
import { brand } from '@/config/brand'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.subhead,
  applicationName: brand.name,
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.subhead,
    locale: 'en_CA',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14181F',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only-focusable fixed left-4 top-4 z-[100] inline-flex min-h-11 items-center rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}
