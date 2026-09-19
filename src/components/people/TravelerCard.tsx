import Link from 'next/link'
import { Avatar } from '@/components/layout/AppNav'
import { Badge } from '@/components/ui'
import { MatchScorePill } from '@/components/deals/MatchScoreRing'
import { ConnectButton } from './PeopleActions'
import type { MatchMismatch, MatchReason } from '@/lib/recommendations/types'

export interface TravelerCardData {
  id: string
  firstName: string
  lastInitial: string | null
  headline: string | null
  photoThumbUrl: string | null
  ageRange: string | null
  homeCity: string | null
  personalityTitle: string | null
  topInterests: string[]
  wishlist: string[]
  /** Which fields the viewer is actually allowed to see. */
  visible: { photo: boolean; age: boolean; city: boolean; wishlist: boolean }
}

/**
 * TRAVELLER CARD
 *
 * Shows only what this particular viewer is permitted to see — the card is
 * built from an already-filtered object, so a privacy setting cannot be
 * forgotten at render time.
 *
 * Compatibility is computed from travel characteristics only.
 */
export function TravelerCard({
  traveler,
  score,
  shared = [],
  conflicts = [],
  connectionStatus,
}: {
  traveler: TravelerCardData
  score?: number
  shared?: MatchReason[]
  conflicts?: MatchMismatch[]
  connectionStatus?: string | null
}) {
  const bothLove = shared.filter((s) => s.kind === 'love').slice(0, 4)
  const similar = shared.filter((s) => s.kind === 'fit').slice(0, 3)

  return (
    <article className="group relative flex flex-col rounded-card border border-ink-200/70 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-start gap-4">
        <Avatar
          url={traveler.visible.photo ? traveler.photoThumbUrl : null}
          name={traveler.firstName}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">
            <Link href={`/people/${traveler.id}`} className="after:absolute after:inset-0 after:content-['']">
              {traveler.firstName}
              {traveler.lastInitial ? ` ${traveler.lastInitial}.` : ''}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {[
              traveler.visible.age ? traveler.ageRange : null,
              traveler.visible.city ? traveler.homeCity : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Traveller'}
          </p>
          {traveler.personalityTitle && (
            <p className="mt-1.5 text-sm text-terracotta-600">{traveler.personalityTitle}</p>
          )}
        </div>
        {score !== undefined && <MatchScorePill score={score} className="shrink-0" />}
      </div>

      {traveler.headline && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-600 text-pretty">{traveler.headline}</p>
      )}

      {bothLove.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-moss-700">Both love</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {bothLove.map((item) => (
              <Badge key={item.key} variant="moss">{item.label}</Badge>
            ))}
          </div>
        </div>
      )}

      {similar.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ocean-700">Similar</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {similar.map((item) => (
              <Badge key={item.key} variant="ocean">{item.label}</Badge>
            ))}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">
            Where you differ
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {conflicts.slice(0, 3).map((c) => c.label).join(' · ')}
          </p>
        </div>
      )}

      {traveler.visible.wishlist && traveler.wishlist.length > 0 && (
        <p className="mt-3 text-xs text-ink-500">
          Wants to visit: {traveler.wishlist.slice(0, 3).join(', ')}
        </p>
      )}

      <div className="relative z-10 mt-auto pt-4">
        <ConnectButton userId={traveler.id} status={connectionStatus} firstName={traveler.firstName} />
      </div>
    </article>
  )
}

export function TravelerCardSkeleton() {
  return (
    <div className="rounded-card border border-ink-200/70 bg-white p-5">
      <div className="flex gap-4">
        <div className="skeleton h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
      <div className="skeleton mt-5 h-10 w-full rounded-xl" />
    </div>
  )
}
