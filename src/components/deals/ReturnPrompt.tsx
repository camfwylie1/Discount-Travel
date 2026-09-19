'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import type { ProviderHandoff } from './ProviderViewer'

/**
 * WELCOME BACK
 *
 * Some providers will not allow their site to be shown inside another app, so
 * their page has to open in a tab of its own. That is the moment a discovery
 * product normally loses somebody for good.
 *
 * This keeps the thread. When the member comes back to the Voyaj tab, we are
 * still here, still on the trip they were looking at, and we ask one question:
 * did you book? Answering is optional and nothing is inferred from silence.
 *
 * The signal is `visibilitychange` — the member returning to this tab — rather
 * than a timer, so the question arrives when they are actually back rather
 * than while they are still reading.
 */
export function ReturnPrompt({
  handoff,
  onDone,
}: {
  handoff: ProviderHandoff
  onDone: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') setVisible(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    // Focus covers the case where the tab never lost visibility, such as a
    // popup blocker keeping the member here the whole time.
    window.addEventListener('focus', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [])

  if (!visible) return null

  function record(outcome: 'BOOKED' | 'NOT_BOOKED' | 'STILL_THINKING' | null) {
    if (outcome) {
      void fetch('/api/deals/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handoffId: handoff.handoffId, outcome }),
      }).catch(() => {})
    }
    onDone()
  }

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 sm:p-0"
      role="status"
    >
      <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-medium text-ink-900">
          Welcome back. Did you book with {handoff.provider}?
        </p>
        <p className="mt-1 text-xs text-ink-600 text-pretty">
          Only what you tell us — we never assume from a click.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => record('BOOKED')}>
            Yes
          </Button>
          <Button size="sm" variant="outline" onClick={() => record('STILL_THINKING')}>
            Still thinking
          </Button>
          <Button size="sm" variant="quiet" onClick={() => record('NOT_BOOKED')}>
            No
          </Button>
        </div>
        <button
          type="button"
          onClick={() => record(null)}
          className="mt-2 min-h-11 text-xs text-ink-500 underline underline-offset-4"
        >
          Dismiss
        </button>
      </div>
    </div>,
    document.body,
  )
}
