import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui'
import { MatchScorePill } from './MatchScoreRing'
import { SaveButton } from './DealActions'
import { formatMoneyCompact } from '@/config/pricing'
import { formatDateRange, plural, timeAgo } from '@/lib/utils'
import { valueBandLabel } from '@/lib/recommendations/dealValue'
import type { MatchReason } from '@/lib/recommendations/types'
import { cn } from '@/lib/utils'

/**
 * DEAL CARD
 *
 * The normalisation payoff: a trip from a flash-sale site and a trip from a
 * boutique tour operator arrive in wildly different shapes, and both render
 * here in exactly the same hierarchy.
 *
 * Destination → title → provider → dates → duration → airport → price →
 * discount → match → style → inclusions.
 *
 * Anything the provider did not tell us says "Not specified". It never
 * guesses, and it never leaves a blank that reads as a zero.
 */

export interface DealCardData {
  id: string
  slug: string
  normalizedTitle: string
  destinationCity: string | null
  destinationRegion: string | null
  destinationCountry: string | null
  continent: string | null
  departureDate: Date | null
  returnDate: Date | null
  durationNights: number | null
  salePriceCents: number | null
  regularPriceCents: number | null
  discountPercent: number | null
  currency: string
  airfareIncluded: boolean | null
  status: string
  tripStyle: string[]
  valueScore: number | null
  sourceLastCheckedAt: Date | null
  isDemoContent: boolean
  spotsRemaining: number | null
  provider: { name: string; slug: string; logoUrl: string | null; sponsored: boolean }
  departureAirport: { iata: string; city: string } | null
  images: { url: string; alt: string | null }[]
}

export interface DealCardProps {
  deal: DealCardData
  matchScore?: number
  reasons?: MatchReason[]
  saved?: boolean
  showMatch?: boolean
  /** Blur the score and reasons behind the paywall. */
  locked?: boolean
  placement?: string
  position?: number
  className?: string
  compact?: boolean
}

const STATUS_LABEL: Record<string, { label: string; variant: 'gold' | 'berry' | 'neutral' }> = {
  POSSIBLY_EXPIRED: { label: 'May have ended', variant: 'gold' },
  EXPIRED: { label: 'Ended', variant: 'berry' },
  SOLD_OUT: { label: 'Sold out', variant: 'berry' },
  UNKNOWN: { label: 'Availability unknown', variant: 'neutral' },
}

export function DealCard({
  deal,
  matchScore,
  reasons = [],
  saved = false,
  showMatch = true,
  locked = false,
  placement = 'feed',
  position,
  className,
  compact = false,
}: DealCardProps) {
  const hero = deal.images[0]
  const destination = [deal.destinationCity, deal.destinationRegion, countryName(deal.destinationCountry)]
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
  const statusInfo = STATUS_LABEL[deal.status]
  const unavailable = deal.status !== 'ACTIVE'

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card border border-ink-200/70 bg-white shadow-card transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-card-hover focus-within:shadow-card-hover',
        unavailable && 'opacity-75',
        className,
      )}
    >
      {/* Image */}
      <div className={cn('relative shrink-0 overflow-hidden bg-ink-100', compact ? 'aspect-[16/9]' : 'aspect-[3/2]')}>
        {hero ? (
          <Image
            src={hero.url}
            alt={hero.alt ?? ''}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            No photo provided
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {showMatch && matchScore !== undefined && !locked && <MatchScorePill score={matchScore} />}
            {locked && (
              <Badge variant="dark" className="backdrop-blur">
                Match hidden
              </Badge>
            )}
            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
            {deal.provider.sponsored && <Badge variant="outline" className="border-white/50 bg-white/85">Sponsored</Badge>}
          </div>
          <SaveButton dealId={deal.id} initialSaved={saved} placement={placement} position={position} />
        </div>

        {deal.isDemoContent && (
          <span className="absolute bottom-2 left-3 rounded bg-ink-950/70 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-white/90 backdrop-blur">
            Demo listing
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-terracotta-600">
          {destination || 'Destination not specified'}
        </p>

        <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-ink-900">
          <Link href={`/deals/${deal.id}`} className="after:absolute after:inset-0 after:content-['']">
            {deal.normalizedTitle}
          </Link>
        </h3>

        <p className="mt-1 text-xs text-ink-500">{deal.provider.name}</p>

        {/* Facts row */}
        <dl className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Dates</dt>
            <dd>{deal.departureDate ? formatDateRange(deal.departureDate, deal.returnDate) : 'Dates not specified'}</dd>
          </div>
          <span className="text-ink-300" aria-hidden="true">·</span>
          <div>
            <dt className="sr-only">Duration</dt>
            <dd>{deal.durationNights ? plural(deal.durationNights, 'night') : 'Length not specified'}</dd>
          </div>
          {deal.departureAirport && (
            <>
              <span className="text-ink-300" aria-hidden="true">·</span>
              <div>
                <dt className="sr-only">Departs from</dt>
                <dd>from {deal.departureAirport.iata}</dd>
              </div>
            </>
          )}
        </dl>

        {/* Why it matches */}
        {!locked && reasons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason.key}>
                <Badge variant={reason.kind === 'love' ? 'moss' : 'ocean'}>{reason.label}</Badge>
              </li>
            ))}
          </ul>
        )}
        {locked && (
          <p className="mt-3 text-xs text-ink-500 text-pretty">
            Join to see why this matches you and to open the provider’s page.
          </p>
        )}

        {/* Price */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            {deal.salePriceCents !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                    {formatMoneyCompact(deal.salePriceCents, deal.currency)}
                  </span>
                  {deal.regularPriceCents && deal.regularPriceCents > deal.salePriceCents && (
                    <span className="text-sm text-ink-400 line-through tabular-nums">
                      {formatMoneyCompact(deal.regularPriceCents, deal.currency)}
                    </span>
                  )}
                </div>
                <p className="text-[0.7rem] text-ink-500">
                  per person{deal.airfareIncluded === true ? ', flights included' : deal.airfareIncluded === false ? ', flights extra' : ''}
                </p>
              </>
            ) : (
              <span className="text-sm text-ink-500">Price not specified</span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            {deal.discountPercent !== null && deal.discountPercent >= 5 && (
              <Badge variant="terracotta">{Math.round(deal.discountPercent)}% off</Badge>
            )}
            {deal.valueScore !== null && deal.valueScore >= 68 && (
              <Badge variant="gold">
                {valueBandLabel(deal.valueScore >= 82 ? 'exceptional' : 'great')}
              </Badge>
            )}
          </div>
        </div>

        {/* Freshness — never present stale data as live */}
        <p className="mt-2.5 border-t border-ink-100 pt-2.5 text-[0.68rem] text-ink-400">
          {deal.sourceLastCheckedAt
            ? `Last checked ${timeAgo(deal.sourceLastCheckedAt)}`
            : 'Freshness unknown'}
          {deal.spotsRemaining !== null && deal.spotsRemaining <= 4 && (
            <span className="text-ink-500"> · {plural(deal.spotsRemaining, 'place')} left, per the provider</span>
          )}
        </p>
      </div>
    </article>
  )
}

const COUNTRY_NAMES: Record<string, string> = {
  CR: 'Costa Rica', MX: 'Mexico', PT: 'Portugal', IT: 'Italy', ES: 'Spain',
  GR: 'Greece', IS: 'Iceland', JP: 'Japan', TH: 'Thailand', ID: 'Indonesia',
  PE: 'Peru', CL: 'Chile', TZ: 'Tanzania', ZA: 'South Africa', DO: 'Dominican Republic',
  JM: 'Jamaica', CA: 'Canada', FR: 'France', CH: 'Switzerland', GB: 'United Kingdom',
  US: 'United States', VN: 'Vietnam', CU: 'Cuba', MA: 'Morocco', NZ: 'New Zealand',
  AR: 'Argentina', BR: 'Brazil', CO: 'Colombia', EC: 'Ecuador', KE: 'Kenya',
  BW: 'Botswana', NL: 'Netherlands', DE: 'Germany',
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  return COUNTRY_NAMES[code] ?? code
}

/** Skeleton used while a feed section loads. */
export function DealCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-card border border-ink-200/70 bg-white">
      <div className={cn('skeleton', compact ? 'aspect-[16/9]' : 'aspect-[3/2]')} />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="flex justify-between pt-3">
          <div className="skeleton h-6 w-20 rounded" />
          <div className="skeleton h-6 w-16 rounded" />
        </div>
      </div>
    </div>
  )
}
