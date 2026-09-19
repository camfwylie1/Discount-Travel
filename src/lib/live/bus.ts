import 'server-only'
import { EventEmitter } from 'node:events'

/**
 * LIVE UPDATE BUS
 *
 * Carries "this deal just changed" from wherever the change happened — an
 * ingestion run, an admin edit, a price re-check — out to every browser
 * currently looking at it.
 *
 * This is an in-process emitter, which means it reaches the browsers connected
 * to THIS server instance and no others. On one instance that is correct and
 * complete. Behind a load balancer it is not: a member connected to instance A
 * will not see a change that instance B published.
 *
 * That is a real limitation and it is the same one the rate limiter has, with
 * the same fix — a shared broker. `publish()` is the single choke point, so
 * moving to Redis pub/sub later is a change to this file and nothing else.
 * It is listed in ROADMAP.md alongside the rate limiter, because both are
 * prerequisites for running more than one instance rather than optimisations.
 */

export type DealChangeKind = 'PRICE' | 'AVAILABILITY' | 'DETAILS' | 'NEW' | 'REMOVED'

export interface DealChange {
  dealId: string
  kind: DealChangeKind
  /** Present for a price change; integer cents, like everywhere else. */
  salePriceCents?: number | null
  previousPriceCents?: number | null
  currency?: string | null
  status?: string | null
  /** When the provider's page was last successfully re-checked. */
  sourceLastCheckedAt?: string | null
  at: string
}

// The emitter must survive a hot reload in development, or every edit leaks a
// set of listeners and the warning threshold is hit within a minute.
const globalForBus = globalThis as unknown as { __voyajLiveBus?: EventEmitter }

function bus(): EventEmitter {
  if (!globalForBus.__voyajLiveBus) {
    const emitter = new EventEmitter()
    // One listener per open browser tab. The default of 10 is meant to catch
    // leaks, and here it would only catch popularity.
    emitter.setMaxListeners(0)
    globalForBus.__voyajLiveBus = emitter
  }
  return globalForBus.__voyajLiveBus
}

const CHANNEL = 'deal-change'

export function publishDealChange(change: Omit<DealChange, 'at'> & { at?: string }): void {
  bus().emit(CHANNEL, { ...change, at: change.at ?? new Date().toISOString() } satisfies DealChange)
}

export function subscribeToDealChanges(listener: (change: DealChange) => void): () => void {
  bus().on(CHANNEL, listener)
  return () => {
    bus().off(CHANNEL, listener)
  }
}
