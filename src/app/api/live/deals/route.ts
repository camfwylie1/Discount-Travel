import { apiUser } from '@/lib/auth/guards'
import { subscribeToDealChanges, type DealChange } from '@/lib/live/bus'

/**
 * LIVE DEAL UPDATES (Server-Sent Events)
 *
 * A long-lived GET that streams changes to the browser as providers post them,
 * so a price on screen updates in place rather than going stale until someone
 * reloads.
 *
 * SSE rather than WebSockets on purpose. The traffic here is entirely one-way
 * — the server tells the browser what changed — and SSE is plain HTTP, so it
 * passes through proxies unchanged, reconnects on its own, and needs no second
 * server. A WebSocket would buy nothing except a protocol upgrade to operate.
 *
 * Route handlers are not cached by default, and a streamed response must not
 * be buffered by anything in front of it, hence the explicit no-store and
 * X-Accel-Buffering headers.
 */
export const dynamic = 'force-dynamic'

// Proxies and load balancers drop a connection that goes quiet. A comment line
// every 25 seconds is ignored by EventSource and keeps the pipe open.
const KEEPALIVE_MS = 25_000

export async function GET(request: Request) {
  // Live pricing is member functionality, so the stream is authenticated like
  // any other route rather than being left open because it is "just reads".
  const auth = await apiUser()
  if (!auth.ok) {
    return new Response('Unauthorized', { status: 401 })
  }

  // A member can narrow the stream to the deals actually on their screen, so a
  // feed of twelve cards does not receive every change in the marketplace.
  const url = new URL(request.url)
  const requested = (url.searchParams.get('deals') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100)
  const wanted = requested.length > 0 ? new Set(requested) : null

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined
  let keepalive: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true

      // enqueue() throws if the consumer has gone away, which happens routinely
      // when a tab closes. That is an ordinary end of stream, not an error.
      const send = (chunk: string) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          open = false
          cleanup()
        }
      }

      const cleanup = () => {
        open = false
        unsubscribe?.()
        if (keepalive) clearInterval(keepalive)
        try {
          controller.close()
        } catch {
          // Already closed by the runtime; nothing to do.
        }
      }

      // Tell the browser at once that the connection is live, so the UI can
      // show a real "updating live" state rather than an optimistic one.
      send(`retry: 5000\n`)
      send(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`)

      unsubscribe = subscribeToDealChanges((change: DealChange) => {
        if (wanted && !wanted.has(change.dealId)) return
        send(`event: deal-change\ndata: ${JSON.stringify(change)}\n\n`)
      })

      keepalive = setInterval(() => send(`: keepalive\n\n`), KEEPALIVE_MS)

      request.signal.addEventListener('abort', cleanup)
    },

    cancel() {
      unsubscribe?.()
      if (keepalive) clearInterval(keepalive)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      // nginx buffers proxied responses by default, which would hold every
      // event until the buffer filled and make "live" mean "eventually".
      'x-accel-buffering': 'no',
    },
  })
}
