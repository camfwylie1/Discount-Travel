'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface ScenarioQuestionView {
  key: string
  prompt: string
  helpText: string | null
  options: { key: string; label: string; sublabel: string | null; imageUrl: string | null }[]
}

/**
 * THE SCENARIO QUIZ
 *
 * The opening of onboarding, and the moment the product has to feel like a
 * consumer app rather than a form. One question at a time, big visual
 * choices, instant advance on tap.
 */
export function ScenarioQuiz({
  questions,
  nextHref,
  backHref,
}: {
  questions: ScenarioQuestionView[]
  nextHref: string
  backHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const question = questions[index]
  const isLast = index === questions.length - 1

  function choose(optionKey: string) {
    if (!question) return
    const next = { ...answers, [question.key]: optionKey }
    setAnswers(next)
    if (!isLast) {
      // A short beat so the selection is visible before the screen changes.
      setTimeout(() => setIndex((i) => i + 1), 180)
    } else {
      void save(next)
    }
  }

  async function save(finalAnswers: Record<string, string>) {
    setSaving(true)
    setError(null)
    const response = await fetch('/api/onboarding/scenarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        answers: Object.entries(finalAnswers).map(([questionKey, optionKey]) => ({ questionKey, optionKey })),
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

  if (!question) {
    return (
      <Alert tone="warning">
        No scenario questions are set up yet. An administrator can add them in the admin portal.
      </Alert>
    )
  }

  const hasImages = question.options.some((o) => o.imageUrl)

  return (
    <div>
      {/* Question pips */}
      <div className="mb-6 flex items-center gap-1.5" role="group" aria-label="Question progress">
        {questions.map((q, i) => (
          <span
            key={q.key}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < index ? 'bg-terracotta-500' : i === index ? 'bg-terracotta-300' : 'bg-ink-200',
            )}
          />
        ))}
      </div>

      <h2 className="text-display-md text-balance">{question.prompt}</h2>
      {question.helpText && <p className="mt-2 text-ink-600">{question.helpText}</p>}

      <div
        className={cn(
          'mt-7 grid gap-3',
          hasImages ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {question.options.map((option) => {
          const selected = answers[question.key] === option.key
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => choose(option.key)}
              aria-pressed={selected}
              className={cn(
                'group relative overflow-hidden rounded-card border text-left transition-all duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-500',
                selected
                  ? 'border-terracotta-500 ring-2 ring-terracotta-500/30'
                  : 'border-ink-200 hover:border-ink-400 hover:shadow-card-hover',
              )}
            >
              {option.imageUrl && (
                <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                  <Image
                    src={option.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/50 to-transparent" />
                </div>
              )}
              <div className={cn('bg-white p-4', option.imageUrl && 'relative')}>
                <p className="font-medium text-ink-900">{option.label}</p>
                {option.sublabel && (
                  <p className="mt-0.5 text-sm text-ink-500 text-pretty">{option.sublabel}</p>
                )}
              </div>
              {selected && (
                <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-terracotta-500 text-white shadow">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && <Alert tone="error" className="mt-4">{error}</Alert>}

      <div className="mt-7 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          type="button"
          onClick={() => (index > 0 ? setIndex((i) => i - 1) : backHref && router.push(backHref))}
          disabled={index === 0 && !backHref}
        >
          Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-500">
            {index + 1} of {questions.length}
          </span>
          {isLast ? (
            <Button
              onClick={() => save(answers)}
              loading={saving || pending}
              disabled={!answers[question.key]}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="outline"
              type="button"
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              Skip
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
