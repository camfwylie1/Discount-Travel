'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

async function send(url: string, body: unknown, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

// ── PROFILE ─────────────────────────────────────────────────────────────────

export function ProfileForm({
  initial,
}: {
  initial: {
    firstName: string
    lastInitial: string | null
    headline: string | null
    bio: string | null
    homeCity: string | null
    homeRegion: string | null
    ageRange: string | null
    travelPace: string
  }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [generating, setGenerating] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const result = await send('/api/profile/update', {
      firstName: String(form.get('firstName') ?? ''),
      lastInitial: String(form.get('lastInitial') ?? '') || undefined,
      headline: String(form.get('headline') ?? '') || undefined,
      bio: bio || undefined,
      homeCity: String(form.get('homeCity') ?? '') || undefined,
      homeRegion: String(form.get('homeRegion') ?? '') || undefined,
      ageRange: String(form.get('ageRange') ?? '') || undefined,
      travelPace: String(form.get('travelPace') ?? '') || undefined,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.data.error ?? 'We could not save that.')
      return
    }
    setMessage('Saved.')
    router.refresh()
  }

  async function suggestBio() {
    setGenerating(true)
    setError(null)
    const result = await send('/api/profile/update', undefined, 'PUT')
    setGenerating(false)
    if (!result.ok) {
      setError(result.data.error ?? 'We could not write a bio just now.')
      return
    }
    setBio(result.data.bio)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required>
          <Input id="firstName" name="firstName" defaultValue={initial.firstName} required maxLength={40} />
        </Field>
        <Field label="Last initial" htmlFor="lastInitial" hint="Optional. Other members see this.">
          <Input id="lastInitial" name="lastInitial" defaultValue={initial.lastInitial ?? ''} maxLength={2} />
        </Field>
      </div>

      <Field label="One line about how you travel" htmlFor="headline" hint="Shown on your traveller card.">
        <Input
          id="headline"
          name="headline"
          defaultValue={initial.headline ?? ''}
          maxLength={90}
          placeholder="Hiking, food and a good bottle of wine"
        />
      </Field>

      <Field label="About you" htmlFor="bio" hint="Optional, up to 600 characters.">
        <Textarea id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} rows={4} />
        <button
          type="button"
          onClick={suggestBio}
          disabled={generating}
          className="mt-2 text-sm text-terracotta-600 underline underline-offset-4 disabled:opacity-50"
        >
          {generating ? 'Writing…' : 'Suggest one based on my travel personality'}
        </button>
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Home city" htmlFor="homeCity">
          <Input id="homeCity" name="homeCity" defaultValue={initial.homeCity ?? ''} maxLength={80} />
        </Field>
        <Field label="Province" htmlFor="homeRegion">
          <Input id="homeRegion" name="homeRegion" defaultValue={initial.homeRegion ?? ''} maxLength={60} />
        </Field>
        <Field label="Age range" htmlFor="ageRange" hint="Never your exact age.">
          <Select id="ageRange" name="ageRange" defaultValue={initial.ageRange ?? ''}>
            <option value="">Prefer not to say</option>
            {['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Your travel pace" htmlFor="travelPace">
        <Select id="travelPace" name="travelPace" defaultValue={initial.travelPace}>
          <option value="VERY_RELAXED">Very relaxed</option>
          <option value="RELAXED">Relaxed</option>
          <option value="BALANCED">Balanced</option>
          <option value="ACTIVE">Active</option>
          <option value="PACKED">Packed</option>
        </Select>
      </Field>

      <Button type="submit" loading={busy}>Save changes</Button>
    </form>
  )
}

// ── PRIVACY ─────────────────────────────────────────────────────────────────

const VISIBILITY_FIELDS = [
  { key: 'profileVisibility', label: 'Your profile', hint: 'Bio, interests and travel personality.' },
  { key: 'photoVisibility', label: 'Your photo', hint: '' },
  { key: 'ageVisibility', label: 'Your age range', hint: '' },
  { key: 'cityVisibility', label: 'Your home city', hint: '' },
  { key: 'wishlistVisibility', label: 'Your wishlist', hint: '' },
  { key: 'savedDealsVisibility', label: 'Your saved trips', hint: '' },
  {
    key: 'upcomingTripVisibility',
    label: 'Your upcoming travel',
    hint: 'We recommend keeping this private. It is private by default.',
  },
] as const

export function PrivacyForm({ initial }: { initial: Record<string, unknown> }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, unknown>>(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(changes: Record<string, unknown>) {
    const previous = values
    setValues({ ...values, ...changes })
    setBusy(true)
    setMessage(null)
    const result = await send('/api/profile/privacy', changes)
    setBusy(false)
    if (result.ok) {
      setMessage('Saved.')
      router.refresh()
    } else {
      setValues(previous)
    }
  }

  return (
    <div className="space-y-8">
      {message && <Alert tone="success">{message}</Alert>}

      <section>
        <h2 className="text-lg font-semibold">Who can see what</h2>
        <ul className="mt-4 divide-y divide-ink-100 rounded-card border border-ink-200 bg-white">
          {VISIBILITY_FIELDS.map((field) => (
            <li key={field.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <label htmlFor={field.key} className="font-medium text-ink-800">{field.label}</label>
                {field.hint && <p className="text-xs text-ink-500 text-pretty">{field.hint}</p>}
              </div>
              <Select
                id={field.key}
                value={String(values[field.key] ?? 'CONNECTIONS')}
                disabled={busy}
                onChange={(e) => save({ [field.key]: e.target.value })}
                className="w-44"
              >
                <option value="PUBLIC">Anyone on Voyaj</option>
                <option value="CONNECTIONS">My connections</option>
                <option value="PRIVATE">Only me</option>
              </Select>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Being found</h2>
        <ul className="mt-4 divide-y divide-ink-100 rounded-card border border-ink-200 bg-white">
          <Toggle
            id="discoverable"
            label="Show me in traveller matching"
            hint="Turn this off and you will not appear in anyone's matches."
            checked={!!values.discoverable}
            disabled={busy}
            onChange={(checked) => save({ discoverable: checked })}
          />
          <Toggle
            id="indexableBySearchEngines"
            label="Let search engines index my profile"
            hint="Off by default. We strongly recommend leaving it off."
            checked={!!values.indexableBySearchEngines}
            disabled={busy}
            onChange={(checked) => save({ indexableBySearchEngines: checked })}
          />
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <label htmlFor="whoCanMessage" className="font-medium text-ink-800">Who can message me</label>
            <Select
              id="whoCanMessage"
              value={String(values.whoCanMessage ?? 'CONNECTIONS')}
              disabled={busy}
              onChange={(e) => save({ whoCanMessage: e.target.value })}
              className="w-44"
            >
              <option value="ANYONE">Anyone</option>
              <option value="CONNECTIONS">My connections</option>
              <option value="NOBODY">Nobody</option>
            </Select>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <label htmlFor="whoCanInviteToTrips" className="font-medium text-ink-800">
              Who can invite me to trips
            </label>
            <Select
              id="whoCanInviteToTrips"
              value={String(values.whoCanInviteToTrips ?? 'CONNECTIONS')}
              disabled={busy}
              onChange={(e) => save({ whoCanInviteToTrips: e.target.value })}
              className="w-44"
            >
              <option value="ANYONE">Anyone</option>
              <option value="CONNECTIONS">My connections</option>
              <option value="NOBODY">Nobody</option>
            </Select>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Community preferences</h2>
        <p className="mt-1 text-sm text-ink-600 text-pretty">
          Entirely optional, and off unless you turn them on. Voyaj never infers any of this about
          you, and nothing here is shown on your public profile.
        </p>
        <ul className="mt-4 divide-y divide-ink-100 rounded-card border border-ink-200 bg-white">
          <Toggle
            id="optInWomenOnlySpaces"
            label="Include me in women-only travel groups"
            hint="You are telling us this yourself — we never assume it."
            checked={!!values.optInWomenOnlySpaces}
            disabled={busy}
            onChange={(checked) => save({ optInWomenOnlySpaces: checked })}
          />
          <Toggle
            id="optInLgbtqSpaces"
            label="Include me in LGBTQ+ friendly spaces"
            hint="Opt-in only, and never shown publicly."
            checked={!!values.optInLgbtqSpaces}
            disabled={busy}
            onChange={(checked) => save({ optInLgbtqSpaces: checked })}
          />
          <Toggle
            id="optInSoloTravellers"
            label="Match me with other solo travellers"
            checked={!!values.optInSoloTravellers}
            disabled={busy}
            onChange={(checked) => save({ optInSoloTravellers: checked })}
          />
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Data</h2>
        <ul className="mt-4 divide-y divide-ink-100 rounded-card border border-ink-200 bg-white">
          <Toggle
            id="consentAnalytics"
            label="Allow product analytics"
            hint="Helps us see which features are actually used. Never sold, never shared."
            checked={!!values.consentAnalytics}
            disabled={busy}
            onChange={(checked) => save({ consentAnalytics: checked })}
          />
          <Toggle
            id="consentPersonalisation"
            label="Use my activity to improve my recommendations"
            hint="What you save, share and skip. Turn this off and we will only use your quiz answers."
            checked={!!values.consentPersonalisation}
            disabled={busy}
            onChange={(checked) => save({ consentPersonalisation: checked })}
          />
        </ul>
      </section>
    </div>
  )
}

function Toggle({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium text-ink-800">{label}</label>
        {hint && <p className="mt-0.5 text-xs text-ink-500 text-pretty">{hint}</p>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-moss-500' : 'bg-ink-300',
        )}
      >
        <span className="sr-only">{label}</span>
        <span
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </li>
  )
}

// ── ACCOUNT ─────────────────────────────────────────────────────────────────

export function DeleteAccountForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const result = await send('/api/profile/delete', {
      password: String(form.get('password') ?? ''),
      confirmation: String(form.get('confirmation') ?? ''),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.data.error ?? 'We could not delete your account.')
      return
    }
    router.push('/?deleted=1')
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-card border border-berry-500/30 bg-berry-100/40 p-5">
      <div>
        <h3 className="font-semibold text-berry-700">This cannot be undone</h3>
        <p className="mt-1 text-sm text-ink-700 text-pretty">
          Your profile, preferences, saved trips, connections and circles are deleted permanently.
          Messages you sent stay in other people’s conversations but are redacted and no longer
          attributed to you. Download your data first if you want a copy.
        </p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Your password" htmlFor="delete-password" required>
        <Input id="delete-password" name="password" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="Type DELETE to confirm" htmlFor="delete-confirm" required>
        <Input id="delete-confirm" name="confirmation" required placeholder="DELETE" autoComplete="off" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={busy}>
          Permanently delete my account
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
    </form>
  )
}

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/')
        router.refresh()
      }}
    >
      Sign out
    </Button>
  )
}
