import type { ParseResult, RawDeal, SourceAdapter } from '../types'
import { COLUMN_ALIASES } from './csv'

/**
 * JSON ADAPTER
 *
 * Accepts either a bare array of objects, or an object wrapping one under a
 * common key (`deals`, `data`, `items`, `results`, `products`). Keys are
 * matched with the same loose aliasing as the CSV adapter.
 */

const CANONICAL_BY_ALIAS = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  CANONICAL_BY_ALIAS.set(canonical.toLowerCase(), canonical)
  for (const alias of aliases) CANONICAL_BY_ALIAS.set(alias, canonical)
}

const WRAPPER_KEYS = ['deals', 'data', 'items', 'results', 'products', 'trips', 'offers', 'records']

export class JsonAdapter implements SourceAdapter {
  readonly method = 'JSON_IMPORT' as const
  readonly name = 'JSON'

  async parse(input: string | Buffer): Promise<ParseResult> {
    const text = typeof input === 'string' ? input : input.toString('utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      return {
        rows: [],
        unknownColumns: [],
        parseErrors: [`That is not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`],
      }
    }

    let list: unknown[] = []
    if (Array.isArray(parsed)) {
      list = parsed
    } else if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      const key = WRAPPER_KEYS.find((k) => Array.isArray(record[k]))
      if (key) list = record[key] as unknown[]
      else return { rows: [], unknownColumns: [], parseErrors: [
        `Expected an array of deals, or an object containing one under any of: ${WRAPPER_KEYS.join(', ')}.`,
      ] }
    } else {
      return { rows: [], unknownColumns: [], parseErrors: ['Expected an array of deals.'] }
    }

    const unknownColumns = new Set<string>()
    const rows: RawDeal[] = []

    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const record: Record<string, unknown> = {}
      const extra: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
        if (value === null || value === undefined || value === '') continue
        const canonical = CANONICAL_BY_ALIAS.get(key.toLowerCase().replace(/[\s_\-.]/g, ''))
        if (canonical) record[canonical] = value
        else {
          unknownColumns.add(key)
          extra[key] = value
        }
      }
      if (Object.keys(extra).length > 0) record.extra = extra
      if (Object.keys(record).length > 0) rows.push(record as RawDeal)
    }

    return { rows, unknownColumns: [...unknownColumns], parseErrors: [] }
  }
}
