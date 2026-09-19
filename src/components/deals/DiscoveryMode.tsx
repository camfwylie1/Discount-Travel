'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Select } from '@/components/ui'

/**
 * DISCOVERY MODE
 *
 * "I want to travel, but I don't know where." Constraints in, personality-
 * ranked destinations out. This is meant to be one of the strongest moments
 * in the product, so it sits at the top of the feed rather than buried in
 * search.
 */

const BUDGETS = [
  { value: '', label: 'Any budget' },
  { value: '100000', label: 'Under $1,000' },
  { value: '150000', label: 'Under $1,500' },
  { value: '200000', label: 'Under $2,000' },
  { value: '300000', label: 'Under $3,000' },
  { value: '500000', label: 'Under $5,000' },
]

const DURATIONS = [
  { value: '', label: 'Any length' },
  { value: 'weekend', label: 'A weekend' },
  { value: '4-6', label: '4–6 nights' },
  { value: '7', label: 'About a week' },
  { value: '8-10', label: '8–10 nights' },
  { value: '11-14', label: '11–14 nights' },
  { value: '15-21', label: '2–3 weeks' },
]

const MONTHS = [
  { value: '', label: 'Any time' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2025, i, 1).toLocaleString('en-CA', { month: 'long' }),
  })),
]

export function DiscoveryMode({ airports = [] }: { airports?: { iata: string; city: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [budget, setBudget] = useState('')
  const [duration, setDuration] = useState('')
  const [month, setMonth] = useState('')
  const [airport, setAirport] = useState('')

  function search() {
    const params = new URLSearchParams({ mode: 'discovery', sort: 'match' })
    if (budget) params.set('maxPrice', budget)
    if (duration) params.set('durationBucket', duration)
    if (month) params.set('months', month)
    if (airport) params.set('airports', airport)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <section className="overflow-hidden rounded-card border border-ocean-200 bg-ocean-50">
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ocean-800">
              Not sure where you want to go?
            </h2>
            <p className="mt-0.5 text-sm text-ocean-700 text-pretty">
              Tell us the budget, the dates and how long. We will work out where.
            </p>
          </div>
          {!open && (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Find me somewhere
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ocean-800">Budget</span>
                <Select value={budget} onChange={(e) => setBudget(e.target.value)} className="bg-white">
                  {BUDGETS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ocean-800">How long</span>
                <Select value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-white">
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ocean-800">When</span>
                <Select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-white">
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ocean-800">Leaving from</span>
                <Select value={airport} onChange={(e) => setAirport(e.target.value)} className="bg-white">
                  <option value="">My usual airports</option>
                  {airports.map((a) => (
                    <option key={a.iata} value={a.iata}>
                      {a.city} ({a.iata})
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={search}>
                Show me where to go
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
