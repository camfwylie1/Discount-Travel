'use client'

import { useState } from 'react'
import { Alert, Button, Input } from '@/components/ui'

export function CheckoutButton({
  configured,
  priceLabel,
}: {
  configured: boolean
  priceLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promo, setPromo] = useState('')
  const [showPromo, setShowPromo] = useState(false)

  async function checkout() {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ promoCode: promo.trim() || undefined }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error ?? 'We could not start checkout. Please try again.')
      setBusy(false)
      return
    }
    // Stripe hosts the payment page — card details never touch our servers.
    window.location.href = data.url
  }

  if (!configured) {
    return (
      <Alert tone="warning" title="Payments are not switched on yet">
        This installation does not have Stripe keys configured, so checkout is unavailable. Adding
        them takes about five minutes — see “Turning on payments” in the README. Everything else in
        the product works without them.
      </Alert>
    )
  }

  return (
    <div>
      <Button size="lg" fullWidth onClick={checkout} loading={busy}>
        Join for {priceLabel}
      </Button>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}

      {showPromo ? (
        <div className="mt-3">
          <label htmlFor="promo" className="sr-only">Promotion code</label>
          <Input
            id="promo"
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="Promotion code"
            maxLength={40}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPromo(true)}
          className="mt-3 w-full text-center text-sm text-ink-500 underline underline-offset-4 hover:text-ink-800"
        >
          I have a promotion code
        </button>
      )}

      <p className="mt-4 text-center text-xs text-ink-500 text-pretty">
        Secure checkout by Stripe. Apple Pay and Google Pay appear automatically on supported
        devices. Cancel any time from your settings.
      </p>
    </div>
  )
}

export function ManageBillingButton({ label = 'Manage membership' }: { label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open() {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error ?? 'We could not open your billing page.')
      setBusy(false)
      return
    }
    window.location.href = data.url
  }

  return (
    <div>
      <Button variant="outline" onClick={open} loading={busy}>
        {label}
      </Button>
      {error && <Alert tone="error" className="mt-2">{error}</Alert>}
    </div>
  )
}
