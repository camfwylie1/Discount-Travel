import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ResetForm } from '@/components/auth/AuthForms'
import { Skeleton } from '@/components/ui'

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } }

export default function ResetPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
      <ResetForm />
    </Suspense>
  )
}
