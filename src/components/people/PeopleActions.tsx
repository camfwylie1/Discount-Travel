'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Alert, Button } from '@/components/ui'

async function post(url: string, body: unknown, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

export function ConnectButton({
  userId,
  status,
  firstName,
  fullWidth = true,
}: {
  userId: string
  status?: string | null
  firstName: string
  fullWidth?: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState(status ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    setBusy(true)
    setError(null)
    const result = await post('/api/social/connect', { userId })
    setBusy(false)
    if (!result.ok) {
      if (result.status === 402) {
        router.push('/upgrade?from=connect')
        return
      }
      setError(result.data.error ?? 'Could not send that request.')
      return
    }
    setState(result.data.status)
    router.refresh()
  }

  if (state === 'ACCEPTED') {
    return (
      <Button variant="quiet" fullWidth={fullWidth} onClick={() => router.push(`/people/${userId}`)}>
        Connected
      </Button>
    )
  }
  if (state === 'PENDING') {
    return (
      <Button variant="outline" fullWidth={fullWidth} disabled>
        Request sent
      </Button>
    )
  }

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      <Button variant="outline" fullWidth={fullWidth} onClick={connect} loading={busy}>
        Connect with {firstName}
      </Button>
      {error && <p className="mt-1.5 text-xs text-berry-500">{error}</p>}
    </div>
  )
}

export function RespondToRequest({
  connectionId,
  firstName,
}: {
  connectionId: string
  firstName: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function respond(action: 'ACCEPT' | 'DECLINE') {
    setBusy(action)
    const result = await post('/api/social/respond', { connectionId, action })
    setBusy(null)
    if (result.ok) {
      setDone(action)
      router.refresh()
    }
  }

  if (done) {
    return (
      <p className="text-sm text-ink-500">
        {done === 'ACCEPT' ? `You are now connected with ${firstName}.` : 'Request declined.'}
      </p>
    )
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => respond('ACCEPT')} loading={busy === 'ACCEPT'}>
        Accept
      </Button>
      <Button size="sm" variant="ghost" onClick={() => respond('DECLINE')} loading={busy === 'DECLINE'}>
        Decline
      </Button>
    </div>
  )
}

export function MessageButton({ userId, firstName }: { userId: string; firstName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    const result = await post('/api/messages/start', { userId })
    setBusy(false)
    if (!result.ok) {
      if (result.status === 402) {
        router.push('/upgrade?from=message')
        return
      }
      setError(result.data.error ?? 'Could not open that conversation.')
      return
    }
    router.push(`/chats/${result.data.conversationId}`)
  }

  return (
    <div>
      <Button onClick={start} loading={busy}>
        Message {firstName}
      </Button>
      {error && <Alert tone="warning" className="mt-2">{error}</Alert>}
    </div>
  )
}

/**
 * BLOCK AND REPORT
 *
 * Deliberately always available on a profile, never buried. Blocking is
 * immediate and mutual; reporting opens a moderation case.
 */
export function SafetyActions({ userId, firstName }: { userId: string; firstName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState<'block' | 'report' | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reason, setReason] = useState('HARASSMENT')
  const [detail, setDetail] = useState('')

  async function block() {
    setBusy(true)
    const result = await post('/api/social/block', { userId })
    setBusy(false)
    if (result.ok) {
      setMessage(`${firstName} has been blocked. You will not see each other anywhere on Voyaj.`)
      setOpen(null)
      router.push('/people')
      router.refresh()
    }
  }

  async function report() {
    setBusy(true)
    const result = await post('/api/social/report', {
      kind: 'USER',
      reportedUserId: userId,
      reason,
      detail: detail.trim() || undefined,
    })
    setBusy(false)
    if (result.ok) {
      setMessage(`Thank you. Our moderators will review this. Reference ${result.data.reference}.`)
      setOpen(null)
    }
  }

  if (message) {
    return <Alert tone="success">{message}</Alert>
  }

  return (
    <div className="space-y-3">
      {open === null && (
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => setOpen('block')}
            className="text-ink-500 underline underline-offset-4 hover:text-ink-800"
          >
            Block {firstName}
          </button>
          <button
            type="button"
            onClick={() => setOpen('report')}
            className="text-ink-500 underline underline-offset-4 hover:text-ink-800"
          >
            Report {firstName}
          </button>
        </div>
      )}

      {open === 'block' && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <p className="text-sm text-ink-700 text-pretty">
            Blocking {firstName} removes your connection, takes you both out of each other’s
            discovery and messages, and cannot be seen by them. You can undo it in your settings.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="danger" onClick={block} loading={busy}>
              Block {firstName}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {open === 'report' && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <label className="block text-sm font-medium text-ink-800" htmlFor="report-reason">
            What is the problem?
          </label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-ink-300 px-3 py-2.5 text-sm"
          >
            <option value="HARASSMENT">Harassment or abuse</option>
            <option value="SPAM">Spam</option>
            <option value="SCAM">Scam or fraud</option>
            <option value="INAPPROPRIATE">Inappropriate content</option>
            <option value="FAKE_PROFILE">Fake profile</option>
            <option value="OTHER">Something else</option>
          </select>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Anything else our moderators should know (optional)"
            maxLength={1000}
            rows={3}
            className="mt-3 w-full rounded-xl border border-ink-300 px-3 py-2.5 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={report} loading={busy}>
              Send report
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
