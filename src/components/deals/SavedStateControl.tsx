'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Select } from '@/components/ui'

const STATES = [
  { value: 'SAVED', label: 'Saved' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'BOOKED', label: 'I booked this' },
  { value: 'PAST', label: 'Past trip' },
] as const

/**
 * Lets a member move a trip through their own pipeline. "I booked this" is
 * explicitly self-reported — the label says so, and the database records it
 * as `selfReportedBooking`, because Voyaj never processed a booking.
 */
export function SavedStateControl({ dealId, state }: { dealId: string; state: string }) {
  const router = useRouter()
  const [current, setCurrent] = useState(state)
  const [busy, setBusy] = useState(false)

  async function change(next: string) {
    setBusy(true)
    setCurrent(next)
    const response = await fetch('/api/deals/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dealId, state: next }),
    })
    if (!response.ok) setCurrent(state)
    setBusy(false)
    router.refresh()
  }

  return (
    <div>
      <label htmlFor={`state-${dealId}`} className="sr-only">
        Change the status of this saved trip
      </label>
      <Select
        id={`state-${dealId}`}
        value={current}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        className="text-sm"
      >
        {STATES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </Select>
    </div>
  )
}
