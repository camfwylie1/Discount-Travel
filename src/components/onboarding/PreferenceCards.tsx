'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button } from '@/components/ui'
import { RATING_LABELS } from '@/lib/taxonomy/dimensions'
import { cn } from '@/lib/utils'

/**
 * PREFERENCE CARDS
 *
 * A five-point scale rendered as five tappable dots per item, not a slider —
 * sliders are fiddly on a phone and imply a precision nobody has about
 * whether they like museums.
 *
 * The scale is deliberately asymmetric in meaning, not value: the left-hand
 * end is "actively avoid", which genuinely counts against a trip.
 */

export interface DimensionOption {
  key: string
  label: string
  description?: string | null
  rating: number | null
}

const DOT_TONES = [
  'bg-berry-500 border-berry-500',
  'bg-berry-100 border-berry-500',
  'bg-ink-200 border-ink-400',
  'bg-moss-300 border-moss-500',
  'bg-moss-500 border-moss-500',
] as const

export function PreferenceCards({
  dimensions,
  step,
  nextHref,
  backHref,
  optional = false,
}: {
  dimensions: DimensionOption[]
  step: string
  nextHref: string
  backHref: string | null
  optional?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, number | null>>(
    () => Object.fromEntries(dimensions.map((d) => [d.key, d.rating])),
  )

  const answered = useMemo(
    () => Object.values(values).filter((v) => v !== null).length,
    [values],
  )

  const setRating = useCallback((key: string, rating: number) => {
    setValues((prev) => ({ ...prev, [key]: prev[key] === rating ? null : rating }))
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    const payload = Object.entries(values).map(([dimensionKey, rating]) => ({ dimensionKey, rating }))
    const response = await fetch('/api/onboarding/preferences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preferences: payload, step }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error ?? 'We could not save that. Please try again.')
      setSaving(false)
      return
    }
    startTransition(() => {
      router.push(nextHref)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="rounded-card border border-ink-200 bg-white">
        <div className="hidden items-center justify-between gap-4 border-b border-ink-200 px-5 py-3 sm:flex">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
            How much does this matter?
          </span>
          <div className="flex items-center gap-1 text-[0.68rem] text-ink-500">
            <span className="w-16 text-right">Avoid</span>
            <span className="w-[140px]" aria-hidden="true" />
            <span className="w-16">Essential</span>
          </div>
        </div>

        <ul className="divide-y divide-ink-100">
          {dimensions.map((dimension) => (
            <li
              key={dimension.key}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{dimension.label}</p>
                {dimension.description && (
                  <p className="mt-0.5 text-sm text-ink-500">{dimension.description}</p>
                )}
              </div>

              <fieldset className="shrink-0">
                <legend className="sr-only">
                  How important is {dimension.label} when you travel?
                </legend>
                <div className="flex items-center gap-2 sm:gap-1.5">
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const selected = values[dimension.key] === rating
                    return (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setRating(dimension.key, rating)}
                        aria-pressed={selected}
                        title={RATING_LABELS[rating]!.long}
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-full transition-transform sm:h-9 sm:w-9',
                          'hover:scale-110 active:scale-95',
                        )}
                      >
                        <span className="sr-only">{RATING_LABELS[rating]!.long}</span>
                        <span
                          className={cn(
                            'block rounded-full border-2 transition-all',
                            selected
                              ? `h-6 w-6 ${DOT_TONES[rating - 1]}`
                              : 'h-3.5 w-3.5 border-ink-300 bg-white',
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </li>
          ))}
        </ul>
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-500" aria-live="polite">
          {answered} of {dimensions.length} answered
          {optional && answered === 0 && ' · you can skip this'}
        </p>
        <div className="flex gap-2">
          {backHref && (
            <Button variant="ghost" onClick={() => router.push(backHref)} type="button">
              Back
            </Button>
          )}
          <Button onClick={save} loading={saving || pending}>
            Continue
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-500 text-pretty">
        Anything you leave blank counts as neutral. Marking something as “avoid” genuinely counts
        against trips built around it.
      </p>
    </div>
  )
}
