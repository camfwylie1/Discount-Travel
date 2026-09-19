'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Spinner } from '@/components/ui'
import { Avatar } from '@/components/layout/AppNav'
import { cn } from '@/lib/utils'

/**
 * SHARE A TRIP
 *
 * Send to a person, a circle, or a trip group. Deliberately one tap from the
 * deal page — sharing is the mechanism that makes the network worth joining.
 */

interface ShareTargets {
  connections: { id: string; firstName: string; photoThumbUrl: string | null }[]
  circles: { id: string; name: string; memberCount: number }[]
  trips: { id: string; name: string }[]
}

export function ShareDeal({
  dealId,
  dealTitle,
  locked = false,
}: {
  dealId: string
  dealTitle: string
  locked?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<ShareTargets | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  /**
   * "Loading" is not its own state: the sheet is waiting exactly when it is
   * open, unlocked, and has neither contacts nor an error yet. Deriving it
   * keeps the effect from setting state during its own body, which would
   * re-render the sheet twice for every open.
   */
  const loading = open && !locked && !targets && !error

  useEffect(() => {
    if (!open || targets || locked) return
    const controller = new AbortController()

    void fetch('/api/social/share-targets', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then(setTargets)
      .catch((reason: unknown) => {
        // An abort is us closing the sheet, not a failure worth reporting.
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError('We could not load your contacts.')
      })

    return () => controller.abort()
  }, [open, targets, locked])

  // Close on Escape, and trap focus inside the sheet.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function share(target: 'USER' | 'CIRCLE' | 'TRIP', id: string, key: string) {
    setSending(key)
    setError(null)
    const response = await fetch('/api/deals/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dealId,
        target,
        ...(target === 'USER' ? { recipientId: id } : target === 'CIRCLE' ? { circleId: id } : { tripId: id }),
        message: message.trim() || undefined,
      }),
    })
    setSending(null)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error ?? 'We could not send that.')
      if (response.status === 402) router.push('/upgrade?from=share')
      return
    }
    setSent((prev) => new Set(prev).add(key))
  }

  async function copyLink() {
    const url = `${window.location.origin}/deals/${dealId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copying is blocked in this browser. The link is in your address bar.')
    }
  }

  function openSheet() {
    if (locked) {
      router.push('/upgrade?from=share')
      return
    }
    setOpen(true)
  }

  return (
    <>
      <Button variant="outline" onClick={openSheet} className="flex-1">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        Share
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            tabIndex={-1}
            className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-safe shadow-lift sm:max-w-md sm:rounded-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="share-title" className="text-lg font-semibold">Share this trip</h2>
                <p className="mt-0.5 truncate text-sm text-ink-500">{dealTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note (optional)"
              maxLength={500}
              rows={2}
              aria-label="Message to send with this trip"
              className="mt-4 w-full rounded-xl border border-ink-300 px-3.5 py-2.5 text-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
            />

            {error && <Alert tone="error" className="mt-3">{error}</Alert>}

            {loading && (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6 text-ink-400" />
              </div>
            )}

            {targets && (
              <div className="mt-4 space-y-5">
                <Group title="Your circles" empty="You have not made a circle yet.">
                  {targets.circles.map((circle) => (
                    <Row
                      key={circle.id}
                      label={circle.name}
                      sublabel={`${circle.memberCount} ${circle.memberCount === 1 ? 'person' : 'people'}`}
                      sent={sent.has(`circle:${circle.id}`)}
                      sending={sending === `circle:${circle.id}`}
                      onClick={() => share('CIRCLE', circle.id, `circle:${circle.id}`)}
                    />
                  ))}
                </Group>

                <Group title="Your trips" empty="No trips in planning.">
                  {targets.trips.map((trip) => (
                    <Row
                      key={trip.id}
                      label={trip.name}
                      sent={sent.has(`trip:${trip.id}`)}
                      sending={sending === `trip:${trip.id}`}
                      onClick={() => share('TRIP', trip.id, `trip:${trip.id}`)}
                    />
                  ))}
                </Group>

                <Group title="People" empty="Connect with someone to share trips with them.">
                  {targets.connections.map((person) => (
                    <Row
                      key={person.id}
                      label={person.firstName}
                      avatar={<Avatar url={person.photoThumbUrl} name={person.firstName} size={32} />}
                      sent={sent.has(`user:${person.id}`)}
                      sending={sending === `user:${person.id}`}
                      onClick={() => share('USER', person.id, `user:${person.id}`)}
                    />
                  ))}
                </Group>
              </div>
            )}

            <div className="mt-5 border-t border-ink-100 pt-4">
              <Button variant="quiet" fullWidth onClick={copyLink}>
                {copied ? 'Link copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Group({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children : [children]
  const hasItems = items.filter(Boolean).length > 0
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</h3>
      {hasItems ? (
        <ul className="mt-2 space-y-1">{children}</ul>
      ) : (
        <p className="mt-2 text-sm text-ink-400">{empty}</p>
      )}
    </div>
  )
}

function Row({
  label,
  sublabel,
  avatar,
  sent,
  sending,
  onClick,
}: {
  label: string
  sublabel?: string
  avatar?: React.ReactNode
  sent: boolean
  sending: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={sent || sending}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors',
          sent ? 'bg-moss-100 text-moss-700' : 'hover:bg-ink-50',
        )}
      >
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.95rem] font-medium">{label}</span>
          {sublabel && <span className="block text-xs text-ink-500">{sublabel}</span>}
        </span>
        <span className="shrink-0 text-sm">
          {sending ? <Spinner className="h-4 w-4" /> : sent ? 'Sent' : 'Send'}
        </span>
      </button>
    </li>
  )
}
