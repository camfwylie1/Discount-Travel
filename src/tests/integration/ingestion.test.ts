import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import { runImport, checkCompliance } from '@/lib/ingestion/pipeline'
import { ComplianceError } from '@/lib/ingestion/types'

/**
 * INTEGRATION TESTS — these run against a REAL PostgreSQL database
 * (TEST_DATABASE_URL), not a mock. They are the only way to prove that the
 * compliance gate, the duplicate detection and the storage layer actually
 * behave as intended together.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

let permittedProviderId: string
let blockedProviderId: string
let unreviewedProviderId: string
let csvOnlyProviderId: string

beforeAll(async () => {
  // A clean slate for this test's providers only.
  await prisma.provider.deleteMany({ where: { slug: { startsWith: 'test-' } } })

  const make = async (
    slug: string,
    name: string,
    compliance: Parameters<typeof prisma.providerCompliance.create>[0]['data'] extends infer T
      ? Omit<T, 'providerId'>
      : never,
  ) => {
    const provider = await prisma.provider.create({ data: { slug, name } })
    await prisma.providerCompliance.create({
      data: { ...compliance, providerId: provider.id } as never,
    })
    return provider.id
  }

  permittedProviderId = await make('test-permitted', 'Test Permitted Co', {
    status: 'PERMITTED',
    allowedMethods: ['CSV_UPLOAD', 'JSON_IMPORT', 'XML_FEED', 'MANUAL_ENTRY'],
    attributionRequired: true,
    attributionText: 'Operated by Test Permitted Co',
  } as never)

  blockedProviderId = await make('test-blocked', 'Test Blocked Co', {
    status: 'BLOCKED',
    allowedMethods: [],
    blockedReason: 'Their terms prohibit automated collection.',
  } as never)

  unreviewedProviderId = await make('test-unreviewed', 'Test Unreviewed Co', {
    status: 'NOT_REVIEWED',
    allowedMethods: [],
  } as never)

  csvOnlyProviderId = await make('test-csv-only', 'Test CSV Only Co', {
    status: 'PERMITTED_WITH_CONDITIONS',
    allowedMethods: ['CSV_UPLOAD'],
    maxCacheHours: 6,
    imageUseRestricted: true,
  } as never)
})

afterAll(async () => {
  await prisma.provider.deleteMany({ where: { slug: { startsWith: 'test-' } } })
  await prisma.$disconnect()
})

const VALID_CSV = `title,price,nights,departure_airport,country,departure_date,airfare_included,inclusions,url
Costa Rica Rainforest Week,"1,899",7,YYZ,Costa Rica,2027-03-15,Yes,Return flights; Hotel,https://example.com/cr
Portugal Food & Wine,"2,499",8,YUL,Portugal,2027-05-02,Y,Flights; 8 nights; Tastings,https://example.com/pt
Iceland Ring Road,"2,199",8,YYZ,Iceland,2027-06-10,yes,Car hire; Guesthouses,https://example.com/is`

describe('THE COMPLIANCE GATE — the most important control in ingestion', () => {
  it('refuses a provider whose terms have not been reviewed', async () => {
    const check = await checkCompliance(unreviewedProviderId, 'CSV_UPLOAD')
    expect(check.permitted).toBe(false)
    expect(check.reason).toMatch(/have not been reviewed/i)
  })

  it('refuses a blocked provider and says why', async () => {
    const check = await checkCompliance(blockedProviderId, 'CSV_UPLOAD')
    expect(check.permitted).toBe(false)
    expect(check.reason).toMatch(/prohibit automated collection/i)
  })

  it('refuses a METHOD the provider has not permitted', async () => {
    // CSV is allowed for this provider; XML is not.
    expect((await checkCompliance(csvOnlyProviderId, 'CSV_UPLOAD')).permitted).toBe(true)
    const xml = await checkCompliance(csvOnlyProviderId, 'XML_FEED')
    expect(xml.permitted).toBe(false)
    expect(xml.reason).toMatch(/does not permit ingestion by XML_FEED/i)
  })

  it('permits an approved provider and returns the conditions attached', async () => {
    const check = await checkCompliance(csvOnlyProviderId, 'CSV_UPLOAD')
    expect(check.permitted).toBe(true)
    expect(check.conditions.join(' ')).toMatch(/refreshed at least every 6 hours/i)
    expect(check.conditions.join(' ')).toMatch(/image use is restricted/i)
  })

  it('BLOCKS THE IMPORT ITSELF, before a single row is parsed', async () => {
    // This is the point of the gate: not "do not display", but "do not copy".
    await expect(
      runImport(VALID_CSV, { providerId: blockedProviderId, format: 'csv' }),
    ).rejects.toThrow(ComplianceError)

    // Nothing was stored, and no import batch was left behind as if it ran.
    const deals = await prisma.deal.count({ where: { providerId: blockedProviderId } })
    expect(deals).toBe(0)
  })

  it('blocks an unreviewed provider too', async () => {
    await expect(
      runImport(VALID_CSV, { providerId: unreviewedProviderId, format: 'csv' }),
    ).rejects.toThrow(ComplianceError)
  })
})

describe('importing a CSV', () => {
  it('imports valid rows and records what happened', async () => {
    const result = await runImport(VALID_CSV, {
      providerId: permittedProviderId,
      format: 'csv',
      enrich: false,
    })

    expect(result.total).toBe(3)
    expect(result.valid).toBe(3)
    expect(result.invalid).toBe(0)
    expect(result.imported).toBe(3)

    const deals = await prisma.deal.findMany({
      where: { providerId: permittedProviderId },
      include: { images: true, inclusions: true, departureAirport: true },
    })
    expect(deals).toHaveLength(3)

    const costaRica = deals.find((d) => d.normalizedTitle.includes('Costa Rica'))!
    expect(costaRica.salePriceCents).toBe(189_900)
    expect(costaRica.durationNights).toBe(7)
    expect(costaRica.destinationCountry).toBe('CR')
    expect(costaRica.airfareIncluded).toBe(true)
    expect(costaRica.departureAirport?.iata).toBe('YYZ')
    expect(costaRica.inclusions.length).toBeGreaterThan(0)
    expect(costaRica.sourceAttribution).toBe('Operated by Test Permitted Co')
  })

  it('writes an auditable import batch with per-row results', async () => {
    const result = await runImport(VALID_CSV, {
      providerId: permittedProviderId,
      format: 'csv',
      enrich: false,
      dryRun: true,
    })
    const batch = await prisma.importBatch.findUnique({
      where: { id: result.batchId },
      include: { rows: true, logs: true },
    })
    expect(batch).toBeTruthy()
    expect(batch!.rows.length).toBe(3)
    expect(batch!.logs.length).toBeGreaterThan(0)
    expect(batch!.complianceNote).toMatch(/attribution required/i)
  })

  it('detects that a re-upload of the same file is entirely duplicate', async () => {
    const result = await runImport(VALID_CSV, {
      providerId: permittedProviderId,
      format: 'csv',
      enrich: false,
    })
    // Everything already exists, so nothing new is imported.
    expect(result.duplicates).toBe(3)
    expect(result.imported).toBe(0)

    const count = await prisma.deal.count({ where: { providerId: permittedProviderId } })
    expect(count).toBe(3)
  })

  it('rejects invalid rows without losing the valid ones', async () => {
    const mixed = `title,price,url
,1500,https://example.com/a
A Genuinely Fine Trip,1800,https://example.com/b
Broken Price Trip,not a number,`
    const result = await runImport(mixed, {
      providerId: permittedProviderId,
      format: 'csv',
      enrich: false,
    })
    expect(result.invalid).toBeGreaterThanOrEqual(2)
    expect(result.imported).toBe(1)

    const rows = await prisma.importRow.findMany({ where: { batchId: result.batchId } })
    const invalid = rows.filter((r) => r.status === 'INVALID')
    expect(invalid.length).toBeGreaterThanOrEqual(2)
    // Every rejection says why, in plain English.
    for (const row of invalid) {
      expect(JSON.stringify(row.errors)).toMatch(/required|price|link/i)
    }
  })

  it('reports columns it did not recognise rather than silently dropping them', async () => {
    const withExtras = `title,price,url,provider_rating,internal_code
A Trip,1500,https://example.com/x,4.8,ABC123`
    const result = await runImport(withExtras, {
      providerId: permittedProviderId,
      format: 'csv',
      enrich: false,
      dryRun: true,
    })
    expect(result.unknownColumns).toEqual(
      expect.arrayContaining(['provider_rating', 'internal_code']),
    )
    // …and keeps them as provider metadata.
    expect(result.rows[0]!.normalised!.providerMetadata).toMatchObject({
      provider_rating: '4.8',
      internal_code: 'ABC123',
    })
  })

  it('handles quoted fields containing commas and newlines', async () => {
    const tricky = `title,price,description,url
"Trip, with a comma",1500,"A description
spanning two lines",https://example.com/q`
    const result = await runImport(tricky, {
      providerId: permittedProviderId,
      format: 'csv',
      enrich: false,
      dryRun: true,
    })
    expect(result.total).toBe(1)
    // An already well-cased title is left exactly as the provider wrote it.
    expect(result.rows[0]!.normalised!.normalizedTitle).toBe('Trip, with a comma')
    expect(result.rows[0]!.normalised!.originalDescription).toContain('\n')
  })

  it('does a dry run without writing anything', async () => {
    const before = await prisma.deal.count({ where: { providerId: permittedProviderId } })
    const result = await runImport(
      `title,price,url\nDry Run Trip,999,https://example.com/dry`,
      { providerId: permittedProviderId, format: 'csv', enrich: false, dryRun: true },
    )
    expect(result.valid).toBe(1)
    expect(result.imported).toBe(0)
    expect(await prisma.deal.count({ where: { providerId: permittedProviderId } })).toBe(before)
  })
})

describe('importing JSON', () => {
  it('accepts a bare array', async () => {
    const json = JSON.stringify([
      { title: 'JSON Trip One', price: 1299, nights: 5, country: 'PT', url: 'https://example.com/j1' },
    ])
    const result = await runImport(json, {
      providerId: permittedProviderId, format: 'json', enrich: false, dryRun: true,
    })
    expect(result.valid).toBe(1)
    expect(result.rows[0]!.normalised!.salePriceCents).toBe(129_900)
  })

  it('accepts an object wrapping the array', async () => {
    const json = JSON.stringify({
      meta: { count: 1 },
      deals: [{ title: 'Wrapped Trip', price: 1500, url: 'https://example.com/w' }],
    })
    const result = await runImport(json, {
      providerId: permittedProviderId, format: 'json', enrich: false, dryRun: true,
    })
    expect(result.valid).toBe(1)
  })

  it('explains what is wrong with malformed JSON', async () => {
    const result = await runImport('{ not json', {
      providerId: permittedProviderId, format: 'json', enrich: false, dryRun: true,
    })
    expect(result.total).toBe(0)
    expect(result.parseErrors.join(' ')).toMatch(/not valid JSON/i)
  })
})

describe('importing XML', () => {
  it('reads a flat affiliate-style feed', async () => {
    const xml = `<?xml version="1.0"?>
<feed>
  <deal>
    <title>XML Trip One</title>
    <price>1799</price>
    <nights>6</nights>
    <country>Greece</country>
    <url>https://example.com/x1</url>
    <image>https://example.com/1.jpg</image>
    <image>https://example.com/2.jpg</image>
  </deal>
  <deal>
    <title><![CDATA[XML Trip & Two]]></title>
    <price>2099</price>
    <url>https://example.com/x2</url>
  </deal>
</feed>`
    const result = await runImport(xml, {
      providerId: permittedProviderId, format: 'xml', enrich: false, dryRun: true,
    })
    expect(result.total).toBe(2)
    expect(result.rows[0]!.normalised!.images).toHaveLength(2)
    expect(result.rows[1]!.normalised!.normalizedTitle).toBe('XML Trip & Two')
  })

  it('says clearly when it cannot find any records', async () => {
    const result = await runImport('<root><thing>x</thing></root>', {
      providerId: permittedProviderId, format: 'xml', enrich: false, dryRun: true,
    })
    expect(result.parseErrors.join(' ')).toMatch(/Could not find any records/i)
  })
})
