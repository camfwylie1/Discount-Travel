import { afterAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { __resetBus, publishDealChange, subscribeToDealChanges } from '@/lib/live/bus'

/**
 * The live bus exists so that a change published on one server instance
 * reaches browsers connected to a different one. A test that only proves an
 * in-process emitter works would prove exactly the thing that was already
 * broken, so these go through Postgres.
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL

afterAll(async () => {
  await __resetBus()
})

function waitForChange(timeoutMs = 5_000): Promise<unknown> {
  return new Promise((resolve) => {
    const stop = subscribeToDealChanges((change) => {
      stop()
      resolve(change)
    })
    setTimeout(() => {
      stop()
      resolve(null)
    }, timeoutMs)
  })
}

describe('live update bus', () => {
  it('delivers a change published through this process', async () => {
    const waiting = waitForChange()
    // Give the LISTEN connection a moment to establish before notifying.
    await new Promise((r) => setTimeout(r, 400))

    publishDealChange({ dealId: 'deal-local', kind: 'PRICE', salePriceCents: 129_900 })

    const change = (await waiting) as { dealId: string; kind: string; at: string } | null
    expect(change).not.toBeNull()
    expect(change!.dealId).toBe('deal-local')
    expect(change!.kind).toBe('PRICE')
    // Stamped on publish, so a consumer can tell how fresh it is.
    expect(Date.parse(change!.at)).not.toBeNaN()
  })

  it('delivers a change published by a DIFFERENT connection', async () => {
    // This is the case the in-process emitter could not serve: another server
    // instance entirely. A separate Postgres connection stands in for it.
    const waiting = waitForChange()
    await new Promise((r) => setTimeout(r, 400))

    const other = new Client({ connectionString: url })
    await other.connect()
    try {
      await other.query('SELECT pg_notify($1, $2)', [
        'voyaj_deal_change',
        JSON.stringify({
          dealId: 'deal-from-elsewhere',
          kind: 'AVAILABILITY',
          status: 'SOLD_OUT',
          at: new Date().toISOString(),
        }),
      ])
    } finally {
      await other.end()
    }

    const change = (await waiting) as { dealId: string; status: string } | null
    expect(change, 'A change from another instance never arrived').not.toBeNull()
    expect(change!.dealId).toBe('deal-from-elsewhere')
    expect(change!.status).toBe('SOLD_OUT')
  })

  it('delivers each change exactly once', async () => {
    // The publisher listens on the same channel it notifies, so a naive
    // implementation that also emitted locally would deliver twice.
    const seen: string[] = []
    const stop = subscribeToDealChanges((change) => seen.push(change.dealId))
    await new Promise((r) => setTimeout(r, 400))

    publishDealChange({ dealId: 'deal-once', kind: 'DETAILS' })
    await new Promise((r) => setTimeout(r, 1_200))
    stop()

    expect(seen.filter((id) => id === 'deal-once')).toHaveLength(1)
  })

  it('stops delivering after unsubscribe', async () => {
    const seen: string[] = []
    const stop = subscribeToDealChanges((change) => seen.push(change.dealId))
    await new Promise((r) => setTimeout(r, 400))
    stop()

    publishDealChange({ dealId: 'deal-after-unsubscribe', kind: 'DETAILS' })
    await new Promise((r) => setTimeout(r, 900))

    expect(seen).not.toContain('deal-after-unsubscribe')
  })
})
