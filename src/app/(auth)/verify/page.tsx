import { Suspense } from 'react'
import type { Metadata } from 'next'
import { VerifyPanel } from '@/components/auth/AuthForms'
import { Skeleton } from '@/components/ui'

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } }

export default function VerifyPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <VerifyPanel />
    </Suspense>
  )
}
