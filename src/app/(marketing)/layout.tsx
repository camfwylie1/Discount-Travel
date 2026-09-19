import { MarketingHeader } from '@/components/layout/MarketingHeader'
import { Footer } from '@/components/layout/Footer'
import { getCurrentUser } from '@/lib/auth/guards'

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader signedIn={!!user} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
