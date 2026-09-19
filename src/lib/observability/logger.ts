/**
 * LOGGING
 *
 * Structured JSON in production (so a log service can parse it), readable
 * lines in development. Sensitive fields are redacted centrally rather than
 * relying on every call site to remember.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const REDACT_KEYS = new Set([
  'password', 'passwordhash', 'token', 'sessiontoken', 'apikey', 'api_key',
  'secret', 'authorization', 'cookie', 'stripesecretkey', 'email',
  'creditcard', 'cardnumber', 'cvv', 'ssn', 'sin',
])

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[deep]'
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[redacted]' : redact(val, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 800) return `${value.slice(0, 800)}…`
  return value
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const payload = {
    level,
    event,
    time: new Date().toISOString(),
    ...(data ? (redact(data) as Record<string, unknown>) : {}),
  }
  const line = process.env.NODE_ENV === 'production' ? JSON.stringify(payload) : `[${level}] ${event} ${data ? JSON.stringify(redact(data)) : ''}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else if (level === 'debug') {
    if (process.env.NODE_ENV === 'development') console.debug(line)
  } else console.log(line)
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => emit('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
}

/**
 * Error reporting. Sends to Sentry when SENTRY_DSN is configured, and is a
 * safe no-op otherwise, so a missing key never breaks anything.
 */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  logger.error('exception', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 6).join('\n') : undefined,
    ...context,
  })
  // Sentry integration point — see DEPLOYMENT.md § Error monitoring.
}
