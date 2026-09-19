'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Badge, Button, Field, Input, Textarea } from '@/components/ui'
import { RadarChart } from '@/components/personality/RadarChart'

export interface PersonalityView {
  title: string
  description: string
  topInterests: string[]
  tripStyles: string[]
  destinationIdeas: string[]
  idealCompanions: string | null
  radar: Record<string, number>
  generatedBy: string
}

/**
 * THE REVEAL
 *
 * The payoff for finishing the quiz. It generates on mount if there is
 * nothing yet, and it is editable — this is the member's profile, not our
 * verdict on them.
 */
export function PersonalityReveal({
  initial,
  firstName,
}: {
  initial: PersonalityView | null
  firstName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [personality, setPersonality] = useState<PersonalityView | null>(initial)
  const [state, setState] = useState<'idle' | 'generating' | 'error'>(initial ? 'idle' : 'generating')
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    if (initial) return
    let cancelled = false
    void (async () => {
      const response = await fetch('/api/onboarding/personality', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await response.json().catch(() => ({}))
      if (cancelled) return
      if (!response.ok) {
        setState('error')
        setError(data.error ?? 'We could not build your profile just now.')
        return
      }
      setPersonality(data)
      setState('idle')
    })()
    return () => {
      cancelled = true
    }
  }, [initial])

  async function regenerate() {
    setState('generating')
    setError(null)
    const response = await fetch('/api/onboarding/personality', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: true }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setState('error')
      setError(data.error ?? 'We could not regenerate that.')
      return
    }
    setPersonality(data)
    setState('idle')
  }

  async function saveEdit(title: string, description: string) {
    const response = await fetch('/api/onboarding/personality', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? 'We could not save that.')
      return
    }
    setPersonality((prev) => (prev ? { ...prev, title, description } : prev))
    setEditing(false)
  }

  async function finish() {
    setFinishing(true)
    const response = await fetch('/api/onboarding/complete', { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error ?? 'We could not finish setting up your account.')
      setFinishing(false)
      return
    }
    startTransition(() => {
      router.push(data.next ?? '/discover')
      router.refresh()
    })
  }

  if (state === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-ink-200 border-t-terracotta-500" />
        </div>
        <p className="mt-6 text-lg" style={{ fontFamily: 'var(--font-display)' }}>
          Working out how you travel…
        </p>
        <p className="mt-1 text-sm text-ink-500">This takes a couple of seconds.</p>
      </div>
    )
  }

  if (state === 'error' || !personality) {
    return (
      <div className="py-10">
        <Alert tone="error" title="We could not build your profile">
          {error ?? 'Something went wrong.'}
        </Alert>
        <div className="mt-6 flex gap-2">
          <Button onClick={regenerate}>Try again</Button>
          <Button variant="outline" onClick={finish} loading={finishing}>
            Skip and go to my trips
          </Button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          void saveEdit(String(form.get('title') ?? ''), String(form.get('description') ?? ''))
        }}
      >
        <Field label="Title" htmlFor="title" required>
          <Input id="title" name="title" defaultValue={personality.title} maxLength={60} required />
        </Field>
        <Field label="Description" htmlFor="description" required>
          <Textarea
            id="description"
            name="description"
            defaultValue={personality.description}
            maxLength={1200}
            rows={5}
            required
          />
        </Field>
        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="animate-fade-up">
      <div className="overflow-hidden rounded-card border border-ink-200 bg-white shadow-card">
        <div className="bg-ink-900 px-6 py-8 text-center sm:px-10 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-terracotta-300">
            {firstName}, you are
          </p>
          <h2
            className="mt-3 text-3xl text-white text-balance sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {personality.title}
          </h2>
        </div>

        <div className="px-6 py-7 sm:px-10">
          <p className="text-lg leading-relaxed text-ink-700 text-pretty">
            {personality.description}
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                Your Travel DNA
              </h3>
              <div className="mt-3">
                <RadarChart values={personality.radar} size={300} />
              </div>
            </div>

            <div className="space-y-6">
              {personality.topInterests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                    What matters most to you
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {personality.topInterests.slice(0, 8).map((interest) => (
                      <Badge key={interest} variant="terracotta">{interest}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {personality.tripStyles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                    Trips that suit you
                  </h3>
                  <ul className="mt-2 space-y-1 text-[0.95rem] text-ink-700">
                    {personality.tripStyles.map((style) => (
                      <li key={style} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moss-500" />
                        {style}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {personality.destinationIdeas.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                    You might like
                  </h3>
                  <p className="mt-2 text-[0.95rem] text-ink-700">
                    {personality.destinationIdeas.join(' · ')}
                  </p>
                </div>
              )}

              {personality.idealCompanions && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
                    Who you would travel well with
                  </h3>
                  <p className="mt-2 text-[0.95rem] text-ink-700 text-pretty">
                    {personality.idealCompanions}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={finish} loading={finishing || pending}>
          See my trips
        </Button>
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit this
        </Button>
        <Button variant="ghost" onClick={regenerate}>
          Regenerate
        </Button>
      </div>

      <p className="mt-5 text-xs text-ink-500 text-pretty">
        This describes how you like to travel — it is not a psychological assessment, and it says
        nothing about you beyond your own answers.
        {personality.generatedBy === 'fallback' && (
          <> Written by our built-in profile writer rather than an AI model.</>
        )}
      </p>
    </div>
  )
}
