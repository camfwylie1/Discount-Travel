'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { Avatar } from '@/components/layout/AppNav'
import { cn } from '@/lib/utils'

const SUGGESTIONS = ['Hiking Crew', 'Europe Friends', 'Ski Friends', 'Food & Wine', 'Weekend Trips']

export function CreateCircleForm({
  connections,
}: {
  connections: { id: string; firstName: string; photoThumbUrl: string | null }[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await fetch('/api/social/circles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), memberIds: selected }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? 'We could not create that circle.')
      return
    }
    setName('')
    setSelected([])
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <Field label="What do you want to call it?" htmlFor="circle-name" required>
        <Input
          id="circle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          placeholder="Hiking Crew"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setName(suggestion)}
            className="rounded-full border border-ink-300 px-3 py-1.5 text-xs text-ink-600 hover:border-ink-500"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">Who is in it?</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {connections.map((person) => {
            const active = selected.includes(person.id)
            return (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(person.id) ? prev.filter((id) => id !== person.id) : [...prev, person.id],
                    )
                  }
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    active ? 'border-terracotta-500 bg-terracotta-50' : 'border-ink-200 hover:border-ink-400',
                  )}
                >
                  <Avatar url={person.photoThumbUrl} name={person.firstName} size={28} />
                  <span className="text-sm font-medium">{person.firstName}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <Button type="submit" disabled={!name.trim()} loading={busy}>
        Create circle
      </Button>
    </form>
  )
}
