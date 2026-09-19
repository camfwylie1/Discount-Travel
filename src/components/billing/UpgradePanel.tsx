'use client'

import { useState } from 'react'
import { Alert, Button, Input } from '@/components/ui'
import { ExpressCheckout } from './ExpressCheckout'

export function CheckoutButton({
  configured,
  priceLabel,
  publishableKey = null,
}: {
  configured: boolean
  priceLabel: string
  /** Stripe's publishable key. Public by design; it is what enables the wallet. */
  publishableKey?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [promo, setPromo] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  // Assume a wallet might exist, then let Stripe tell us otherwise. The
  // component removes itself if the device has no wallet configured.
  const [walletPossible, setWalletPossible] = useState(!!publishableKey)

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
      {/* The wallet button renders only where the device actually has a wallet
          set up. Stripe tells us; we do not guess from the user agent, and we
          never draw a fake Apple Pay button that opens a card form. */}
      {walletPossible && (
        <div className="mb-3">
          <ExpressCheckout
            publishableKey={publishableKey}
            onUnavailable={() => setWalletPossible(false)}
          />
          <div className="mt-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-xs uppercase tracking-wider text-ink-500">or pay by card</span>
            <span className="h-px flex-1 bg-ink-200" />
          </div>
        </div>
      )}

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
