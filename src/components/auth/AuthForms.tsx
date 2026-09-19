'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { formatMoneyCompact } from '@/config/pricing'

interface ApiError {
  error: string
  fields?: Record<string, string>
  retryAfter?: number
}

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

// ── SIGN UP ─────────────────────────────────────────────────────────────────

export function SignupForm({ priceCents }: { priceCents: number }) {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setFields({})

    const form = new FormData(event.currentTarget)
    const result = await post('/api/auth/signup', {
      firstName: String(form.get('firstName') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      ageConfirmed: form.get('ageConfirmed') === 'on',
      termsAccepted: form.get('termsAccepted') === 'on',
      marketingOptIn: form.get('marketingOptIn') === 'on',
      referralCode: params.get('ref') ?? undefined,
    })

    if (!result.ok) {
      const body = result.data as ApiError
      setError(body.error ?? 'Something went wrong. Please try again.')
      setFields(body.fields ?? {})
      setLoading(false)
      return
    }
    router.push(result.data.next ?? '/onboarding')
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-display-md">Find your travel personality</h1>
      <p className="mt-2 text-ink-600 text-pretty">
        The quiz is free and takes about six minutes. Membership is{' '}
        {formatMoneyCompact(priceCents)} a year, and only when you want it.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}

        <Field label="First name" htmlFor="firstName" error={fields.firstName} required>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={40}
            aria-invalid={!!fields.firstName}
          />
        </Field>

        <Field label="Email address" htmlFor="email" error={fields.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-invalid={!!fields.email}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint="At least 10 characters, with a number or symbol."
          error={fields.password}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            aria-describedby="password-hint"
            aria-invalid={!!fields.password}
          />
        </Field>

        <div className="space-y-3 rounded-xl bg-sand-100 p-4">
          <label className="flex items-start gap-3 text-sm text-ink-700">
            <input
              type="checkbox"
              name="ageConfirmed"
              required
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
            />
            <span className="text-pretty">
              I confirm I am 18 or over.{' '}
              <span className="text-ink-500">Voyaj is an adults-only platform.</span>
            </span>
          </label>
          {fields.ageConfirmed && (
            <p role="alert" className="text-xs font-medium text-berry-500">{fields.ageConfirmed}</p>
          )}

          <label className="flex items-start gap-3 text-sm text-ink-700">
            <input
              type="checkbox"
              name="termsAccepted"
              required
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
            />
            <span className="text-pretty">
              I accept the{' '}
              <Link href="/legal/terms" className="underline underline-offset-2">terms of service</Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="underline underline-offset-2">privacy policy</Link>.
            </span>
          </label>
          {fields.termsAccepted && (
            <p role="alert" className="text-xs font-medium text-berry-500">{fields.termsAccepted}</p>
          )}

          <label className="flex items-start gap-3 text-sm text-ink-700">
            <input
              type="checkbox"
              name="marketingOptIn"
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-terracotta-500 focus:ring-terracotta-500"
            />
            <span className="text-pretty">
              Email me occasional trip ideas.{' '}
              <span className="text-ink-500">Optional, and you can stop any time.</span>
            </span>
          </label>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Start the quiz
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-terracotta-600 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}

// ── SIGN IN ─────────────────────────────────────────────────────────────────

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setFields({})

    const form = new FormData(event.currentTarget)
    const result = await post('/api/auth/login', {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    })

    if (!result.ok) {
      const body = result.data as ApiError
      setError(body.error ?? 'Something went wrong. Please try again.')
      setFields(body.fields ?? {})
      setLoading(false)
      return
    }
    router.push(next || result.data.next || '/discover')
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-display-md">Welcome back</h1>
      <p className="mt-2 text-ink-600">Sign in to see what is new for you.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {params.get('registered') === '1' && (
          <Alert tone="success">Your account is ready. Sign in to continue.</Alert>
        )}
        {params.get('reset') === '1' && (
          <Alert tone="success">Your password has been changed. Sign in with the new one.</Alert>
        )}

        <Field label="Email address" htmlFor="email" error={fields.email} required>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
        </Field>

        <Field label="Password" htmlFor="password" error={fields.password} required>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>

        <div className="flex justify-end">
          <Link href="/forgot" className="text-sm text-ink-600 underline underline-offset-4 hover:text-ink-900">
            Forgotten your password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-600">
        New here?{' '}
        <Link href="/signup" className="font-medium text-terracotta-600 underline underline-offset-4">
          Take the quiz
        </Link>
      </p>
    </div>
  )
}

// ── FORGOTTEN PASSWORD ──────────────────────────────────────────────────────

export function ForgotForm() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const result = await post('/api/auth/request-reset', { email: String(form.get('email') ?? '') })
    setLoading(false)
    if (!result.ok) {
      setError((result.data as ApiError).error ?? 'Something went wrong.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-display-md">Check your email</h1>
        <p className="mt-3 text-ink-600 text-pretty">
          If there is an account with that address, we have sent a link to reset the password. It
          expires in one hour.
        </p>
        <Alert tone="info" className="mt-6">
          Running locally? The reset link is printed in the terminal where{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">npm run dev</code> is running.
        </Alert>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-terracotta-600 underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-display-md">Reset your password</h1>
      <p className="mt-2 text-ink-600">We will email you a link to set a new one.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email address" htmlFor="email" required>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-ink-600 underline underline-offset-4">Back to sign in</Link>
      </p>
    </div>
  )
}

// ── SET A NEW PASSWORD ──────────────────────────────────────────────────────

export function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setFields({})
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    if (password !== String(form.get('confirm') ?? '')) {
      setFields({ confirm: 'The two passwords do not match.' })
      setLoading(false)
      return
    }
    const result = await post('/api/auth/reset', { token, password })
    if (!result.ok) {
      const body = result.data as ApiError
      setError(body.error ?? 'Something went wrong.')
      setFields(body.fields ?? {})
      setLoading(false)
      return
    }
    router.push('/login?reset=1')
  }

  if (!token) {
    return (
      <div>
        <h1 className="text-display-md">That link is not valid</h1>
        <p className="mt-3 text-ink-600 text-pretty">
          Reset links can only be used once and expire after an hour.
        </p>
        <Link href="/forgot" className="mt-6 inline-block font-medium text-terracotta-600 underline underline-offset-4">
          Request a new one
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-display-md">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="New password" htmlFor="password" hint="At least 10 characters." error={fields.password} required>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" error={fields.confirm} required>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Alert tone="info">Changing your password signs you out everywhere else.</Alert>
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Save new password
        </Button>
      </form>
    </div>
  )
}

// ── EMAIL VERIFICATION ──────────────────────────────────────────────────────

export function VerifyPanel() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function verify() {
    setState('working')
    const result = await post('/api/auth/verify', { token })
    if (!result.ok) {
      setState('error')
      setMessage((result.data as ApiError).error ?? 'That link is not valid.')
      return
    }
    setState('done')
  }

  if (!token) {
    return (
      <div>
        <h1 className="text-display-md">Check your email</h1>
        <p className="mt-3 text-ink-600 text-pretty">
          We have sent you a link to confirm your email address. You can carry on with the quiz in
          the meantime — you only need a confirmed address before messaging other travellers.
        </p>
        <Alert tone="info" className="mt-6">
          Running locally? The confirmation link is printed in the terminal where{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">npm run dev</code> is running.
        </Alert>
        <Link href="/onboarding" className="mt-6 inline-block font-medium text-terracotta-600 underline underline-offset-4">
          Continue to the quiz
        </Link>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div>
        <h1 className="text-display-md">Email confirmed</h1>
        <p className="mt-3 text-ink-600">You are all set.</p>
        <Link href="/discover" className="mt-6 inline-block font-medium text-terracotta-600 underline underline-offset-4">
          Go to your feed
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-display-md">Confirm your email</h1>
      {state === 'error' && <Alert tone="error" className="mt-5">{message}</Alert>}
      <p className="mt-3 text-ink-600">One tap and you are done.</p>
      <Button onClick={verify} size="lg" fullWidth className="mt-6" loading={state === 'working'}>
        Confirm my email address
      </Button>
    </div>
  )
}
