import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireOnboardedUser } from '@/lib/auth/guards'
import { ProfileForm } from '@/components/settings/SettingsForms'
import { PhotoStep } from '@/components/onboarding/PhotoStep'
import { Card, CardBody } from '@/components/ui'

export const metadata: Metadata = { title: 'Profile settings', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ProfileSettingsPage() {
  const user = await requireOnboardedUser()
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
  if (!profile) return null

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Your photo</h2>
        <div className="mt-4">
          <PhotoStep
            initialUrl={profile.photoUrl}
            firstName={profile.firstName}
            nextHref="/settings/profile"
            backHref={null}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Your details</h2>
        <Card className="mt-4">
          <CardBody>
            <ProfileForm
              initial={{
                firstName: profile.firstName,
                lastInitial: profile.lastInitial,
                headline: profile.headline,
                bio: profile.bio,
                homeCity: profile.homeCity,
                homeRegion: profile.homeRegion,
                ageRange: profile.ageRange,
                travelPace: profile.travelPace,
              }}
            />
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
