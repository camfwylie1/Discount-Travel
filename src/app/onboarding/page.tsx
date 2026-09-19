import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/guards'
import { prisma } from '@/lib/db'
import { STEP_KEYS } from '@/lib/onboarding/steps'

/** Sends the traveller to wherever they last got to. */
export default async function OnboardingIndex() {
  const user = await requireUser()
  if (user.onboardingComplete) redirect('/discover')

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardingStep: true },
  })
  const last = record?.onboardingStep
  if (!last) redirect('/onboarding/welcome')

  // Resume on the step AFTER the last completed one.
  const index = STEP_KEYS.indexOf(last)
  redirect(`/onboarding/${STEP_KEYS[index + 1] ?? last}`)
}
