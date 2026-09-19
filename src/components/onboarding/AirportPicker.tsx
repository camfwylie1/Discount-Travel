'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface AirportOption {
  iata: string
  name: string
  city: string
  region: string | null
  isGateway: boolean
}

export function AirportPicker({
  gateways,
  secondary,
  selected: initialSelected,
  airportsAreHard: initialHard,
  includeNearby: initialNearby,
  nextHref,
  backHref,
}: {
  gateways: AirportOption[]
  secondary: AirportOption[]
  selected: string[]
  airportsAreHard: boolean
  includeNearby: boolean
  nextHref: string
  backHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [hard, setHard] = useState(initialHard)
  const [nearby, setNearby] = useState(initialNearby)
  const [showMore, setShowMore] = useState(
    initialSelected.some((iata) => secondary.some((s) => s.iata === iata)),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(iata: string) {
    setSelected((prev) =>
      prev.includes(iata) ? prev.filter((x) => x !== iata) : prev.length >= 8 ? prev : [...prev, iata],
    )
  }

  async function save() {
    if (selected.length === 0) {
      setError('Choose at least one airport so we know where you are flying from.')
      return
    }
    setSaving(true)
    setError(null)
    const [airportsResponse, constraintsResponse] = await Promise.all([
      fetch('/api/onboarding/airports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iatas: selected }),
      }),
      fetch('/api/onboarding/constraints', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ airportsAreHard: hard, includeNearbyAirports: nearby }),
      }),
    ])
    if (!airportsResponse.ok || !constraintsResponse.ok) {
      setError('We could not save that. Please try again.')
      setSaving(false)
      return
    }
    startTransition(() => {
      router.push(nextHref)
      router.refresh()
    })
  }

  const renderCard = (airport: AirportOption) => {
    const isSelected = selected.includes(airport.iata)
    const order = selected.indexOf(airport.iata)
    return (
      <button
        key={airport.iata}
        type="button"
        onClick={() => toggle(airport.iata)}
        aria-pressed={isSelected}
        className={cn(
          'relative rounded-xl border p-4 text-left transition-all',
          isSelected
            ? 'border-terracotta-500 bg-terracotta-50 ring-1 ring-terracotta-500/25'
            : 'border-ink-200 bg-white hover:border-ink-400',
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-semibold tabular-nums">{airport.iata}</span>
          <span className="truncate text-sm text-ink-600">{airport.city}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-500">{airport.name}</p>
        {isSelected && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-terracotta-500 text-[0.65rem] font-bold text-white">
            {order + 1}
          </span>
        )}
      </button>
    )
  }

  return (
    <div>
      <fieldset>
        <legend className="text-sm font-medium text-ink-800">Main Canadian gateways</legend>
        <p className="mt-1 text-sm text-ink-500">
          Tap in order of preference — your first choice scores highest.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{gateways.map(renderCard)}</div>
      </fieldset>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-sm font-medium text-terracotta-600 underline underline-offset-4"
          aria-expanded={showMore}
        >
          {showMore ? 'Hide other airports' : `Show ${secondary.length} more airports`}
        </button>
        {showMore && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{secondary.map(renderCard)}</div>
        )}
      </div>

      <div className="mt-7 space-y-3 rounded-xl bg-sand-100 p-4">
        <label className="flex items-start gap-3 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={nearby}
            onChange={(e) => setNearby(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
          />
          <span className="text-pretty">
            Also show trips from nearby airports.{' '}
            <span className="text-ink-500">
              For example, Hamilton and Billy Bishop if you have chosen Toronto Pearson.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={hard}
            onChange={(e) => setHard(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
          />
          <span className="text-pretty">
            I can <strong className="font-semibold">only</strong> depart from these airports.{' '}
            <span className="text-ink-500">
              This is a hard limit — we will hide trips from anywhere else rather than just
              ranking them lower.
            </span>
          </span>
        </label>
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-500" aria-live="polite">
          {selected.length === 0 ? 'None chosen yet' : `${selected.join(', ')}`}
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
