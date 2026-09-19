'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

export function JoinTripButton({
  tripId,
  state,
}: {
  tripId: string
  state: string | null
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(state)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(action: 'JOIN' | 'INTERESTED' | 'CONFIRM' | 'LEAVE' | 'DECLINE') {
    setBusy(action)
    setError(null)
    const response = await fetch('/api/trips/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tripId, action }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) {
      setError(data.error ?? 'That did not work.')
      return
    }
    setCurrent(data.state)
    router.refresh()
  }

  if (current === 'CONFIRMED') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-moss-700">You are in</span>
        <Button size="sm" variant="ghost" onClick={() => act('LEAVE')} loading={busy === 'LEAVE'}>
          Leave this trip
        </Button>
        {error && <p className="text-xs text-berry-500">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act('CONFIRM')} loading={busy === 'CONFIRM'}>
          {current === 'INTERESTED' ? 'I’m in' : 'Join this trip'}
        </Button>
        {current !== 'INTERESTED' && (
          <Button variant="outline" onClick={() => act('INTERESTED')} loading={busy === 'INTERESTED'}>
            Interested
          </Button>
        )}
        {current === 'INVITED' && (
          <Button variant="ghost" onClick={() => act('DECLINE')} loading={busy === 'DECLINE'}>
            Not for me
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-berry-500">{error}</p>}
    </div>
  )
}

export function TripVoting({
  tripId,
  kind,
  options,
  myVote,
  tally,
}: {
  tripId: string
  kind: 'DATE_WINDOW' | 'AIRPORT'
  options: { key: string; label: string }[]
  myVote: string | null
  tally: Record<string, number>
}) {
  const router = useRouter()
  const [voted, setVoted] = useState(myVote)
  const [counts, setCounts] = useState(tally)
  const [busy, setBusy] = useState<string | null>(null)

  async function vote(optionKey: string) {
    setBusy(optionKey)
    const response = await fetch('/api/trips/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tripId, kind, optionKey, value: 1 }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (response.ok) {
      setVoted(optionKey)
      const next: Record<string, number> = {}
      for (const row of data.tally ?? []) next[row.optionKey] = row.score
      setCounts(next)
      router.refresh()
    }
  }

  const max = Math.max(1, ...Object.values(counts))

  return (
    <ul className="space-y-2">
      {options.map((option) => {
        const score = counts[option.key] ?? 0
        const mine = voted === option.key
        return (
          <li key={option.key}>
            <button
              type="button"
              onClick={() => vote(option.key)}
              disabled={busy !== null}
              aria-pressed={mine}
              className={cn(
                'relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors',
                mine ? 'border-terracotta-500 bg-terracotta-50' : 'border-ink-200 bg-white hover:border-ink-400',
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-terracotta-100/70"
                style={{ width: `${(score / max) * 100}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-sm tabular-nums text-ink-500">
                  {score} {score === 1 ? 'vote' : 'votes'}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function CreateTripForm({
  dealId,
  dealTitle,
  connections,
}: {
  dealId?: string
  dealTitle?: string
  connections: { id: string; firstName: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invited, setInvited] = useState<string[]>([])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/trips/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') ?? '') || undefined,
        dealId,
        inviteUserIds: invited,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? 'We could not create that trip.')
      return
    }
    router.push(`/trips/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="What are you calling it?" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          required
          maxLength={80}
          defaultValue={dealTitle ? `${dealTitle.split(':')[0]}` : ''}
          placeholder="Costa Rica — February"
        />
      </Field>
      <Field label="Anything to add?" htmlFor="description" hint="Optional — dates, budget, who it is for.">
        <Textarea id="description" name="description" maxLength={1000} rows={3} />
      </Field>

      {connections.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-800">Invite people</legend>
          <div className="flex flex-wrap gap-2">
            {connections.map((person) => {
              const selected = invited.includes(person.id)
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() =>
                    setInvited((prev) =>
                      prev.includes(person.id) ? prev.filter((id) => id !== person.id) : [...prev, person.id],
                    )
                  }
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3.5 py-2 text-sm transition-colors',
                    selected
                      ? 'border-terracotta-500 bg-terracotta-500 text-white'
                      : 'border-ink-300 bg-white text-ink-700 hover:border-ink-500',
                  )}
                >
                  {person.firstName}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <Alert tone="info">
        Voyaj does not book the trip. This is a place to plan it together and agree on the details.
      </Alert>

      <Button type="submit" size="lg" loading={busy}>
        Create the trip
      </Button>
    </form>
  )
}
