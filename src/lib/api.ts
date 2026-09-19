import 'server-only'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { formatZodError } from '@/lib/validation'
import { clientIp, hashIp, rateLimit, type RateLimitName } from '@/lib/security/rateLimit'
import { captureException } from '@/lib/observability/logger'

/**
 * API HELPERS
 *
 * A consistent shape for every route handler, so the client never has to
 * guess what an error looks like, and so no handler forgets rate limiting or
 * validation.
 */

export interface ApiErrorBody {
  error: string
  fields?: Record<string, string>
  retryAfter?: number
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function fail(message: string, status = 400, extra?: Omit<ApiErrorBody, 'error'>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

export function notFound(what = 'That could not be found.') {
  return fail(what, 404)
}

export function forbidden(message = 'You do not have access to that.') {
  return fail(message, 403)
}

export function unauthorised(message = 'You need to be signed in.') {
  return fail(message, 401)
}

/** Parses and validates a JSON body, returning a typed result or a response. */
export async function parseBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: fail('Send a valid JSON body.', 400) }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: fail('Please check the highlighted fields.', 422, {
        fields: formatZodError(parsed.error),
      }),
    }
  }
  return { ok: true, data: parsed.data }
}

/** Applies a rate limit keyed on the caller. Returns a response when blocked. */
export function enforceRateLimit(
  request: Request,
  name: RateLimitName,
  identifier?: string,
): NextResponse | null {
  const key = identifier ?? hashIp(clientIp(request.headers))
  const result = rateLimit(name, key)
  if (result.allowed) return null
  return NextResponse.json(
    {
      error: 'That is a few too many attempts. Please wait a moment and try again.',
      retryAfter: result.retryAfterSeconds,
    } satisfies ApiErrorBody,
    { status: 429, headers: { 'retry-after': String(result.retryAfterSeconds) } },
  )
}

/**
 * Wraps a route handler so an unexpected error becomes a clean 500 rather
 * than a stack trace leaking to the client. Generic over the route context so
 * it works for both static and dynamic segments.
 */
export function handler<C = unknown>(fn: (request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      return await fn(request, context)
    } catch (error) {
      captureException(error, { url: request.url, method: request.method })
      return fail('Something went wrong at our end. Please try again.', 500)
    }
  }
}
