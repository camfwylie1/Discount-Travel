'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button } from '@/components/ui'
import { Avatar } from '@/components/layout/AppNav'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  body: string
  createdAt: string
  attachment?: { kind: string; dealId?: string } | null
  sender: { id: string; firstName: string; photoThumbUrl: string | null }
}

/**
 * CHAT
 *
 * Messages are polled while the thread is open. That is genuinely adequate
 * for the MVP and costs nothing to run; the documented upgrade is to swap the
 * poll for Server-Sent Events behind the same client contract.
 */
const POLL_MS = 5000

export function ChatThread({
  conversationId,
  initialMessages,
  viewerId,
  canPost = true,
  blockedNotice,
}: {
  conversationId: string
  initialMessages: ChatMessage[]
  viewerId: string
  canPost?: boolean
  blockedNotice?: string | null
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Poll for anything new. Uses the newest timestamp we hold, so we never
  // re-fetch the whole thread.
  useEffect(() => {
    if (!canPost) return
    let cancelled = false
    const tick = async () => {
      const latest = messages[messages.length - 1]?.createdAt
      try {
        const response = await fetch(
          `/api/messages/poll?conversationId=${conversationId}${latest ? `&after=${encodeURIComponent(latest)}` : ''}`,
        )
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (data.messages?.length > 0 && !cancelled) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id))
            return [...prev, ...data.messages.filter((m: ChatMessage) => !seen.has(m.id))]
          })
        }
      } catch {
        // A dropped poll is not worth surfacing; the next one will catch up.
      }
    }
    const interval = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [conversationId, messages, canPost])

  // Keep the newest message in view, but do not fight a user who has scrolled up.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 200
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  // Mark as read on open.
  useEffect(() => {
    void fetch('/api/messages/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {})
  }, [conversationId])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, body }),
    })
    const data = await response.json().catch(() => ({}))
    setSending(false)

    if (!response.ok) {
      setError(data.error ?? 'That message could not be sent.')
      return
    }
    setDraft('')
    setMessages((prev) => [...prev, data as ChatMessage])
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] flex-col md:h-[calc(100dvh-12rem)]">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-1 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-400">
            No messages yet. Say something.
          </p>
        )}
        {messages.map((message, index) => {
          const mine = message.sender.id === viewerId
          const previous = messages[index - 1]
          const grouped = previous?.sender.id === message.sender.id
          return (
            <div key={message.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
              <div className="w-8 shrink-0">
                {!grouped && !mine && (
                  <Avatar url={message.sender.photoThumbUrl} name={message.sender.firstName} size={32} />
                )}
              </div>
              <div className={cn('max-w-[78%] min-w-0', mine && 'items-end')}>
                {!grouped && !mine && (
                  <p className="mb-1 text-xs font-medium text-ink-500">{message.sender.firstName}</p>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed',
                    mine ? 'bg-terracotta-500 text-white' : 'bg-white text-ink-800 ring-1 ring-ink-200',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  {message.attachment?.kind === 'DEAL' && message.attachment.dealId && (
                    <Link
                      href={`/deals/${message.attachment.dealId}`}
                      className={cn(
                        'mt-2 block rounded-lg px-3 py-2 text-sm font-medium underline underline-offset-4',
                        mine ? 'bg-terracotta-600/60' : 'bg-sand-100',
                      )}
                    >
                      Open this trip
                    </Link>
                  )}
                </div>
                <time
                  dateTime={message.createdAt}
                  className={cn('mt-1 block text-[0.65rem] text-ink-400', mine && 'text-right')}
                >
                  {new Date(message.createdAt).toLocaleTimeString('en-CA', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {blockedNotice ? (
        <Alert tone="warning" className="mt-3">{blockedNotice}</Alert>
      ) : (
        <form onSubmit={send} className="mt-3 border-t border-ink-200 pt-3">
          {error && <Alert tone="error" className="mb-2">{error}</Alert>}
          <div className="flex items-end gap-2">
            <label htmlFor="message-body" className="sr-only">Your message</label>
            <textarea
              id="message-body"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(e)
                }
              }}
              placeholder="Write a message…"
              rows={1}
              maxLength={4000}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-ink-300 px-3.5 py-2.5 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
            />
            <Button type="submit" disabled={!draft.trim()} loading={sending}>
              Send
            </Button>
          </div>
          <p className="mt-1.5 text-[0.68rem] text-ink-400">
            Be careful sharing personal details or money with people you have not met.
          </p>
        </form>
      )}
    </div>
  )
}
