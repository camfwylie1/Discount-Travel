'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js'

/**
 * APPLE PAY / GOOGLE PAY FOR THE ANNUAL MEMBERSHIP
 *
 * Renders the wallet button Stripe reports the device can actually use, and
 * nothing at all otherwise. There is deliberately no drawn-by-us "Apple Pay"
 * button: a button that opens a card form instead of the Apple Pay sheet is a
 * worse experience than never having offered it, and Apple's own guidelines
 * only permit the real mark.
 *
 * Membership is granted by the Stripe webhook, never by this component
 * reporting success. What happens here is a payment; what grants access is a
 * signed event from Stripe. The success screen says "confirming" until the
 * webhook lands rather than claiming an activation it cannot see.
 */

let stripePromise: Promise<Stripe | null> | null = null
function getStripe(publishableKey: string) {
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

export function ExpressCheckout({
  publishableKey,
  onUnavailable,
}: {
  publishableKey: string | null
  onUnavailable?: () => void
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The subscription is created up front so the wallet has something to
  // confirm. It grants nothing until its first payment succeeds.
  useEffect(() => {
    if (!publishableKey) return
    let cancelled = false

    void fetch('/api/billing/subscription-intent', { method: 'POST' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok) {
          setError(data.error ?? 'Wallet payment is unavailable right now.')
          onUnavailable?.()
          return
        }
        setClientSecret(data.clientSecret)
      })
      .catch(() => {
        if (!cancelled) onUnavailable?.()
      })

    return () => {
      cancelled = true
    }
  }, [publishableKey, onUnavailable])

  const stripe = useMemo(
    () => (publishableKey ? getStripe(publishableKey) : null),
    [publishableKey],
  )

  if (!publishableKey || !stripe) return null
  if (error) return null
  if (!clientSecret) return null

  return (
    <Elements stripe={stripe} options={{ clientSecret }}>
      <WalletButton clientSecret={clientSecret} onUnavailable={onUnavailable} />
    </Elements>
  )
}

function WalletButton({
  clientSecret,
  onUnavailable,
}: {
  clientSecret: string
  onUnavailable?: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [failure, setFailure] = useState<string | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)

  const confirm = useCallback(async () => {
    if (!stripe || !elements) return
    setFailure(null)

    const { error } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/upgrade/success?wallet=1`,
      },
    })

    // confirmPayment only returns when it did NOT redirect, which means it
    // failed. A success navigates away.
    if (error) {
      setFailure(
        error.message ?? 'That payment did not go through. Nothing has been charged.',
      )
    }
  }, [stripe, elements, clientSecret])

  return (
    <div>
      <ExpressCheckoutElement
        options={{ buttonHeight: 48 }}
        onReady={({ availablePaymentMethods }) => {
          // Stripe tells us which wallets this device can actually use. If
          // none, show nothing and let the card path stand on its own.
          const any = !!availablePaymentMethods && Object.values(availablePaymentMethods).some(Boolean)
          setAvailable(any)
          if (!any) onUnavailable?.()
        }}
        onConfirm={confirm}
      />

      {available && (
        <p className="mt-2 text-center text-xs text-ink-500">
          Billed once a year. Cancel any time from your membership settings.
        </p>
      )}

      {failure && (
        <p role="alert" className="mt-2 text-sm text-berry-500">
          {failure}
        </p>
      )}
    </div>
  )
}
