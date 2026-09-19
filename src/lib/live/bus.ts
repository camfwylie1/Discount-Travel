import 'server-only'
import { EventEmitter } from 'node:events'
import { Client } from 'pg'
import { logger } from '@/lib/observability/logger'

/**
 * LIVE UPDATE BUS
 *
 * Carries "this deal just changed" from wherever the change happened — an
 * ingestion run, an admin edit, a price re-check — out to every browser
 * currently looking at it, on every server instance.
 *
 * TRANSPORT: POSTGRES LISTEN/NOTIFY
 *
 * An in-process emitter would only reach browsers connected to the instance
 * that published, which is wrong the moment there is more than one. Rather
 * than introduce a message broker, this rides the database the application
 * already requires: `NOTIFY` on publish, a single dedicated `LISTEN`
 * connection per instance, and a local emitter to fan out to that instance's
 * own subscribers so one database connection serves every open tab.
 *
 * No new infrastructure, nothing else to deploy or pay for, and it is exactly
 * as available as the database — which the product cannot run without anyway.
 *
 * If the listener cannot be established the bus falls back to in-process
 * delivery, so a single instance keeps working and a multi-instance
 * deployment degrades to per-instance rather than to silence.
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

const CHANNEL = 'voyaj_deal_change'

/** Postgres refuses a NOTIFY payload over 8000 bytes. Ours are far smaller. */
const MAX_PAYLOAD_BYTES = 7_500

interface BusState {
  emitter: EventEmitter
  listener?: Client
  notifier?: Client
  connecting?: Promise<void>
  degraded: boolean
}

// Survives hot reloads in development; otherwise every edit leaks a database
// connection and a set of listeners.
const globalForBus = globalThis as unknown as { __voyajLiveBus?: BusState }

function state(): BusState {
  if (!globalForBus.__voyajLiveBus) {
    const emitter = new EventEmitter()
    // One listener per open browser tab. The default of 10 exists to catch
    // leaks; here it would only catch popularity.
    emitter.setMaxListeners(0)
    globalForBus.__voyajLiveBus = { emitter, degraded: false }
  }
  return globalForBus.__voyajLiveBus
}

function connectionString(): string | undefined {
  return process.env.DATABASE_URL
}

/**
 * Opens the dedicated LISTEN connection, once per instance.
 *
 * It has to be a connection of its own: a client sitting in LISTEN cannot be
 * borrowed for queries, so this deliberately does not come from Prisma's pool.
 */
async function ensureListening(): Promise<void> {
  const bus = state()
  if (bus.listener || bus.degraded) return
  if (bus.connecting) return bus.connecting

  const url = connectionString()
  if (!url) {
    bus.degraded = true
    return
  }

  bus.connecting = (async () => {
    const client = new Client({ connectionString: url })

    client.on('notification', (message) => {
      if (message.channel !== CHANNEL || !message.payload) return
      try {
        bus.emitter.emit('change', JSON.parse(message.payload) as DealChange)
      } catch {
        // A malformed payload is not a reason to drop the connection.
      }
    })

    // A dropped listener means silent staleness, which is the failure mode
    // this whole feature exists to prevent. Clear it so the next publish or
    // subscribe reconnects rather than assuming it is still listening.
    client.on('error', (error) => {
      logger.warn('live.listener_error', { error: String(error) })
      bus.listener = undefined
      bus.connecting = undefined
    })

    client.on('end', () => {
      bus.listener = undefined
      bus.connecting = undefined
    })

    await client.connect()
    await client.query(`LISTEN ${CHANNEL}`)
    bus.listener = client
  })()

  try {
    await bus.connecting
  } catch (error) {
    // Fall back to in-process delivery rather than failing the request that
    // happened to trigger the connection.
    logger.warn('live.listen_unavailable', { error: String(error) })
    bus.degraded = true
  } finally {
    bus.connecting = undefined
  }
}

async function notifier(): Promise<Client | null> {
  const bus = state()
  if (bus.notifier) return bus.notifier

  const url = connectionString()
  if (!url) return null

  const client = new Client({ connectionString: url })
  client.on('error', () => {
    bus.notifier = undefined
  })
  client.on('end', () => {
    bus.notifier = undefined
  })

  await client.connect()
  bus.notifier = client
  return client
}

export function publishDealChange(change: Omit<DealChange, 'at'> & { at?: string }): void {
  const full: DealChange = { ...change, at: change.at ?? new Date().toISOString() }

  void (async () => {
    const bus = state()
    try {
      const client = await notifier()
      const payload = JSON.stringify(full)

      if (client && Buffer.byteLength(payload) <= MAX_PAYLOAD_BYTES) {
        // Every instance receives this, including ours — we are listening on
        // the same channel — so it must NOT also be emitted locally or every
        // browser on this instance would see the change twice.
        await client.query('SELECT pg_notify($1, $2)', [CHANNEL, payload])
        return
      }

      bus.emitter.emit('change', full)
    } catch (error) {
      logger.warn('live.publish_failed', { error: String(error) })
      // Better a local-only update than none.
      state().emitter.emit('change', full)
    }
  })()
}

export function subscribeToDealChanges(listener: (change: DealChange) => void): () => void {
  const bus = state()
  bus.emitter.on('change', listener)
  // Connect lazily: an instance with nobody watching needs no listener.
  void ensureListening()

  return () => {
    bus.emitter.off('change', listener)
  }
}

/** Test seam: drops the connections so a suite can assert on a clean bus. */
export async function __resetBus(): Promise<void> {
  const bus = globalForBus.__voyajLiveBus
  if (!bus) return
  bus.emitter.removeAllListeners()
  await bus.listener?.end().catch(() => {})
  await bus.notifier?.end().catch(() => {})
  globalForBus.__voyajLiveBus = undefined
}
