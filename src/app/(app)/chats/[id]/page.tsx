import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireMembership } from '@/lib/auth/guards'
import { canAccessConversation, getBlockedUserIds } from '@/lib/social/visibility'
import { ChatThread, type ChatMessage } from '@/components/chat/ChatThread'
import { Avatar } from '@/components/layout/AppNav'
import { Badge } from '@/components/ui'

export const metadata: Metadata = { title: 'Chat', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireMembership()

  // Membership in the conversation is the whole authorisation check.
  if (!(await canAccessConversation(user.id, id))) notFound()

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      circle: { select: { name: true, id: true } },
      trip: { select: { name: true, id: true } },
      members: {
        where: { leftAt: null },
        include: { user: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: { sender: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
      },
    },
  })
  if (!conversation) notFound()

  const others = conversation.members.filter((m) => m.userId !== user.id)
  const blocked = await getBlockedUserIds(user.id)
  const blockedHere = conversation.kind === 'DIRECT' && others.some((o) => blocked.includes(o.userId))

  const title =
    conversation.kind === 'DIRECT'
      ? (others[0]?.user.profile?.firstName ?? 'Traveller')
      : (conversation.title ?? conversation.circle?.name ?? conversation.trip?.name ?? 'Group chat')

  const messages: ChatMessage[] = conversation.messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    attachment: m.attachment as ChatMessage['attachment'],
    sender: {
      id: m.sender.id,
      firstName: m.sender.profile?.firstName ?? 'Traveller',
      photoThumbUrl: m.sender.profile?.photoThumbUrl ?? null,
    },
  }))

  return (
    <div className="container-page max-w-2xl py-4 sm:py-6">
      <header className="flex items-center gap-3 border-b border-ink-200 pb-4">
        <Link href="/chats" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100" aria-label="Back to chats">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        {conversation.kind === 'DIRECT' && others[0] && (
          <Avatar url={others[0].user.profile?.photoThumbUrl} name={title} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          <p className="text-xs text-ink-500">
            {conversation.kind === 'DIRECT' ? (
              <Link href={`/people/${others[0]?.userId}`} className="underline underline-offset-2">
                View profile
              </Link>
            ) : (
              `${conversation.members.length} members`
            )}
          </p>
        </div>
        {conversation.kind === 'TRIP' && conversation.trip && (
          <Link href={`/trips/${conversation.trip.id}`}>
            <Badge variant="ocean">Trip</Badge>
          </Link>
        )}
        {conversation.kind === 'CIRCLE' && <Badge variant="moss">Circle</Badge>}
      </header>

      <ChatThread
        conversationId={id}
        initialMessages={messages}
        viewerId={user.id}
        canPost={!blockedHere}
        blockedNotice={
          blockedHere ? 'This conversation is closed because one of you has blocked the other.' : null
        }
      />
    </div>
  )
}
