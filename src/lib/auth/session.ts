import 'server-only'
import { cookies } from 'next/headers'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import type { User } from '@/generated/prisma/client'

/**
 * SESSION MANAGEMENT
 *
 * Pattern: opaque 256-bit random tokens, stored as SHA-256 hashes.
 * The raw token exists only in the user's httpOnly cookie. A database leak
 * therefore does not hand an attacker working sessions.
 *
 * Why not a JWT: subscription status, admin role and account suspension must
 * be revocable *immediately*. A stateless token cannot do that. See ADR-001
 * in ARCHITECTURE.md.
 */

export const SESSION_COOKIE = 'voyaj_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15 // refresh in the last half

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export async function createSession(
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken()
  const id = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    },
  })
  return { token, expiresAt }
}

export interface SessionUser {
  id: string
  email: string
  role: User['role']
  status: User['status']
  onboardingComplete: boolean
  onboardingStep: string | null
  emailVerifiedAt: Date | null
  firstName: string | null
  photoThumbUrl: string | null
  /** Re-read from the database on every request — never cached in a token. */
  membershipActive: boolean
  subscriptionStatus: string
}

/**
 * Validates a raw session token. Always reads the live user row so that a
 * suspension, role change or subscription change takes effect instantly.
 */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token) return null
  const id = hashToken(token)
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          profile: { select: { firstName: true, photoThumbUrl: true } },
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      },
    },
  })
  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {})
    return null
  }

  const user = session.user
  if (user.status === 'SUSPENDED' || user.status === 'DELETED' || user.deletedAt) {
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {})
    return null
  }

  // Sliding expiry: extend only when we are into the second half of the window.
  if (session.expiresAt.getTime() - Date.now() < SESSION_REFRESH_THRESHOLD_MS) {
    await prisma.session
      .update({
        where: { id },
        data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS), lastActiveAt: new Date() },
      })
      .catch(() => {})
  }

  const sub = user.subscription
  const membershipActive =
    !!sub &&
    (sub.status === 'ACTIVE' || sub.status === 'TRIALING') &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now())

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    onboardingComplete: user.onboardingComplete,
    onboardingStep: user.onboardingStep,
    emailVerifiedAt: user.emailVerifiedAt,
    firstName: user.profile?.firstName ?? null,
    photoThumbUrl: user.profile?.photoThumbUrl ?? null,
    membershipActive,
    subscriptionStatus: sub?.status ?? 'NONE',
  }
}

export async function invalidateSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: hashToken(token) } }).catch(() => {})
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

/** Purges expired rows. Called opportunistically by the admin dashboard. */
export async function pruneExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })
  return count
}
