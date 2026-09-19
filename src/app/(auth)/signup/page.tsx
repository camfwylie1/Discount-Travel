import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupForm } from '@/components/auth/AuthForms'
import { getCurrentUser } from '@/lib/auth/guards'
import { membership } from '@/config/pricing'
import { Skeleton } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Take the free travel personality quiz and get trips that actually fit you.',
}

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user) redirect(user.onboardingComplete ? '/discover' : '/onboarding')
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SignupForm priceCents={membership.priceCents} />
    </Suspense>
  )
}
