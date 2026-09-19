import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/guards'
import { AppNav } from '@/components/layout/AppNav'
import { flagDefaults } from '@/config/flags'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  if (!user.onboardingComplete) redirect('/onboarding')

  const [unread, notifications] = await Promise.all([
    prisma.conversationMember.count({
      where: {
        userId: user.id,
        leftAt: null,
        conversation: {
          messages: { some: { senderId: { not: user.id }, deletedAt: null } },
        },
        OR: [
          { lastReadAt: null },
          { conversation: { messages: { some: { createdAt: { gt: new Date(0) } } } } },
        ],
      },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav
        unreadMessages={unread}
        notifications={notifications}
        photoThumbUrl={user.photoThumbUrl}
        firstName={user.firstName}
        isAdmin={user.role === 'ADMIN' || user.role === 'MODERATOR'}
        socialEnabled={flagDefaults.SOCIAL_ENABLED}
      />
      <main id="main" className="flex-1 pb-24 md:pb-12">
        {children}
      </main>
    </div>
  )
}
