'use client'

import { useLiveDeals } from './useLiveDeals'
import { formatMoney } from '@/config/pricing'

/**
 * A price that corrects itself while the member is looking at it.
 *
 * Travel pricing moves, and the most damaging thing this product can do is
 * show a stale price as though it were current — it is the number somebody
 * acts on with their own money. So when a provider posts a change, it lands
 * here rather than waiting for a reload.
 *
 * The change is announced rather than swapped in silently. A price that
 * quietly becomes a different number while you are reading it is worse than
 * one that tells you it moved and by how much.
 */
export function LivePrice({
  dealId,
  initialPriceCents,
  currency,
  className,
  style,
}: {
  dealId: string
  initialPriceCents: number | null
  currency: string
  className?: string
  style?: React.CSSProperties
}) {
  const { changes } = useLiveDeals([dealId])
  const change = changes[dealId]

  const current =
    change?.salePriceCents != null ? change.salePriceCents : initialPriceCents
  const previous = change?.previousPriceCents ?? null
  const moved = previous != null && current != null && previous !== current
  const cheaper = moved && current < previous

  return (
    <span className={className} style={style}>
      <span aria-live="polite">
        {current == null ? 'Price on request' : formatMoney(current, change?.currency ?? currency)}
      </span>

      {moved && (
        <span
          className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${
            cheaper ? 'bg-moss-100 text-moss-700' : 'bg-gold-100 text-gold-800'
          }`}
        >
          {cheaper ? 'Dropped' : 'Rose'} from {formatMoney(previous, change?.currency ?? currency)}
          <span className="sr-only"> just now, while you were looking at this page</span>
        </span>
      )}
    </span>
  )
}

/**
 * A small, honest indicator of whether the live connection is actually up.
 *
 * It says "Live" only once the server has confirmed the stream, never while
 * the connection is merely being attempted. A green dot over a stale price is
 * a worse lie than no dot at all.
 */
export function LiveIndicator({ dealIds }: { dealIds: string[] }) {
  const { status } = useLiveDeals(dealIds)

  if (status !== 'live') return null

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-moss-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-moss-500" />
      </span>
      Updating live as providers post
    </span>
  )
}
