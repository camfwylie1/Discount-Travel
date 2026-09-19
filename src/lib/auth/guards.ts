import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { readSessionToken, validateSessionToken, type SessionUser } from './session'
import { flagDefaults } from '@/config/flags'

/**
 * AUTHORIZATION
 *
 * Every protected page and API route calls one of these. Hiding a button in
 * the UI is never authorization — the server decides, every time.
 * `cache()` de-duplicates the lookup within a single request only.
 */

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken()
  if (!token) return null
  return validateSessionToken(token)
})

export async function requireUser(redirectTo = '/login'): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect(redirectTo)
  return user
}

/** Requires a signed-in user who has finished onboarding. */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.onboardingComplete) redirect('/onboarding')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  if (user.role !== 'ADMIN') redirect('/discover?error=forbidden')
  return user
}

export async function requireModerator(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') redirect('/discover?error=forbidden')
  return user
}

/** True when the member may use paid surfaces. Admins always may. */
export function hasMembership(user: SessionUser | null): boolean {
  if (!user) return false
  if (!flagDefaults.PAYWALL_ENABLED) return true
  if (user.role === 'ADMIN' || user.role === 'MODERATOR') return true
  return user.membershipActive
}

export async function requireMembership(): Promise<SessionUser> {
  const user = await requireOnboardedUser()
  if (!hasMembership(user)) redirect('/upgrade')
  return user
}

/** API-route variants: return a typed result instead of redirecting. */
export type GuardResult<T> = { ok: true; user: T } | { ok: false; status: number; error: string }

export async function apiUser(): Promise<GuardResult<SessionUser>> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, status: 401, error: 'You need to be signed in.' }
  return { ok: true, user }
}

export async function apiMember(): Promise<GuardResult<SessionUser>> {
  const res = await apiUser()
  if (!res.ok) return res
  if (!hasMembership(res.user)) {
    return { ok: false, status: 402, error: 'This feature is part of Voyaj membership.' }
  }
  return res
}

export async function apiAdmin(): Promise<GuardResult<SessionUser>> {
  const res = await apiUser()
  if (!res.ok) return res
  if (res.user.role !== 'ADMIN') return { ok: false, status: 403, error: 'Administrators only.' }
  return res
}

export async function apiModerator(): Promise<GuardResult<SessionUser>> {
  const res = await apiUser()
  if (!res.ok) return res
  if (res.user.role !== 'ADMIN' && res.user.role !== 'MODERATOR') {
    return { ok: false, status: 403, error: 'Moderators only.' }
  }
  return res
}
