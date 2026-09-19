import { clearSessionCookie, invalidateSession, readSessionToken } from '@/lib/auth/session'
import { handler, ok } from '@/lib/api'

export const POST = handler(async () => {
  const token = await readSessionToken()
  if (token) await invalidateSession(token)
  await clearSessionCookie()
  return ok({ ok: true })
})
