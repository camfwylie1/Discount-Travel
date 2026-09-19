import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/AuthForms'
import { getCurrentUser } from '@/lib/auth/guards'
import { Skeleton } from '@/components/ui'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(user.onboardingComplete ? '/discover' : '/onboarding')
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <LoginForm />
    </Suspense>
  )
}
