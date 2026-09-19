'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Select } from '@/components/ui'

async function send(url: string, body: unknown, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { ok: response.ok, data: await response.json().catch(() => ({})) }
}

export function DealRowActions({
  dealId,
  status,
  featured,
}: {
  dealId: string
  status: string
  featured: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function update(patch: Record<string, unknown>) {
    setBusy(true)
    await send('/api/admin/deals', { dealId, ...patch }, 'PATCH')
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={status}
        disabled={busy}
        onChange={(e) => update({ status: e.target.value })}
        className="w-36 py-1.5 text-xs"
        aria-label="Change deal status"
      >
        {['DRAFT', 'ACTIVE', 'POSSIBLY_EXPIRED', 'EXPIRED', 'SOLD_OUT', 'UNKNOWN', 'ARCHIVED'].map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
        ))}
      </Select>
      <button
        type="button"
        disabled={busy}
        onClick={() => update({ featured: !featured })}
        className="rounded-lg px-2 py-1.5 text-xs text-ink-600 hover:bg-ink-100"
        title={featured ? 'Remove from featured' : 'Feature this deal'}
      >
        {featured ? '★' : '☆'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => update({ verifiedNow: true })}
        className="rounded-lg px-2 py-1.5 text-xs text-ink-600 hover:bg-ink-100"
        title="Mark as checked just now"
      >
        ✓
      </button>
    </div>
  )
}

export function ModerationActions({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')

  async function act(action: string) {
    setBusy(action)
    await send('/api/admin/reports', { reportId, action, note: note.trim() || undefined })
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution note (optional)"
        maxLength={1000}
        aria-label="Resolution note"
        className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => act('DISMISS')} loading={busy === 'DISMISS'}>
          Dismiss
        </Button>
        <Button size="sm" variant="outline" onClick={() => act('WARN')} loading={busy === 'WARN'}>
          Warn
        </Button>
        <Button size="sm" variant="outline" onClick={() => act('REMOVE_CONTENT')} loading={busy === 'REMOVE_CONTENT'}>
          Remove content
        </Button>
        <Button size="sm" variant="danger" onClick={() => act('SUSPEND_USER')} loading={busy === 'SUSPEND_USER'}>
          Suspend member
        </Button>
      </div>
    </div>
  )
}

export function UserActions({
  userId,
  status,
  role,
}: {
  userId: string
  status: string
  role: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(action: string) {
    setBusy(action)
    setError(null)
    const result = await send('/api/admin/users', { userId, action })
    setBusy(null)
    if (!result.ok) {
      setError(result.data.error ?? 'That did not work.')
      return
    }
    router.refresh()
  }

  if (role === 'ADMIN') {
    return <span className="text-xs text-ink-400">Administrator</span>
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {status === 'SUSPENDED' ? (
          <Button size="sm" variant="outline" onClick={() => act('REINSTATE')} loading={busy === 'REINSTATE'}>
            Reinstate
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => act('SUSPEND')} loading={busy === 'SUSPEND'}>
            Suspend
          </Button>
        )}
        {role === 'MODERATOR' ? (
          <Button size="sm" variant="ghost" onClick={() => act('MAKE_MEMBER')} loading={busy === 'MAKE_MEMBER'}>
            Remove moderator
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => act('MAKE_MODERATOR')} loading={busy === 'MAKE_MODERATOR'}>
            Make moderator
          </Button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-berry-500">{error}</p>}
    </div>
  )
}

export function DuplicateActions({
  candidateId,
  dealAId,
  dealBId,
}: {
  candidateId: string
  dealAId: string
  dealBId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function resolve(verdict: string, archiveDealId?: string) {
    setBusy(verdict + (archiveDealId ?? ''))
    await send('/api/admin/duplicates', { candidateId, verdict, archiveDealId })
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => resolve('NOT_DUPLICATE')} loading={busy === 'NOT_DUPLICATE'}>
        Keep both
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => resolve('CONFIRMED_DUPLICATE', dealBId)}
        loading={busy === `CONFIRMED_DUPLICATE${dealBId}`}
      >
        Archive the second
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => resolve('CONFIRMED_DUPLICATE', dealAId)}
        loading={busy === `CONFIRMED_DUPLICATE${dealAId}`}
      >
        Archive the first
      </Button>
    </div>
  )
}
