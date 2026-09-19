import type { ParseResult, RawDeal, SourceAdapter } from '../types'

/**
 * CSV ADAPTER
 *
 * A dependency-free RFC 4180 parser — quoted fields, embedded commas,
 * embedded newlines and escaped quotes all handled. A CSV library would be
 * one more thing to keep patched for about forty lines of code.
 *
 * Column names are matched loosely (case, spaces and underscores ignored) so
 * a founder's spreadsheet does not have to be perfect.
 */

export const COLUMN_ALIASES: Record<string, string[]> = {
  sourceReference: ['id', 'reference', 'ref', 'dealid', 'productcode', 'sku', 'tripcode'],
  title: ['title', 'name', 'dealtitle', 'tripname', 'product', 'productname'],
  description: ['description', 'details', 'summary', 'overview', 'about'],
  sourceUrl: ['url', 'link', 'sourceurl', 'deallink', 'website', 'bookingurl'],
  affiliateUrl: ['affiliateurl', 'affiliatelink', 'tracklink', 'trackingurl'],
  destinationCountry: ['country', 'destinationcountry', 'countrycode'],
  destinationRegion: ['region', 'destinationregion', 'state', 'province', 'area'],
  destinationCity: ['city', 'destinationcity', 'destination', 'town', 'resort'],
  continent: ['continent'],
  departureAirport: ['departureairport', 'departure', 'origin', 'from', 'fromairport', 'departurecity', 'gateway'],
  arrivalAirport: ['arrivalairport', 'arrival', 'toairport', 'destinationairport'],
  departureDate: ['departuredate', 'startdate', 'traveldate', 'from', 'outbound', 'departs'],
  returnDate: ['returndate', 'enddate', 'to', 'inbound', 'returns'],
  durationNights: ['nights', 'duration', 'durationnights', 'length', 'numnights', 'days'],
  currency: ['currency', 'ccy'],
  salePrice: ['price', 'saleprice', 'currentprice', 'nowprice', 'fromprice', 'amount', 'cost'],
  regularPrice: ['regularprice', 'originalprice', 'wasprice', 'listprice', 'rrp', 'retailprice'],
  pricePerPerson: ['priceperperson', 'perperson', 'pp'],
  airfareIncluded: ['airfareincluded', 'flightsincluded', 'includesflights', 'flights', 'airfare'],
  accommodationIncluded: ['accommodationincluded', 'hotelincluded', 'includeshotel', 'accommodation'],
  mealsIncluded: ['mealsincluded', 'meals', 'includesmeals', 'board'],
  activitiesIncluded: ['activitiesincluded', 'activities', 'excursionsincluded'],
  transportIncluded: ['transportincluded', 'transfersincluded', 'transfers', 'groundtransport'],
  guideIncluded: ['guideincluded', 'guide', 'tourleader'],
  accommodationType: ['accommodationtype', 'hoteltype', 'lodging', 'hotel', 'property'],
  accommodationQuality: ['stars', 'starrating', 'accommodationquality', 'rating', 'hotelstars'],
  groupSizeMin: ['groupsizemin', 'mingroupsize', 'minparticipants'],
  groupSizeMax: ['groupsizemax', 'maxgroupsize', 'maxparticipants', 'groupsize', 'maxgroup'],
  minAge: ['minage', 'minimumage', 'agefrom'],
  physicalDifficulty: ['difficulty', 'physicaldifficulty', 'fitnesslevel', 'activitylevel', 'grade'],
  tripStyle: ['tripstyle', 'type', 'triptype', 'category', 'styles', 'categories'],
  soloFriendly: ['solofriendly', 'solotravellers', 'singlefriendly'],
  inclusions: ['inclusions', 'included', 'whatsincluded', 'includes'],
  exclusions: ['exclusions', 'excluded', 'notincluded', 'whatsnotincluded'],
  images: ['images', 'image', 'photo', 'photos', 'imageurl', 'imageurls', 'picture'],
  cancellationPolicy: ['cancellationpolicy', 'cancellation', 'refundpolicy'],
  bookingDeadline: ['bookingdeadline', 'bookby', 'deadline'],
  expiresAt: ['expires', 'expiresat', 'expiry', 'expirydate', 'validuntil', 'offerends'],
  spotsRemaining: ['spotsremaining', 'availability', 'spotsleft', 'placesleft', 'remaining'],
}

const CANONICAL_BY_ALIAS = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
  CANONICAL_BY_ALIAS.set(canonical.toLowerCase(), canonical)
  for (const alias of aliases) CANONICAL_BY_ALIAS.set(alias, canonical)
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_\-.]/g, '')
}

/** RFC 4180 parser. Returns rows of raw string cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0

  // Strip a UTF-8 byte-order mark, which Excel loves to add.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  while (index < input.length) {
    const char = input[index]!

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      index += 1
      continue
    }
    if (char === '\r') {
      index += 1
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      index += 1
      continue
    }
    field += char
    index += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop entirely blank lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export class CsvAdapter implements SourceAdapter {
  readonly method = 'CSV_UPLOAD' as const
  readonly name = 'CSV'

  async parse(input: string | Buffer): Promise<ParseResult> {
    const text = typeof input === 'string' ? input : input.toString('utf8')
    const rows = parseCsv(text)
    const parseErrors: string[] = []

    if (rows.length === 0) return { rows: [], unknownColumns: [], parseErrors: ['The file is empty.'] }
    if (rows.length === 1) {
      return { rows: [], unknownColumns: [], parseErrors: ['The file has a header row but no data.'] }
    }

    const headers = rows[0]!
    const unknownColumns: string[] = []
    const mapping: (string | null)[] = headers.map((header) => {
      const canonical = CANONICAL_BY_ALIAS.get(normaliseHeader(header))
      if (!canonical && header.trim()) unknownColumns.push(header.trim())
      return canonical ?? null
    })

    const out: RawDeal[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i]!
      if (cells.length !== headers.length) {
        parseErrors.push(
          `Row ${i + 1} has ${cells.length} values but the header has ${headers.length}. It was still read, with missing values left blank.`,
        )
      }
      const record: Record<string, unknown> = {}
      const extra: Record<string, unknown> = {}
      for (let c = 0; c < headers.length; c++) {
        const value = (cells[c] ?? '').trim()
        if (value === '') continue
        const canonical = mapping[c]
        if (canonical) record[canonical] = value
        else if (headers[c]?.trim()) extra[headers[c]!.trim()] = value
      }
      if (Object.keys(extra).length > 0) record.extra = extra
      if (Object.keys(record).length > 0) out.push(record as RawDeal)
    }

    return { rows: out, unknownColumns: [...new Set(unknownColumns)], parseErrors }
  }
}
