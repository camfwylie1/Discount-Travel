'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { formatMoneyCompact } from '@/config/pricing'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DURATION_PRESETS = [
  { label: 'Long weekend', min: 2, max: 3, preferred: 3 },
  { label: '4–6 nights', min: 4, max: 6, preferred: 5 },
  { label: 'About a week', min: 6, max: 8, preferred: 7 },
  { label: '8–10 nights', min: 8, max: 10, preferred: 9 },
  { label: '11–14 nights', min: 11, max: 14, preferred: 12 },
  { label: '15–21 nights', min: 15, max: 21, preferred: 18 },
  { label: '3–4 weeks', min: 22, max: 30, preferred: 25 },
]

export function BudgetStep({
  initial,
  nextHref,
  backHref,
}: {
  initial: {
    budgetPreferred: number | null
    budgetMax: number | null
    budgetMaxIsHard: boolean
    durationMin: number | null
    durationMax: number | null
    durationPreferred: number | null
    durationIsHard: boolean
    preferredMonths: number[]
    partySize: number
    dateFlexibilityDays: number
  }
  nextHref: string
  backHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})

  const [preferred, setPreferred] = useState(
    initial.budgetPreferred ? String(Math.round(initial.budgetPreferred / 100)) : '',
  )
  const [max, setMax] = useState(initial.budgetMax ? String(Math.round(initial.budgetMax / 100)) : '')
  const [budgetHard, setBudgetHard] = useState(initial.budgetMaxIsHard)
  const [durationHard, setDurationHard] = useState(initial.durationIsHard)
  const [months, setMonths] = useState<number[]>(initial.preferredMonths ?? [])
  const [partySize, setPartySize] = useState(String(initial.partySize ?? 1))
  const [flexibility, setFlexibility] = useState(String(initial.dateFlexibilityDays ?? 7))
  const [duration, setDuration] = useState(() => {
    const match = DURATION_PRESETS.find(
      (p) => p.min === initial.durationMin && p.max === initial.durationMax,
    )
    return match?.label ?? (initial.durationMin ? 'custom' : 'About a week')
  })

  function toggleMonth(month: number) {
    setMonths((prev) => (prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]))
  }

  async function save() {
    setSaving(true)
    setError(null)
    setFields({})

    const preferredCents = preferred ? Math.round(Number(preferred) * 100) : null
    const maxCents = max ? Math.round(Number(max) * 100) : null

    if (preferredCents !== null && maxCents !== null && preferredCents > maxCents) {
      setFields({ budgetPreferred: 'This is above your maximum.' })
      setSaving(false)
      return
    }

    const preset = DURATION_PRESETS.find((p) => p.label === duration)

    const response = await fetch('/api/onboarding/constraints', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        budgetPreferred: preferredCents,
        budgetMax: maxCents,
        budgetMaxIsHard: budgetHard,
        durationMin: preset?.min ?? null,
        durationMax: preset?.max ?? null,
        durationPreferred: preset?.preferred ?? null,
        durationIsHard: durationHard,
        preferredMonths: months,
        partySize: Number(partySize) || 1,
        dateFlexibilityDays: Number(flexibility) || 7,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error ?? 'We could not save that.')
      setFields(body.fields ?? {})
      setSaving(false)
      return
    }
    startTransition(() => {
      router.push(nextHref)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {/* ── Budget ── */}
      <section className="rounded-card border border-ink-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Budget per person</h2>
        <p className="mt-1 text-sm text-ink-600 text-pretty">
          Roughly what a trip costs you, flights included. In {formatMoneyCompact(0).replace(/[\d.,]/g, '').trim() || 'CAD'}.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="What you usually spend" htmlFor="budgetPreferred" error={fields.budgetPreferred}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">$</span>
              <Input
                id="budgetPreferred"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={preferred}
                onChange={(e) => setPreferred(e.target.value)}
                className="pl-7"
                placeholder="2000"
              />
            </div>
          </Field>
          <Field label="The most you would spend" htmlFor="budgetMax" error={fields.budgetMax}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">$</span>
              <Input
                id="budgetMax"
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className="pl-7"
                placeholder="2600"
              />
            </div>
          </Field>
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-xl bg-sand-100 p-3 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={budgetHard}
            onChange={(e) => setBudgetHard(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
          />
          <span className="text-pretty">
            That maximum is a <strong className="font-semibold">hard limit</strong>.{' '}
            <span className="text-ink-500">
              We will hide anything above it. Leave this off and we will still show dearer trips,
              just lower down.
            </span>
          </span>
        </label>
      </section>

      {/* ── Trip length ── */}
      <section className="rounded-card border border-ink-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How long do you go for?</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDuration(preset.label)}
              aria-pressed={duration === preset.label}
              className={cn(
                'rounded-full border px-4 py-2.5 text-sm transition-colors min-h-[44px] sm:min-h-0 sm:py-2',
                duration === preset.label
                  ? 'border-terracotta-500 bg-terracotta-500 text-white'
                  : 'border-ink-300 bg-white text-ink-700 hover:border-ink-400',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-3 rounded-xl bg-sand-100 p-3 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={durationHard}
            onChange={(e) => setDurationHard(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
          />
          <span className="text-pretty">
            I genuinely cannot travel for longer or shorter than that.
          </span>
        </label>
      </section>

      {/* ── When ── */}
      <section className="rounded-card border border-ink-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold">When can you travel?</h2>
        <p className="mt-1 text-sm text-ink-600">Pick any months that work. Leave blank if you are flexible.</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {MONTHS.map((name, i) => {
            const month = i + 1
            const active = months.includes(month)
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleMonth(month)}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border px-2 py-2.5 text-sm transition-colors min-h-[44px] sm:min-h-0',
                  active
                    ? 'border-ocean-500 bg-ocean-500 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-ink-400',
                )}
              >
                {name.slice(0, 3)}
              </button>
            )
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Date flexibility" htmlFor="flexibility" hint="How far either side of your dates you would consider.">
            <Select id="flexibility" value={flexibility} onChange={(e) => setFlexibility(e.target.value)}>
              <option value="0">Exact dates only</option>
              <option value="3">Give or take 3 days</option>
              <option value="7">Give or take a week</option>
              <option value="14">Give or take two weeks</option>
              <option value="30">Very flexible</option>
            </Select>
          </Field>
          <Field label="Who is travelling" htmlFor="partySize" hint="Used for per-person pricing.">
            <Select id="partySize" value={partySize} onChange={(e) => setPartySize(e.target.value)}>
              <option value="1">Just me</option>
              <option value="2">Two of us</option>
              <option value="3">Three</option>
              <option value="4">Four</option>
              <option value="6">Five or six</option>
              <option value="8">A bigger group</option>
            </Select>
          </Field>
        </div>
      </section>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-500 text-pretty">
          Hard limits remove trips. Everything else just changes the order.
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
