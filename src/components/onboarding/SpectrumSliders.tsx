'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button } from '@/components/ui'

export interface SpectrumOption {
  key: string
  label: string
  lowLabel: string
  highLabel: string
  value: number | null
}

/**
 * The nine spectrum questions. A real slider is right here — these genuinely
 * are continuous, and the two ends are both legitimate rather than one being
 * "more" of something.
 */
export function SpectrumSliders({
  spectrums,
  step,
  nextHref,
  backHref,
}: {
  spectrums: SpectrumOption[]
  step: string
  nextHref: string
  backHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, number>>(
    () => Object.fromEntries(spectrums.map((s) => [s.key, s.value ?? 50])),
  )
  const [touched, setTouched] = useState<Set<string>>(
    () => new Set(spectrums.filter((s) => s.value !== null).map((s) => s.key)),
  )

  async function save() {
    setSaving(true)
    setError(null)
    const response = await fetch('/api/onboarding/preferences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        preferences: spectrums.map((s) => ({ dimensionKey: s.key, spectrum: values[s.key] ?? 50 })),
        step,
      }),
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
      <div className="space-y-7 rounded-card border border-ink-200 bg-white p-5 sm:p-7">
        {spectrums.map((spectrum) => {
          const value = values[spectrum.key] ?? 50
          const isTouched = touched.has(spectrum.key)
          return (
            <div key={spectrum.key}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`spectrum-${spectrum.key}`} className="text-sm font-medium text-ink-800">
                  {spectrum.label}
                </label>
                <span className="text-xs text-ink-400">
                  {isTouched ? `${value}` : 'not set'}
                </span>
              </div>
              <input
                id={`spectrum-${spectrum.key}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={value}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setValues((prev) => ({ ...prev, [spectrum.key]: next }))
                  setTouched((prev) => new Set(prev).add(spectrum.key))
                }}
                aria-describedby={`spectrum-${spectrum.key}-labels`}
                className="mt-3 h-11 w-full cursor-pointer appearance-none bg-transparent
                  [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full
                  [&::-webkit-slider-runnable-track]:bg-gradient-to-r
                  [&::-webkit-slider-runnable-track]:from-ocean-300 [&::-webkit-slider-runnable-track]:to-terracotta-400
                  [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                  [&::-webkit-slider-thumb]:bg-ink-900 [&::-webkit-slider-thumb]:shadow-md
                  [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-ink-200
                  [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-ink-900"
              />
              <div
                id={`spectrum-${spectrum.key}-labels`}
                className="flex justify-between text-xs text-ink-500"
              >
                <span>{spectrum.lowLabel}</span>
                <span>{spectrum.highLabel}</span>
              </div>
            </div>
          )
        })}
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-500" aria-live="polite">
          {touched.size} of {spectrums.length} set
        </p>
        <div className="flex gap-2">
          {backHref && (
            <Button variant="ghost" type="button" onClick={() => router.push(backHref)}>
              Back
            </Button>
          )}
          <Button onClick={save} loading={saving || pending}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
