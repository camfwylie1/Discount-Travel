'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Badge, Button, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface WishlistSuggestion {
  slug: string
  name: string
  kind: 'COUNTRY' | 'CITY' | 'EXPERIENCE'
}

const EXPERIENCE_IDEAS = [
  'Northern lights', 'Safari', 'Learn to surf', 'A cooking school',
  'A long-distance trek', 'Harvest season in a wine region', 'Diving certification',
  'A festival abroad', 'Ride a mountain pass', 'A sleeper train',
]

export function WishlistStep({
  suggestions,
  existing,
  nextHref,
  backHref,
}: {
  suggestions: WishlistSuggestion[]
  existing: { id: string; label: string }[]
  nextHref: string
  backHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState(existing)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labels = new Set(items.map((i) => i.label))

  async function add(label: string, kind: 'COUNTRY' | 'CITY' | 'EXPERIENCE', destinationSlug?: string) {
    if (labels.has(label) || busy) return
    setBusy(true)
    setError(null)
    const response = await fetch('/api/onboarding/wishlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label, kind, destinationSlug }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setError(data.error ?? 'We could not add that.')
      return
    }
    setItems((prev) => [...prev, { id: data.id, label }])
  }

  async function remove(id: string) {
    setBusy(true)
    await fetch('/api/onboarding/wishlist', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems((prev) => prev.filter((i) => i.id !== id))
    setBusy(false)
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-6 rounded-card border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-medium text-ink-800">On your list</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-100 px-3 py-1.5 text-sm text-terracotta-700 transition-colors hover:bg-terracotta-200"
                  aria-label={`Remove ${item.label} from your wishlist`}
                >
                  {item.label}
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <path d="M6.3 6.3a1 1 0 0 1 1.4 0L10 8.6l2.3-2.3a1 1 0 1 1 1.4 1.4L11.4 10l2.3 2.3a1 1 0 0 1-1.4 1.4L10 11.4l-2.3 2.3a1 1 0 0 1-1.4-1.4L8.6 10 6.3 7.7a1 1 0 0 1 0-1.4Z" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-card border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-medium text-ink-800">Countries and places</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s.slug}
              type="button"
              disabled={labels.has(s.name)}
              onClick={() => add(s.name, s.kind, s.slug)}
              className={cn(
                'rounded-full border px-3.5 py-2 text-sm transition-colors min-h-[40px]',
                labels.has(s.name)
                  ? 'cursor-default border-ink-200 bg-ink-100 text-ink-400'
                  : 'border-ink-300 bg-white text-ink-700 hover:border-terracotta-400 hover:text-terracotta-600',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-card border border-ink-200 bg-white p-5">
        <h2 className="text-sm font-medium text-ink-800">Bucket-list experiences</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXPERIENCE_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              disabled={labels.has(idea)}
              onClick={() => add(idea, 'EXPERIENCE')}
              className={cn(
                'rounded-full border px-3.5 py-2 text-sm transition-colors min-h-[40px]',
                labels.has(idea)
                  ? 'cursor-default border-ink-200 bg-ink-100 text-ink-400'
                  : 'border-ink-300 bg-white text-ink-700 hover:border-terracotta-400 hover:text-terracotta-600',
              )}
            >
              {idea}
            </button>
          ))}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const value = custom.trim()
            if (!value) return
            void add(value, 'EXPERIENCE')
            setCustom('')
          }}
        >
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Something else…"
            maxLength={80}
            aria-label="Add your own wishlist item"
          />
          <Button type="submit" variant="outline" disabled={!custom.trim() || busy}>
            Add
          </Button>
        </form>
      </section>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-6 flex items-center justify-between gap-4">
        <Badge variant="neutral">Optional — but it improves your recommendations</Badge>
        <div className="flex gap-2">
          {backHref && (
            <Button variant="ghost" type="button" onClick={() => router.push(backHref)}>
              Back
            </Button>
          )}
          <Button onClick={() => startTransition(() => router.push(nextHref))} loading={pending}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
