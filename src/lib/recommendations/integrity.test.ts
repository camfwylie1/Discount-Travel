import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ARCHITECTURAL GUARDS
 *
 * Two promises this product makes are only as good as the engine's inability
 * to break them. Both are currently true by construction — the scoring code
 * has no access to the data that would be needed — and construction is exactly
 * the sort of thing that changes quietly when someone adds a field to a select.
 *
 * These read the engine's own source. That is unusual for a unit test, and it
 * is the right tool here: the guarantee is about what the code is allowed to
 * know, which no amount of calling it with test data can demonstrate.
 */

const ENGINE_DIR = path.join(process.cwd(), 'src/lib/recommendations')

function engineSources(): { file: string; source: string }[] {
  return readdirSync(ENGINE_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    // service.ts loads data from the database for the rest of the engine, and
    // legitimately selects fields the UI needs for display (a provider's
    // sponsored badge among them). The scoring modules are what must stay
    // ignorant of them.
    .filter((f) => f !== 'service.ts')
    .map((file) => ({ file, source: readFileSync(path.join(ENGINE_DIR, file), 'utf8') }))
}

/** Comments discuss these promises by name; only real code may break them. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('commercial arrangements cannot reach a score', () => {
  const FORBIDDEN = [
    'sponsored',
    'commission',
    'affiliate',
    'qualityScore',
    'featuredRank',
    'revenue',
    'payout',
  ]

  it.each(FORBIDDEN)('no scoring module reads "%s"', (term) => {
    const offenders = engineSources()
      .filter(({ source }) => new RegExp(`\\b${term}\\b`, 'i').test(codeOnly(source)))
      .map(({ file }) => file)

    expect(
      offenders,
      `${offenders.join(', ')} references "${term}". A recommendation score must ` +
        `not be reachable from a commercial arrangement, and the strongest form ` +
        `of that promise is the engine having no way to read one.`,
    ).toEqual([])
  })
})

describe('sensitive characteristics cannot reach a score', () => {
  // Never inferred, never modelled, never scored on — from a name, a photo,
  // behaviour, or anything else.
  const FORBIDDEN = [
    'gender',
    'sexuality',
    'sexualOrientation',
    'ethnicity',
    'religion',
    'disability',
    'race',
  ]

  it.each(FORBIDDEN)('no scoring module reads "%s"', (term) => {
    const offenders = engineSources()
      .filter(({ source }) => new RegExp(`\\b${term}\\b`, 'i').test(codeOnly(source)))
      .map(({ file }) => file)

    expect(
      offenders,
      `${offenders.join(', ')} references "${term}". Compatibility is computed ` +
        `from travel characteristics only.`,
    ).toEqual([])
  })
})

describe('the engine is pure', () => {
  // Scores must be reproducible months later, when a member asks why they saw
  // something. A module that can read a database or the network cannot promise
  // that, and cannot be tested without one either.
  const FORBIDDEN = [
    ["'@/lib/db'", 'the database'],
    ['prisma', 'the database'],
    ['fetch(', 'the network'],
    ['process.env', 'the environment'],
  ] as const

  it.each(FORBIDDEN)('no scoring module touches %s (%s)', (term) => {
    const offenders = engineSources()
      .filter(({ source }) => codeOnly(source).includes(term))
      .map(({ file }) => file)

    expect(offenders, `${offenders.join(', ')} reaches outside the engine.`).toEqual([])
  })
})
