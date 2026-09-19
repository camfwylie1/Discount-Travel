'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui'
import { ProviderViewer, type ProviderHandoff } from './ProviderViewer'
import { ReturnPrompt } from './ReturnPrompt'
import { cn } from '@/lib/utils'

/**
 * DEAL ACTIONS
 *
 * Save, share and the outbound click. Every one of these is a real database
 * write behind a server-authorised route — none of it is local state.
 */

export function SaveButton({
  dealId,
  initialSaved,
  placement = 'feed',
  position,
  variant = 'icon',
  className,
}: {
  dealId: string
  initialSaved: boolean
  placement?: string
  /** Rank of this trip in the list it was shown in, recorded with the save. */
  position?: number
  variant?: 'icon' | 'button'
  className?: string
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(event: React.MouseEvent) {
    // The card is wrapped in a stretched link; this must not navigate.
    event.preventDefault()
    event.stopPropagation()
    if (busy) return
    setBusy(true)
    setError(null)

    const optimistic = !saved
    setSaved(optimistic)

    const response = await fetch('/api/deals/save', {
      method: optimistic ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dealId, placement, position }),
    })

    if (!response.ok) {
      setSaved(!optimistic) // roll back
      const body = await response.json().catch(() => ({}))
      setError(body.error ?? 'Could not save that.')
      if (response.status === 402) router.push('/upgrade?from=save')
      if (response.status === 401) router.push('/login')
    } else {
      router.refresh()
    }
    setBusy(false)
  }

  if (variant === 'button') {
    return (
      <Button variant={saved ? 'quiet' : 'outline'} onClick={toggle} loading={busy} className={className}>
        <HeartIcon filled={saved} />
        {saved ? 'Saved' : 'Save'}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved trips' : 'Save this trip'}
      title={error ?? undefined}
      className={cn(
        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full backdrop-blur transition-colors',
        saved ? 'bg-terracotta-500 text-white' : 'bg-white/85 text-ink-700 hover:bg-white',
        className,
      )}
    >
      <HeartIcon filled={saved} />
    </button>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  )
}

/**
 * The outbound click. Records who, which deal, which provider, when and from
 * where BEFORE redirecting, so affiliate reconciliation has a record even if
 * the provider's page never loads.
 */
export function ViewDealButton({
  dealId,
  providerName,
  placement = 'detail',
  position,
  locked = false,
  className,
}: {
  dealId: string
  providerName: string
  placement?: string
  /** Rank of this trip in the list it was shown in, recorded with the click. */
  position?: number
  locked?: boolean
  className?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<ProviderHandoff | null>(null)
  const [returning, setReturning] = useState<ProviderHandoff | null>(null)

  async function go() {
    if (locked) {
      router.push('/upgrade?from=view-deal')
      return
    }
    setBusy(true)
    setError(null)
    const response = await fetch('/api/deals/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dealId, placement, position }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 402) {
        router.push('/upgrade?from=view-deal')
        return
      }
      setError(data.error ?? 'Could not open that trip.')
      setBusy(false)
      return
    }
    // Where the provider has agreed to it, their page opens inside Voyaj so
    // the member keeps their place, their trip and the conversation they were
    // having about it. Where they have not, it opens in a new tab — which is
    // still not a dead end, because the handoff is recorded and we pick the
    // thread back up when the member returns.
    if (data.openMode === 'IN_APP') {
      setHandoff({
        url: data.url,
        provider: data.provider,
        attribution: data.attribution,
        handoffId: data.handoffId,
      })
    } else {
      window.open(data.url, '_blank', 'noopener,noreferrer')
      setReturning({
        url: data.url,
        provider: data.provider,
        attribution: data.attribution,
        handoffId: data.handoffId,
      })
    }
    setBusy(false)
  }

  return (
    <div className={className}>
      <Button size="lg" fullWidth onClick={go} loading={busy}>
        {locked ? 'Join to view this trip' : `View on ${providerName}`}
        {!locked && (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M11 3a1 1 0 1 0 0 2h2.6l-6.3 6.3a1 1 0 1 0 1.4 1.4L15 6.4V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
          </svg>
        )}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-berry-500">
          {error}
        </p>
      )}
      <p className="mt-2 text-center text-xs text-ink-500">
        {providerName} sells and operates this trip. Voyaj does not handle the booking and is
        not a party to it.
      </p>

      <ProviderViewer handoff={handoff} onClose={() => setHandoff(null)} />

      {/* The provider's site opened in a tab of its own. Rather than treat that
          as the member leaving, hold their place here and pick the thread back
          up the moment they come back to this tab. */}
      {returning && (
        <ReturnPrompt handoff={returning} onDone={() => setReturning(null)} />
      )}
    </div>
  )
}

/** "Was this recommendation useful?" — the feedback loop. */
export function RecommendationFeedback({ dealId }: { dealId: string }) {
  const [sent, setSent] = useState<'yes' | 'no' | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const REASONS = [
    ['TOO_EXPENSIVE', 'Too expensive'],
    ['WRONG_DESTINATION', 'Wrong destination'],
    ['WRONG_DATES', 'Wrong dates'],
    ['TOO_LONG', 'Too long'],
    ['TOO_SHORT', 'Too short'],
    ['NOT_MY_STYLE', 'Not my travel style'],
    ['WRONG_AIRPORT', 'Wrong departure airport'],
    ['ACTIVITY', 'Not interested in the activities'],
    ['OTHER', 'Something else'],
  ] as const

  async function send(helpful: boolean, why?: string) {
    setSent(helpful ? 'yes' : 'no')
    startTransition(() => {})
    await fetch('/api/deals/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dealId, helpful, reason: why }),
    }).catch(() => {})
    if (why) setReason(why)
  }

  if (sent === 'yes' || reason) {
    return (
      <p className="text-sm text-ink-500" role="status">
        Thanks — that helps us tune your recommendations.
      </p>
    )
  }

  if (sent === 'no') {
    return (
      <div>
        <p className="text-sm font-medium text-ink-700">What was wrong with it?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => send(false, value)}
              className="rounded-full border border-ink-300 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-ink-500 hover:bg-ink-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-ink-600">Was this a good recommendation?</p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => send(true)}>
          Yes
        </Button>
        <Button size="sm" variant="outline" onClick={() => send(false)}>
          No
        </Button>
      </div>
    </div>
  )
}
