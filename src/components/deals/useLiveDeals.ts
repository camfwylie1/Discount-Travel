'use client'

import { useEffect, useState } from 'react'
import type { DealChange } from '@/lib/live/bus'

export type LiveStatus = 'connecting' | 'live' | 'offline'

/**
 * Subscribes to live deal changes for the deals currently on screen.
 *
 * Returns the changes keyed by deal id, plus a connection status the UI can
 * show honestly. "Live" is only reported once the server has actually said
 * hello — an EventSource that is still opening is reported as connecting, not
 * as live, because a stale price under a green "live" dot is worse than a
 * stale price under no dot at all.
 */
export function useLiveDeals(dealIds: string[]) {
  const [changes, setChanges] = useState<Record<string, DealChange>>({})
  const [streamStatus, setStreamStatus] = useState<LiveStatus>('connecting')

  // The ids are a new array on every render, so the effect keys off their
  // contents rather than their identity or it reconnects continuously.
  const key = dealIds.slice().sort().join(',')

  // With nothing to watch there is no stream, which is a derived fact rather
  // than a state to set — setting it inside the effect would re-render every
  // consumer of this hook for no reason.
  const status: LiveStatus = key ? streamStatus : 'offline'

  useEffect(() => {
    if (!key) return

    const source = new EventSource(`/api/live/deals?deals=${encodeURIComponent(key)}`)

    source.addEventListener('ready', () => setStreamStatus('live'))

    source.addEventListener('deal-change', (event) => {
      try {
        const change = JSON.parse((event as MessageEvent).data) as DealChange
        setChanges((current) => ({ ...current, [change.dealId]: change }))
      } catch {
        // A malformed frame is not a reason to tear down a working stream.
      }
    })

    // EventSource reconnects by itself; this only reflects that in the UI so
    // nobody is told they are seeing live prices while the pipe is down.
    source.onerror = () => setStreamStatus((s) => (s === 'live' ? 'connecting' : s))

    return () => source.close()
  }, [key])

  return { changes, status }
}
