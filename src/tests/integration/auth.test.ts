import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/lib/auth/password'
import {
  createSession, hashToken, invalidateAllSessions, validateSessionToken,
} from '@/lib/auth/session'
import { canMessage, canSee, getRelationship, getBlockedUserIds } from '@/lib/social/visibility'
import { rateLimit, __resetRateLimits } from '@/lib/security/rateLimit'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

let alice: string
let bob: string
let carol: string

async function makeUser(email: string, overrides: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email,
      emailNormalized: email,
      passwordHash: await hashPassword('CorrectHorseBattery9!'),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      ageConfirmed18: true,
      onboardingComplete: true,
      profile: { create: { firstName: email.split('@')[0]! } },
      privacy: { create: {} },
      ...overrides,
    },
  })
  return user.id
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { emailNormalized: { endsWith: '@authtest.local' } } })
  alice = await makeUser('alice@authtest.local')
  bob = await makeUser('bob@authtest.local')
  carol = await makeUser('carol@authtest.local')
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { emailNormalized: { endsWith: '@authtest.local' } } })
  await prisma.$disconnect()
})

describe('password hashing', () => {
  it('produces a different hash every time (salted)', async () => {
    const a = await hashPassword('same password here')
    const b = await hashPassword('same password here')
    expect(a).not.toBe(b)
    expect(await verifyPassword(a, 'same password here')).toBe(true)
    expect(await verifyPassword(b, 'same password here')).toBe(true)
  })

  it('never stores the password in a readable form', async () => {
    const hash = await hashPassword('MySecretPassword123!')
    expect(hash).not.toContain('MySecretPassword')
    expect(hash.startsWith('$argon2')).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('CorrectHorseBattery9!')
    expect(await verifyPassword(hash, 'wrong')).toBe(false)
    expect(await verifyPassword(hash, 'CorrectHorseBattery9')).toBe(false)
  })

  it('does not throw on a malformed stored hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false)
  })

  it('enforces sensible password rules', () => {
    expect(checkPasswordStrength('short').ok).toBe(false)
    expect(checkPasswordStrength('password123').ok).toBe(false)
    expect(checkPasswordStrength('aaaaaaaaaaaaaa').ok).toBe(false)
    expect(checkPasswordStrength('CorrectHorseBattery9!').ok).toBe(true)
  })

  it('refuses a password containing the email address', () => {
    const result = checkPasswordStrength('alice12345678', 'alice@example.com')
    expect(result.ok).toBe(false)
    expect(result.problems.join(' ')).toMatch(/email/i)
  })
})

describe('sessions', () => {
  it('never stores the raw token in the database', async () => {
    const { token } = await createSession(alice)
    const rows = await prisma.session.findMany({ where: { userId: alice } })
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.id).not.toBe(token)
    }
    // The stored id is the SHA-256 of the token.
    expect(rows.some((r) => r.id === hashToken(token))).toBe(true)
  })

  it('validates a good token and returns live user data', async () => {
    const { token } = await createSession(alice)
    const session = await validateSessionToken(token)
    expect(session?.id).toBe(alice)
    expect(session?.email).toBe('alice@authtest.local')
  })

  it('rejects a made-up token', async () => {
    expect(await validateSessionToken('not-a-real-token')).toBeNull()
    expect(await validateSessionToken('')).toBeNull()
  })

  it('rejects an expired session and removes it', async () => {
    const { token } = await createSession(bob)
    await prisma.session.update({
      where: { id: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect(await validateSessionToken(token)).toBeNull()
    expect(await prisma.session.findUnique({ where: { id: hashToken(token) } })).toBeNull()
  })

  it('kills every session the moment an account is suspended', async () => {
    const { token } = await createSession(carol)
    expect(await validateSessionToken(token)).not.toBeNull()

    await prisma.user.update({ where: { id: carol }, data: { status: 'SUSPENDED' } })

    // This is the whole reason we do not use stateless tokens.
    expect(await validateSessionToken(token)).toBeNull()
    expect(await prisma.session.count({ where: { userId: carol } })).toBe(0)

    await prisma.user.update({ where: { id: carol }, data: { status: 'ACTIVE' } })
  })

  it('reflects a subscription change immediately, without a new sign-in', async () => {
    const { token } = await createSession(alice)
    expect((await validateSessionToken(token))?.membershipActive).toBe(false)

    await prisma.subscription.upsert({
      where: { userId: alice },
      create: {
        userId: alice, status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 86_400_000 * 30),
      },
      update: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 86_400_000 * 30) },
    })

    expect((await validateSessionToken(token))?.membershipActive).toBe(true)
  })

  it('treats an expired subscription period as not a member', async () => {
    const { token } = await createSession(alice)
    await prisma.subscription.update({
      where: { userId: alice },
      data: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() - 1000) },
    })
    expect((await validateSessionToken(token))?.membershipActive).toBe(false)
    await prisma.subscription.delete({ where: { userId: alice } })
  })

  it('signs out every device when asked', async () => {
    await createSession(alice)
    await createSession(alice)
    expect(await prisma.session.count({ where: { userId: alice } })).toBeGreaterThan(1)
    await invalidateAllSessions(alice)
    expect(await prisma.session.count({ where: { userId: alice } })).toBe(0)
  })
})

describe('visibility and blocking', () => {
  it('reports the relationship between two people', async () => {
    expect(await getRelationship(alice, alice)).toBe('self')
    expect(await getRelationship(alice, bob)).toBe('none')

    await prisma.connection.create({
      data: { requesterId: alice, addresseeId: bob, status: 'PENDING' },
    })
    expect(await getRelationship(alice, bob)).toBe('pending')

    await prisma.connection.updateMany({
      where: { requesterId: alice, addresseeId: bob },
      data: { status: 'ACCEPTED' },
    })
    expect(await getRelationship(alice, bob)).toBe('connected')
    // Symmetric: it does not matter who asked.
    expect(await getRelationship(bob, alice)).toBe('connected')
  })

  it('applies a visibility setting against the relationship', () => {
    expect(canSee('PUBLIC', 'none')).toBe(true)
    expect(canSee('CONNECTIONS', 'none')).toBe(false)
    expect(canSee('CONNECTIONS', 'connected')).toBe(true)
    expect(canSee('PRIVATE', 'connected')).toBe(false)
    expect(canSee('PRIVATE', 'self')).toBe(true)
    // A block overrides everything, including PUBLIC.
    expect(canSee('PUBLIC', 'blocked')).toBe(false)
  })

  it('makes a block mutual and total', async () => {
    await prisma.block.create({ data: { blockerId: alice, blockedId: bob } })

    expect(await getRelationship(alice, bob)).toBe('blocked')
    // Bob did not block Alice, but he still cannot see her.
    expect(await getRelationship(bob, alice)).toBe('blocked')

    expect(await getBlockedUserIds(alice)).toContain(bob)
    expect(await getBlockedUserIds(bob)).toContain(alice)

    await prisma.block.deleteMany({ where: { blockerId: alice, blockedId: bob } })
  })
})

describe('messaging permissions', () => {
  it('refuses a message between strangers when the setting is connections-only', async () => {
    await prisma.connection.deleteMany({
      where: { OR: [{ requesterId: alice, addresseeId: carol }, { requesterId: carol, addresseeId: alice }] },
    })
    const result = await canMessage(alice, carol)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/connected/i)
  })

  it('allows a message between connections', async () => {
    await prisma.connection.create({
      data: { requesterId: alice, addresseeId: carol, status: 'ACCEPTED' },
    })
    expect((await canMessage(alice, carol)).allowed).toBe(true)
  })

  it('requires a confirmed email address before messaging anyone', async () => {
    await prisma.user.update({ where: { id: alice }, data: { emailVerifiedAt: null } })
    const result = await canMessage(alice, carol)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/confirm your email/i)
    await prisma.user.update({ where: { id: alice }, data: { emailVerifiedAt: new Date() } })
  })

  it('honours "nobody can message me"', async () => {
    await prisma.privacySetting.update({
      where: { userId: carol },
      data: { whoCanMessage: 'NOBODY' },
    })
    const result = await canMessage(alice, carol)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/not accepting messages/i)
    await prisma.privacySetting.update({
      where: { userId: carol },
      data: { whoCanMessage: 'CONNECTIONS' },
    })
  })

  it('honours "anyone can message me"', async () => {
    await prisma.privacySetting.update({ where: { userId: bob }, data: { whoCanMessage: 'ANYONE' } })
    expect((await canMessage(carol, bob)).allowed).toBe(true)
    await prisma.privacySetting.update({ where: { userId: bob }, data: { whoCanMessage: 'CONNECTIONS' } })
  })

  it('never lets a blocked member message', async () => {
    await prisma.block.create({ data: { blockerId: carol, blockedId: alice } })
    const result = await canMessage(alice, carol)
    expect(result.allowed).toBe(false)
    // Deliberately vague — confirming a block invites harassment.
    expect(result.reason).not.toMatch(/blocked/i)
    await prisma.block.deleteMany({ where: { blockerId: carol, blockedId: alice } })
  })

  it('refuses to message a suspended account', async () => {
    await prisma.user.update({ where: { id: carol }, data: { status: 'SUSPENDED' } })
    expect((await canMessage(alice, carol)).allowed).toBe(false)
    await prisma.user.update({ where: { id: carol }, data: { status: 'ACTIVE' } })
  })
})

describe('rate limiting', () => {
  it('allows requests up to the limit then blocks', () => {
    __resetRateLimits()
    const key = 'test-user-1'
    for (let i = 0; i < 8; i++) {
      expect(rateLimit('login', key).allowed).toBe(true)
    }
    const blocked = rateLimit('login', key)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('keeps separate windows per identifier', () => {
    __resetRateLimits()
    for (let i = 0; i < 8; i++) rateLimit('login', 'user-a')
    expect(rateLimit('login', 'user-a').allowed).toBe(false)
    // A different user is unaffected.
    expect(rateLimit('login', 'user-b').allowed).toBe(true)
  })

  it('keeps separate windows per action', () => {
    __resetRateLimits()
    for (let i = 0; i < 8; i++) rateLimit('login', 'same-user')
    expect(rateLimit('login', 'same-user').allowed).toBe(false)
    expect(rateLimit('message', 'same-user').allowed).toBe(true)
  })
})
