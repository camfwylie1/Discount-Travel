import 'server-only'
import { hash, verify } from '@node-rs/argon2'

/**
 * Argon2id parameters. These follow the OWASP Password Storage Cheat Sheet
 * recommendation (19 MiB memory, 2 iterations, 1 degree of parallelism).
 * We do not invent cryptography — we configure a vetted implementation.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS)
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

/**
 * Constant-ish work even when a user does not exist, so that response timing
 * cannot be used to enumerate registered email addresses.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$aBcQ0Q1mKq7pVJ1hV1kx8v2m1qE0m0k0Z0h0Z0h0Z0g'

export async function fakeVerify(plain: string): Promise<void> {
  try {
    await verify(DUMMY_HASH, plain, ARGON2_OPTIONS)
  } catch {
    /* expected — this call exists only to burn comparable time */
  }
}

export interface PasswordCheck {
  ok: boolean
  problems: string[]
}

/** Deliberately simple, explainable rules. Length matters most. */
export function checkPasswordStrength(password: string, email?: string): PasswordCheck {
  const problems: string[] = []
  if (password.length < 10) problems.push('Use at least 10 characters.')
  if (password.length > 200) problems.push('That password is too long.')
  if (!/[a-zA-Z]/.test(password)) problems.push('Include at least one letter.')
  if (!/[0-9!-\/:-@\[-`{-~]/.test(password)) problems.push('Include a number or symbol.')
  const lower = password.toLowerCase()
  if (email && lower.includes(email.toLowerCase().split('@')[0] ?? '\u0000')) {
    problems.push('Do not use your email address in your password.')
  }
  if (COMMON_PASSWORDS.has(lower)) problems.push('That password is too common.')
  return { ok: problems.length === 0, problems }
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyuiop', 'letmein123', 'welcome123', 'admin12345', 'iloveyou1', 'travel123',
  'password1234', 'qwerty12345', 'abc12345678', 'passw0rd123',
])
