import { matchBand } from '@/lib/recommendations/explain'
import { cn } from '@/lib/utils'

/**
 * MATCH SCORE RING
 *
 * The headline number. Colour follows the band so a weak match never looks
 * like a strong one, and the score is always accompanied by its reasons
 * elsewhere on the page — never presented as a bare number.
 */

const BAND_COLOUR = {
  excellent: 'var(--color-moss-500)',
  strong: 'var(--color-ocean-500)',
  good: 'var(--color-gold-500)',
  fair: 'var(--color-ink-400)',
  weak: 'var(--color-ink-300)',
} as const

export function MatchScoreRing({
  score,
  size = 64,
  className,
  label = 'match',
}: {
  score: number
  size?: number
  className?: string
  label?: string
}) {
  const band = matchBand(score)
  const stroke = Math.max(4, size * 0.09)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${score} percent ${label}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={BAND_COLOUR[band]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold leading-none tabular-nums"
          style={{ fontSize: size * 0.3, fontFamily: 'var(--font-display)' }}
        >
          {Math.round(score)}
        </span>
        {size >= 64 && (
          <span className="mt-0.5 text-[0.55rem] font-medium uppercase tracking-wider text-ink-500">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

/** The inline pill version used on compact deal cards. */
export function MatchScorePill({ score, className }: { score: number; className?: string }) {
  const band = matchBand(score)
  const tones = {
    excellent: 'bg-moss-500 text-white',
    strong: 'bg-ocean-500 text-white',
    good: 'bg-gold-500 text-white',
    fair: 'bg-ink-200 text-ink-700',
    weak: 'bg-ink-100 text-ink-600',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
        tones[band],
        className,
      )}
    >
      {Math.round(score)}% match
    </span>
  )
}
