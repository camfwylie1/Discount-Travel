'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'

/**
 * IN-APP PROVIDER VIEWER
 *
 * Opens the seller's own page inside Voyaj so a member does not lose their
 * place, their trip, or the conversation they were having about it.
 *
 * Three things this deliberately does:
 *
 *   • It never pretends the page is ours. A bar across the top names the
 *     company, shows their real domain, says the booking is with them and not
 *     with Voyaj, and offers to open the page properly in a browser. Voyaj is
 *     a search service; a frame that hid whose site this was would turn that
 *     from a true statement into a misleading one.
 *
 *   • It assumes the frame may fail. Most travel sites refuse to be embedded,
 *     and a browser enforces that silently — no error event, just a permanently
 *     blank rectangle. So the viewer watches for a load that never arrives and
 *     falls back to opening the page normally, rather than leaving the member
 *     staring at nothing.
 *
 *   • It asks what happened. When the member closes the viewer, we ask whether
 *     they booked. They can decline to answer. Nothing is inferred from the
 *     fact that they clicked.
 */

const FRAME_TIMEOUT_MS = 6_000

export interface ProviderHandoff {
  url: string
  provider: string
  attribution: string
  handoffId: string
}

export function ProviderViewer({
  handoff,
  onClose,
}: {
  handoff: ProviderHandoff | null
  onClose: () => void
}) {
  if (!handoff) return null
  // Keyed on the destination so opening a different provider mounts a fresh
  // viewer. Resetting the load state inside an effect instead would re-render
  // the whole sheet on every open for no benefit.
  return <Viewer key={handoff.url} handoff={handoff} onClose={onClose} />
}

function Viewer({
  handoff,
  onClose,
}: {
  handoff: ProviderHandoff
  onClose: () => void
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'blocked'>('loading')
  const [asking, setAsking] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const host = safeHost(handoff.url)

  const openInBrowser = useCallback(() => {
    window.open(handoff.url, '_blank', 'noopener,noreferrer')
  }, [handoff])

  // A refused frame produces no error event, so the only reliable signal is a
  // load that never happens. If nothing has loaded by the timeout, treat the
  // frame as blocked and offer the member a way out that works.
  useEffect(() => {
    const timer = setTimeout(() => {
      setState((current) => (current === 'loading' ? 'blocked' : current))
    }, FRAME_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAsking(true)
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    // The page behind must not scroll while the viewer is over it.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [])

  function record(outcome: 'BOOKED' | 'NOT_BOOKED' | 'STILL_THINKING' | null) {
    if (outcome) {
      // Best effort. Losing this answer must never block the member.
      void fetch('/api/deals/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handoffId: handoff.handoffId, outcome }),
      }).catch(() => {})
    }
    setAsking(false)
    onClose()
  }

  // Rendered into the body. A fixed overlay left inside the page is trapped by
  // whatever stacking context its ancestors create, and the sticky app header
  // was painting over this sheet's own close button.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-ink-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${handoff.provider} — viewing inside Voyaj`}
      ref={dialogRef}
      tabIndex={-1}
    >
      {/* Whose site this is. Never collapsed, never ambiguous. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-950 px-3 py-2 text-white sm:px-4">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="flex h-11 min-w-11 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close and return to Voyaj"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M12.7 5.3a1 1 0 0 1 0 1.4L9.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.4 0Z" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{handoff.provider}</p>
          <p className="truncate text-xs text-white/60">
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M10 1a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2 6V5a2 2 0 1 0-4 0v2h4Z"
                  clipRule="evenodd"
                />
              </svg>
              {host}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={openInBrowser}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          Open in browser
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M11 3a1 1 0 1 0 0 2h2.6l-6.3 6.3a1 1 0 1 0 1.4 1.4L15 6.4V9a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-5Z" />
            <path d="M5 5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3a1 1 0 1 0-2 0v3H5V7h3a1 1 0 0 0 0-2H5Z" />
          </svg>
        </button>
      </div>

      <p className="shrink-0 bg-gold-100 px-4 py-1.5 text-center text-xs text-ink-800">
        {handoff.attribution}
      </p>

      <div className="relative min-h-0 flex-1 bg-white">
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-ink-500">Loading {handoff.provider}…</p>
          </div>
        )}

        {state === 'blocked' ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <h2 className="text-lg font-semibold text-ink-900">
              {handoff.provider} does not allow their site to be shown inside another app
            </h2>
            <p className="max-w-md text-sm text-ink-600 text-pretty">
              That is their choice, and a common one for travel sites. Open their page in a
              browser tab instead — Voyaj will keep this trip and your place here.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={openInBrowser}>Open {handoff.provider}</Button>
              <Button variant="outline" onClick={() => setAsking(true)}>
                Back to Voyaj
              </Button>
            </div>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            src={handoff.url}
            title={`${handoff.provider} (external site)`}
            onLoad={() => setState('ready')}
            className="h-full w-full border-0"
            // The framed site is a third party. It gets no access to this page,
            // no payment or camera permissions, and no ability to navigate us.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
            allow=""
          />
        )}
      </div>

      {asking && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-ink-950/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink-900">
              Did you book with {handoff.provider}?
            </h2>
            <p className="mt-1 text-sm text-ink-600 text-pretty">
              Only what you tell us. It helps us show you better trips, and we never guess from
              a click.
            </p>
            <div className="mt-4 grid gap-2">
              <Button onClick={() => record('BOOKED')}>Yes, I booked</Button>
              <Button variant="outline" onClick={() => record('STILL_THINKING')}>
                Still thinking about it
              </Button>
              <Button variant="quiet" onClick={() => record('NOT_BOOKED')}>
                No, not this one
              </Button>
              <button
                type="button"
                onClick={() => record(null)}
                className="mt-1 min-h-11 text-sm text-ink-500 underline underline-offset-4"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'external site'
  }
}
