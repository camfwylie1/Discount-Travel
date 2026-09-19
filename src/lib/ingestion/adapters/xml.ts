import type { ParseResult, RawDeal, SourceAdapter } from '../types'
import { COLUMN_ALIASES } from './csv'

/**
 * XML ADAPTER
 *
 * Handles the flat "list of records" XML that affiliate feeds actually use —
 * repeated <deal>/<item>/<product> elements with leaf text children. It is
 * deliberately not a general-purpose XML parser: a feed with deep nesting
 * needs its own provider adapter, and we would rather fail clearly than
 * silently mangle it.
 */

const CANONICAL_BY_ALIAS = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  CANONICAL_BY_ALIAS.set(canonical.toLowerCase(), canonical)
  for (const alias of aliases) CANONICAL_BY_ALIAS.set(alias, canonical)
}

const RECORD_TAGS = ['deal', 'item', 'product', 'trip', 'offer', 'record', 'entry']

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .trim()
}

export class XmlAdapter implements SourceAdapter {
  readonly method = 'XML_FEED' as const
  readonly name = 'XML'

  async parse(input: string | Buffer): Promise<ParseResult> {
    const text = typeof input === 'string' ? input : input.toString('utf8')
    const parseErrors: string[] = []
    const unknownColumns = new Set<string>()

    // Find whichever record tag this feed actually uses.
    const tag = RECORD_TAGS.find((candidate) =>
      new RegExp(`<${candidate}[\\s>]`, 'i').test(text),
    )
    if (!tag) {
      return {
        rows: [],
        unknownColumns: [],
        parseErrors: [
          `Could not find any records. Expected repeated elements named one of: ${RECORD_TAGS.join(', ')}.`,
        ],
      }
    }

    const recordPattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi')
    const rows: RawDeal[] = []
    let match: RegExpExecArray | null

    while ((match = recordPattern.exec(text)) !== null) {
      const body = match[1]!
      const record: Record<string, unknown> = {}
      const extra: Record<string, unknown> = {}

      const fieldPattern = /<([a-zA-Z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g
      let field: RegExpExecArray | null
      while ((field = fieldPattern.exec(body)) !== null) {
        const name = field[1]!.replace(/^.*:/, '')
        const value = decodeEntities(field[2]!)
        if (!value) continue
        // A field containing further elements is nested — we do not guess.
        if (/<[a-zA-Z]/.test(field[2]!)) {
          parseErrors.push(`Skipped nested element <${name}>. Nested feeds need a provider-specific adapter.`)
          continue
        }
        const canonical = CANONICAL_BY_ALIAS.get(name.toLowerCase().replace(/[\s_\-.]/g, ''))
        if (canonical) {
          // Repeated elements (several <image>) become a list.
          if (record[canonical] !== undefined) {
            const existing = record[canonical]
            record[canonical] = Array.isArray(existing) ? [...existing, value] : [existing, value]
          } else {
            record[canonical] = value
          }
        } else {
          unknownColumns.add(name)
          extra[name] = value
        }
      }

      if (Object.keys(extra).length > 0) record.extra = extra
      if (Object.keys(record).length > 0) rows.push(record as RawDeal)
    }

    if (rows.length === 0) parseErrors.push(`Found <${tag}> elements but could not read any fields from them.`)

    return { rows, unknownColumns: [...unknownColumns], parseErrors: [...new Set(parseErrors)] }
  }
}
