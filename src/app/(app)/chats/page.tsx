import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireOnboardedUser, hasMembership } from '@/lib/auth/guards'
import { Avatar } from '@/components/layout/AppNav'
import { Badge, EmptyState, LinkButton } from '@/components/ui'
import { timeAgo, truncate } from '@/lib/utils'
import { getBlockedUserIds } from '@/lib/social/visibility'

export const metadata: Metadata = { title: 'Chats', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ChatsPage() {
  const user = await requireOnboardedUser()

  if (!hasMembership(user)) {
    return (
      <div className="container-page py-10">
        <EmptyState
          title="Messaging is part of membership"
          description="Join Voyaj to message the travellers you match with, and to run group trips."
          action={<LinkButton href="/upgrade">See membership</LinkButton>}
        />
      </div>
    )
  }

  const blocked = await getBlockedUserIds(user.id)

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user.id, leftAt: null },
    include: {
      conversation: {
        include: {
          circle: { select: { name: true, colour: true } },
          trip: { select: { name: true, id: true } },
          members: {
            where: { leftAt: null },
            include: { user: { select: { id: true, profile: { select: { firstName: true, photoThumbUrl: true } } } } },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, profile: { select: { firstName: true } } } } },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
    take: 60,
  })

  // Count unread per conversation from lastReadAt.
  const rows = await Promise.all(
    memberships.map(async (membership) => {
      const conversation = membership.conversation
      const others = conversation.members.filter((m) => m.userId !== user.id)

      // Hide a direct conversation with someone either party has blocked.
      if (conversation.kind === 'DIRECT' && others.some((o) => blocked.includes(o.userId))) {
        return null
      }

      const unread = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: user.id },
          deletedAt: null,
          ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {}),
        },
      })

      const title =
        conversation.kind === 'DIRECT'
          ? (others[0]?.user.profile?.firstName ?? 'Traveller')
          : (conversation.title ?? conversation.circle?.name ?? conversation.trip?.name ?? 'Group')

      return {
        id: conversation.id,
        kind: conversation.kind,
        title,
        avatarUrl: conversation.kind === 'DIRECT' ? (others[0]?.user.profile?.photoThumbUrl ?? null) : null,
        memberCount: conversation.members.length,
        lastMessage: conversation.messages[0],
        lastMessageAt: conversation.lastMessageAt,
        unread,
      }
    }),
  )

  const conversations = rows.filter((r): r is NonNullable<typeof r> => r !== null)

  if (conversations.length === 0) {
    return (
      <div className="container-page py-10">
        <h1 className="mb-6 text-display-md">Chats</h1>
        <EmptyState
          title="No conversations yet"
          description="Connect with a traveller or start a trip, and your conversations will appear here."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/people">Find travellers</LinkButton>
              <LinkButton href="/trips" variant="outline">Start a trip</LinkButton>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="container-page max-w-2xl py-6 sm:py-8">
      <h1 className="mb-6 text-display-md">Chats</h1>
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-card border border-ink-200 bg-white">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link
              href={`/chats/${conversation.id}`}
              className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-ink-50"
            >
              {conversation.kind === 'DIRECT' ? (
                <Avatar url={conversation.avatarUrl} name={conversation.title} size={44} />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ocean-100 text-ocean-700">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={conversation.unread > 0 ? 'font-semibold' : 'font-medium'}>
                    {conversation.title}
                  </p>
                  {conversation.lastMessageAt && (
                    <time className="shrink-0 text-xs text-ink-400">
                      {timeAgo(conversation.lastMessageAt)}
                    </time>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-500">
                  {conversation.lastMessage
                    ? `${conversation.lastMessage.sender.profile?.firstName ?? 'Someone'}: ${truncate(conversation.lastMessage.body, 60)}`
                    : 'No messages yet'}
                </p>
              </div>

              {conversation.unread > 0 && (
                <Badge variant="terracotta">{conversation.unread > 9 ? '9+' : conversation.unread}</Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
