import { RADAR_AXES } from '@/lib/taxonomy/dimensions'
import { cn } from '@/lib/utils'

/**
 * TRAVEL DNA CHART
 *
 * A ten-axis radar drawn as inline SVG — no charting library, no client-side
 * JavaScript, and it renders identically on the server. Accessible: the shape
 * is decorative and the real values are exposed as a description list that
 * screen readers (and anyone who prefers numbers) can read.
 */

export interface RadarChartProps {
  values: Record<string, number>
  size?: number
  className?: string
  showLabels?: boolean
  /** A second profile drawn behind the first — used for comparing two people. */
  compareValues?: Record<string, number>
  compareLabel?: string
  primaryLabel?: string
}

const RINGS = [0.25, 0.5, 0.75, 1]

export function RadarChart({
  values,
  size = 320,
  className,
  showLabels = true,
  compareValues,
  compareLabel,
  primaryLabel,
}: RadarChartProps) {
  const axes = RADAR_AXES
  const cx = size / 2
  const cy = size / 2
  // Leave room for the labels around the outside.
  const radius = (size / 2) * (showLabels ? 0.62 : 0.86)

  const pointAt = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  }

  const polygon = (source: Record<string, number>) =>
    axes
      .map((axis, i) => {
        const p = pointAt(i, source[axis.key] ?? 50)
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
      })
      .join(' ')

  return (
    <figure className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto h-auto w-full max-w-[380px]"
        role="img"
        aria-label={`Travel DNA chart across ${axes.length} dimensions`}
      >
        {/* Rings */}
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={axes
              .map((_, i) => {
                const p = pointAt(i, ring * 100)
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
              })
              .join(' ')}
            fill="none"
            stroke="var(--color-ink-200)"
            strokeWidth="1"
          />
        ))}

        {/* Spokes */}
        {axes.map((axis, i) => {
          const p = pointAt(i, 100)
          return (
            <line
              key={axis.key}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="var(--color-ink-200)"
              strokeWidth="1"
            />
          )
        })}

        {/* Comparison shape, drawn first so it sits behind */}
        {compareValues && (
          <polygon
            points={polygon(compareValues)}
            fill="var(--color-ocean-500)"
            fillOpacity="0.16"
            stroke="var(--color-ocean-500)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        )}

        {/* Primary shape */}
        <polygon
          points={polygon(values)}
          fill="var(--color-terracotta-500)"
          fillOpacity="0.2"
          stroke="var(--color-terracotta-500)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Vertices */}
        {axes.map((axis, i) => {
          const p = pointAt(i, values[axis.key] ?? 50)
          return (
            <circle
              key={axis.key}
              cx={p.x}
              cy={p.y}
              r="3.5"
              fill="var(--color-terracotta-500)"
              stroke="white"
              strokeWidth="1.5"
            />
          )
        })}

        {/* Labels */}
        {showLabels &&
          axes.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2
            const labelRadius = radius + size * 0.085
            const x = cx + Math.cos(angle) * labelRadius
            const y = cy + Math.sin(angle) * labelRadius
            const anchor = Math.abs(Math.cos(angle)) < 0.25 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
            return (
              <text
                key={axis.key}
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-ink-600"
                style={{ fontSize: size * 0.038, fontWeight: 500 }}
              >
                {axis.label}
              </text>
            )
          })}
      </svg>

      {(primaryLabel || compareLabel) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-600">
          {primaryLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-terracotta-500" />
              {primaryLabel}
            </span>
          )}
          {compareLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border-2 border-dashed border-ocean-500" />
              {compareLabel}
            </span>
          )}
        </div>
      )}

      {/* The accessible, non-visual version of the same data. */}
      <figcaption className="sr-only">
        <dl>
          {axes.map((axis) => (
            <div key={axis.key}>
              <dt>{axis.label}</dt>
              <dd>{Math.round(values[axis.key] ?? 50)} out of 100</dd>
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  )
}

/** A compact horizontal-bar version, for narrow spaces like profile cards. */
export function RadarBars({ values, limit = 5 }: { values: Record<string, number>; limit?: number }) {
  const sorted = RADAR_AXES.map((a) => ({ ...a, value: Math.round(values[a.key] ?? 50) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)

  return (
    <dl className="space-y-2.5">
      {sorted.map((axis) => (
        <div key={axis.key} className="flex items-center gap-3">
          <dt className="w-24 shrink-0 text-xs text-ink-600">{axis.label}</dt>
          <dd className="flex flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-terracotta-500"
                style={{ width: `${axis.value}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-500">
              {axis.value}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
