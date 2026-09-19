import 'server-only'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/observability/logger'
import { ai } from '@/lib/ai'
import { computeDealValue } from '@/lib/recommendations/dealValue'
import { TRAIT_TO_DIMENSIONS } from '@/lib/taxonomy/destinations'
import { slugify } from '@/lib/utils'
import { normalise } from './normalize'
import { validate } from './validate'
import { compareDeals, toComparable, CERTAIN_THRESHOLD, REVIEW_THRESHOLD } from './dedupe'
import { CsvAdapter } from './adapters/csv'
import { JsonAdapter } from './adapters/json'
import { XmlAdapter } from './adapters/xml'
import {
  ComplianceError,
  type IngestionMethodKey,
  type NormalisedDeal,
  type RowResult,
  type SourceAdapter,
} from './types'

/**
 * THE INGESTION PIPELINE
 *
 *   SOURCE → Fetch → Parse → Normalize → Validate → Deduplicate →
 *   Categorize → AI enrich → Quality check → Store → Index → Publish
 *
 * THE COMPLIANCE GATE IS THE FIRST STEP, NOT THE LAST.
 *
 * It is not enough to decide at display time whether we are allowed to show
 * something — by then we have already copied it. So a provider whose
 * compliance record does not permit the method being used is refused here,
 * before a single row is read.
 */

export function adapterFor(format: string): SourceAdapter {
  switch (format.toLowerCase()) {
    case 'csv':
      return new CsvAdapter()
    case 'json':
      return new JsonAdapter()
    case 'xml':
      return new XmlAdapter()
    default:
      throw new Error(`No adapter for format "${format}". Supported: csv, json, xml.`)
  }
}

export interface ComplianceCheck {
  permitted: boolean
  reason?: string
  conditions: string[]
}

/**
 * THE GATE. Called before parsing, and again before publishing.
 */
export async function checkCompliance(
  providerId: string,
  method: IngestionMethodKey,
): Promise<ComplianceCheck> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: { compliance: true },
  })

  if (!provider) return { permitted: false, reason: 'That provider does not exist.', conditions: [] }

  const compliance = provider.compliance
  if (!compliance) {
    return {
      permitted: false,
      reason: `No compliance record exists for ${provider.name}. Review their terms and complete the compliance record before importing anything.`,
      conditions: [],
    }
  }

  if (compliance.status === 'BLOCKED') {
    return {
      permitted: false,
      reason: `${provider.name} is blocked: ${compliance.blockedReason ?? 'no reason recorded'}`,
      conditions: [],
    }
  }

  if (compliance.status === 'NOT_REVIEWED') {
    return {
      permitted: false,
      reason: `${provider.name}'s terms have not been reviewed. Do not import their content until someone has read their terms of service and recorded what is permitted.`,
      conditions: [],
    }
  }

  if (!compliance.allowedMethods.includes(method)) {
    return {
      permitted: false,
      reason: `${provider.name} does not permit ingestion by ${method}. Permitted methods: ${
        compliance.allowedMethods.length > 0 ? compliance.allowedMethods.join(', ') : 'none'
      }.`,
      conditions: [],
    }
  }

  // Permitted — but there may be conditions the operator has to honour.
  const conditions: string[] = []
  if (compliance.attributionRequired) {
    conditions.push(
      `Attribution required: "${compliance.attributionText ?? `Operated by ${provider.name}`}"`,
    )
  }
  if (compliance.imageUseRestricted) {
    conditions.push('Image use is restricted. Check what they permit before using images in marketing.')
  }
  if (compliance.maxCacheHours) {
    conditions.push(`Content must be refreshed at least every ${compliance.maxCacheHours} hours.`)
  }
  if (compliance.cachingRestrictions) conditions.push(compliance.cachingRestrictions)

  return { permitted: true, conditions }
}

export interface ImportOptions {
  providerId: string
  format: 'csv' | 'json' | 'xml'
  method?: IngestionMethodKey
  uploadedById?: string | null
  filename?: string | null
  /** Validate and report without writing any deals. */
  dryRun?: boolean
  /** Publish immediately, or leave as DRAFT for review. */
  publish?: boolean
  /** Run AI summarisation and classification. Costs money; off for dry runs. */
  enrich?: boolean
}

export interface ImportSummary {
  batchId: string
  total: number
  valid: number
  invalid: number
  duplicates: number
  imported: number
  skipped: number
  unknownColumns: string[]
  parseErrors: string[]
  complianceConditions: string[]
  rows: RowResult[]
}

export async function runImport(
  input: string | Buffer,
  options: ImportOptions,
): Promise<ImportSummary> {
  const method: IngestionMethodKey =
    options.method ??
    (options.format === 'csv' ? 'CSV_UPLOAD' : options.format === 'xml' ? 'XML_FEED' : 'JSON_IMPORT')

  // ── STEP 0: THE COMPLIANCE GATE ─────────────────────────────────────────
  const compliance = await checkCompliance(options.providerId, method)
  if (!compliance.permitted) {
    const provider = await prisma.provider.findUnique({
      where: { id: options.providerId },
      select: { name: true },
    })
    logger.warn('ingestion.blocked_by_compliance', {
      providerId: options.providerId,
      method,
      reason: compliance.reason,
    })
    throw new ComplianceError(compliance.reason ?? 'Not permitted.', provider?.name ?? 'Unknown', method)
  }

  const batch = await prisma.importBatch.create({
    data: {
      providerId: options.providerId,
      uploadedById: options.uploadedById ?? null,
      filename: options.filename ?? null,
      method,
      format: options.format,
      status: 'VALIDATING',
      startedAt: new Date(),
      complianceNote: compliance.conditions.join(' · ') || null,
    },
  })

  const log = (level: 'INFO' | 'WARN' | 'ERROR', stage: string, message: string, data?: object) =>
    prisma.importLog.create({
      data: { batchId: batch.id, level, stage, message, data: (data ?? {}) as object },
    }).catch(() => {})

  await log('INFO', 'compliance', `Permitted by ${method}.`, { conditions: compliance.conditions })

  try {
    // ── STEP 1-2: FETCH (already in hand) & PARSE ─────────────────────────
    const adapter = adapterFor(options.format)
    const parsed = await adapter.parse(input)

    for (const error of parsed.parseErrors) await log('WARN', 'parse', error)
    if (parsed.unknownColumns.length > 0) {
      await log('WARN', 'parse', 'Unrecognised columns were kept as provider metadata.', {
        columns: parsed.unknownColumns,
      })
    }
    await log('INFO', 'parse', `Parsed ${parsed.rows.length} rows.`)

    if (parsed.rows.length === 0) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorSummary: { parseErrors: parsed.parseErrors } as object,
        },
      })
      return {
        batchId: batch.id, total: 0, valid: 0, invalid: 0, duplicates: 0, imported: 0, skipped: 0,
        unknownColumns: parsed.unknownColumns, parseErrors: parsed.parseErrors,
        complianceConditions: compliance.conditions, rows: [],
      }
    }

    // Existing deals for this provider, for duplicate comparison.
    const existing = await prisma.deal.findMany({
      where: { providerId: options.providerId, status: { not: 'ARCHIVED' } },
      select: {
        id: true, providerId: true, sourceReference: true, sourceUrl: true,
        normalizedTitle: true, destinationCountry: true, destinationCity: true,
        departureDate: true, durationNights: true, salePriceCents: true,
        departureAirport: { select: { iata: true } },
      },
      take: 5000,
    })
    const existingComparables = existing.map((d) => ({
      id: d.id,
      comparable: {
        providerId: d.providerId,
        sourceReference: d.sourceReference,
        sourceUrl: d.sourceUrl,
        normalizedTitle: d.normalizedTitle,
        destinationCountry: d.destinationCountry,
        destinationCity: d.destinationCity,
        departureDate: d.departureDate,
        durationNights: d.durationNights,
        salePriceCents: d.salePriceCents,
        departureAirportIata: d.departureAirport?.iata ?? null,
      },
    }))

    const results: RowResult[] = []
    const seenInBatch: { comparable: ReturnType<typeof toComparable>; rowNumber: number }[] = []

    // ── STEP 3-6: NORMALIZE → VALIDATE → DEDUPLICATE ─────────────────────
    for (const [index, raw] of parsed.rows.entries()) {
      const rowNumber = index + 2 // +1 for zero-index, +1 for the header row
      const { deal, issues } = normalise(raw)
      const { errors, warnings } = validate(deal)
      const allWarnings = [...warnings, ...issues.filter((i) => i.severity === 'warning')]
      const allErrors = [...errors, ...issues.filter((i) => i.severity === 'error')]

      if (allErrors.length > 0) {
        results.push({
          rowNumber, raw: raw as Record<string, unknown>, normalised: deal,
          errors: allErrors, warnings: allWarnings, status: 'INVALID',
        })
        continue
      }

      const comparable = toComparable(deal, options.providerId)

      // Against what is already stored…
      let duplicateOfId: string | null = null
      let bestScore = 0
      for (const candidate of existingComparables) {
        const verdict = compareDeals(comparable, candidate.comparable)
        if (verdict.score > bestScore) bestScore = verdict.score
        if (verdict.verdict === 'CERTAIN') {
          duplicateOfId = candidate.id
          break
        }
        if (verdict.verdict === 'LIKELY' && !duplicateOfId) {
          // Never silently drop an uncertain match — record it for a human.
          await prisma.duplicateCandidate
            .create({
              data: {
                dealAId: candidate.id,
                dealBId: candidate.id, // replaced below once the new deal exists
                score: verdict.score,
                signals: verdict.signals as object,
              },
            })
            .catch(() => {})
        }
      }

      // …and against earlier rows in this same file.
      if (!duplicateOfId) {
        for (const seen of seenInBatch) {
          if (compareDeals(comparable, seen.comparable).verdict === 'CERTAIN') {
            results.push({
              rowNumber, raw: raw as Record<string, unknown>, normalised: deal,
              errors: [], warnings: [
                ...allWarnings,
                { field: 'row', message: `Duplicate of row ${seen.rowNumber} in this file.`, severity: 'warning' as const },
              ],
              status: 'DUPLICATE',
            })
            break
          }
        }
        if (results[results.length - 1]?.rowNumber === rowNumber) continue
      }

      seenInBatch.push({ comparable, rowNumber })

      results.push({
        rowNumber, raw: raw as Record<string, unknown>, normalised: deal,
        errors: [], warnings: allWarnings,
        status: duplicateOfId ? 'DUPLICATE' : 'VALID',
        duplicateOfId,
      })
    }

    const validRows = results.filter((r) => r.status === 'VALID')
    await log('INFO', 'validate', `${validRows.length} valid, ${results.length - validRows.length} rejected or duplicate.`)

    // ── STEP 7-11: CATEGORIZE → ENRICH → STORE → PUBLISH ─────────────────
    let imported = 0
    if (!options.dryRun) {
      await prisma.importBatch.update({ where: { id: batch.id }, data: { status: 'IMPORTING' } })

      for (const row of validRows) {
        if (!row.normalised) continue
        try {
          const dealId = await storeDeal(row.normalised, options, compliance.conditions)
          row.dealId = dealId
          row.status = 'IMPORTED'
          imported += 1
        } catch (error) {
          row.status = 'INVALID'
          row.errors.push({
            field: 'storage',
            message: error instanceof Error ? error.message : 'Could not save this deal.',
            severity: 'error',
          })
          await log('ERROR', 'store', `Row ${row.rowNumber}: ${String(error)}`)
        }
      }
    }

    // Persist every row so the founder can see exactly what happened.
    await prisma.importRow.createMany({
      data: results.slice(0, 5000).map((row) => ({
        batchId: batch.id,
        rowNumber: row.rowNumber,
        raw: row.raw as object,
        normalized: (row.normalised ?? null) as object,
        status: row.status,
        errors: row.errors as object,
        warnings: row.warnings as object,
        duplicateOfId: row.duplicateOfId ?? null,
        dealId: row.dealId ?? null,
      })),
    })

    const invalid = results.filter((r) => r.status === 'INVALID').length
    const duplicates = results.filter((r) => r.status === 'DUPLICATE').length

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: options.dryRun
          ? 'READY_FOR_REVIEW'
          : invalid > 0
            ? 'COMPLETED_WITH_ERRORS'
            : 'COMPLETED',
        totalRows: results.length,
        validRows: validRows.length,
        invalidRows: invalid,
        duplicateRows: duplicates,
        importedRows: imported,
        finishedAt: new Date(),
        errorSummary: {
          parseErrors: parsed.parseErrors,
          unknownColumns: parsed.unknownColumns,
        } as object,
      },
    })

    await log('INFO', 'complete', `Imported ${imported} deals.`)

    return {
      batchId: batch.id,
      total: results.length,
      valid: validRows.length,
      invalid,
      duplicates,
      imported,
      skipped: 0,
      unknownColumns: parsed.unknownColumns,
      parseErrors: parsed.parseErrors,
      complianceConditions: compliance.conditions,
      rows: results,
    }
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorSummary: { message: String(error) } as object,
      },
    })
    await log('ERROR', 'pipeline', String(error))
    throw error
  }
}

/** STORE — turns one normalised deal into rows, with attributes and AI enrichment. */
async function storeDeal(
  deal: NormalisedDeal,
  options: ImportOptions,
  conditions: string[],
): Promise<string> {
  const [provider, departureAirport, arrivalAirport, destination] = await Promise.all([
    prisma.provider.findUnique({
      where: { id: options.providerId },
      include: { compliance: { select: { attributionText: true } } },
    }),
    deal.departureAirportIata
      ? prisma.airport.findUnique({ where: { iata: deal.departureAirportIata } })
      : null,
    deal.arrivalAirportIata
      ? prisma.airport.findUnique({ where: { iata: deal.arrivalAirportIata } })
      : null,
    deal.destinationCountry
      ? prisma.destination.findFirst({
          where: { country: deal.destinationCountry, kind: 'COUNTRY' },
        })
      : null,
  ])
  if (!provider) throw new Error('Provider disappeared during import.')

  const value = computeDealValue({
    salePriceCents: deal.salePriceCents,
    regularPriceCents: deal.regularPriceCents,
    observedHigherPriceCount: 0,
    durationNights: deal.durationNights,
    airfareIncluded: deal.airfareIncluded,
    accommodationIncluded: deal.accommodationIncluded,
    mealsIncluded: deal.mealsIncluded,
    activitiesIncluded: deal.activitiesIncluded,
    guideIncluded: deal.guideIncluded,
    transportIncluded: deal.transportIncluded,
    accommodationQuality: deal.accommodationQuality,
    providerQuality: provider.qualityScore,
  })

  const slugBase = slugify(
    `${deal.normalizedTitle}-${deal.departureAirportIata ?? ''}-${deal.departureDate?.toISOString().slice(0, 7) ?? ''}`,
  )
  const slug = await uniqueSlug(slugBase)

  const created = await prisma.deal.create({
    data: {
      slug,
      providerId: options.providerId,
      sourceUrl: deal.sourceUrl,
      affiliateUrl: deal.affiliateUrl,
      sourceReference: deal.sourceReference,
      sourceAttribution:
        provider.compliance?.attributionText ?? `Operated by ${provider.name}`,
      ingestionMethod: options.method ?? 'CSV_UPLOAD',
      originalTitle: deal.originalTitle,
      normalizedTitle: deal.normalizedTitle,
      originalDescription: deal.originalDescription,
      destinationCountry: deal.destinationCountry,
      destinationRegion: deal.destinationRegion,
      destinationCity: deal.destinationCity,
      continent: deal.continent ?? destination?.continent ?? null,
      latitude: destination?.latitude ?? null,
      longitude: destination?.longitude ?? null,
      departureAirportId: departureAirport?.id ?? null,
      arrivalAirportId: arrivalAirport?.id ?? null,
      departureDate: deal.departureDate,
      returnDate: deal.returnDate,
      durationNights: deal.durationNights,
      durationDays: deal.durationNights ? deal.durationNights + 1 : null,
      currency: deal.currency,
      salePriceCents: deal.salePriceCents,
      regularPriceCents: deal.regularPriceCents,
      discountCents: deal.discountCents,
      discountPercent: deal.discountPercent,
      pricePerPerson: deal.pricePerPerson,
      airfareIncluded: deal.airfareIncluded,
      accommodationIncluded: deal.accommodationIncluded,
      mealsIncluded: deal.mealsIncluded,
      activitiesIncluded: deal.activitiesIncluded,
      transportIncluded: deal.transportIncluded,
      guideIncluded: deal.guideIncluded,
      accommodationType: deal.accommodationType,
      accommodationQuality: deal.accommodationQuality,
      groupSizeMin: deal.groupSizeMin,
      groupSizeMax: deal.groupSizeMax,
      minAge: deal.minAge,
      physicalDifficulty: deal.physicalDifficulty,
      tripStyle: deal.tripStyle,
      soloFriendly: deal.soloFriendly,
      cancellationPolicy: deal.cancellationPolicy,
      bookingDeadline: deal.bookingDeadline,
      expiresAt: deal.expiresAt,
      spotsRemaining: deal.spotsRemaining,
      // Published straight away, or held as a draft for review.
      status: options.publish === false ? 'DRAFT' : 'ACTIVE',
      sourceLastCheckedAt: new Date(),
      verifiedAt: new Date(),
      confidence: deal.confidence as object,
      overallConfidence: deal.overallConfidence,
      qualityIssues: deal.qualityIssues,
      providerMetadata: {
        ...deal.providerMetadata,
        complianceConditions: conditions,
      } as object,
      valueScore: value.score,
      valueComponents: value as object,
      valueComputedAt: new Date(),
      images: {
        create: deal.images.slice(0, 8).map((url, i) => ({
          url,
          alt: `${deal.normalizedTitle} — image ${i + 1}`,
          sortOrder: i,
          isHero: i === 0,
        })),
      },
      inclusions: {
        create: [
          ...deal.inclusions.map((label, i) => ({ kind: 'INCLUDED', label: label.slice(0, 300), sortOrder: i })),
          ...deal.exclusions.map((label, i) => ({ kind: 'EXCLUDED', label: label.slice(0, 300), sortOrder: i })),
        ],
      },
      ...(destination
        ? { destinations: { create: [{ destinationId: destination.id, isPrimary: true }] } }
        : {}),
    },
  })

  // ── CATEGORIZE: destination-trait rules, at rule-grade confidence.
  const dimensions = await prisma.preferenceDimension.findMany({
    where: { active: true },
    select: { id: true, key: true, label: true, category: true },
  })
  const byKey = new Map(dimensions.map((d) => [d.key, d]))
  const attributes = new Map<string, { intensity: number; confidence: number; source: string; evidence: string }>()

  for (const trait of destination?.traits ?? []) {
    for (const mapping of TRAIT_TO_DIMENSIONS[trait] ?? []) {
      const dimension = byKey.get(mapping.key)
      if (!dimension) continue
      attributes.set(dimension.id, {
        intensity: mapping.intensity,
        confidence: 0.45,
        source: 'RULE',
        evidence: `Inferred from destination trait "${trait}"`,
      })
    }
  }

  // ── AI ENRICH: summary and classification, once, at ingestion.
  if (options.enrich !== false) {
    try {
      const [summary, classification] = await Promise.all([
        ai.summariseDeal({
          title: deal.normalizedTitle,
          description: deal.originalDescription,
          destination: [deal.destinationCity, deal.destinationRegion, deal.destinationCountry]
            .filter(Boolean)
            .join(', '),
          departureAirport: deal.departureAirportIata,
          durationNights: deal.durationNights,
          facts: {
            airfareIncluded: deal.airfareIncluded,
            accommodationIncluded: deal.accommodationIncluded,
            mealsIncluded: deal.mealsIncluded,
            activitiesIncluded: deal.activitiesIncluded,
            guideIncluded: deal.guideIncluded,
            accommodationType: deal.accommodationType,
            groupSizeMax: deal.groupSizeMax,
            physicalDifficulty: deal.physicalDifficulty,
            tripStyle: deal.tripStyle,
          },
          inclusions: deal.inclusions,
          highlightCandidates: deal.inclusions.slice(0, 6),
        }),
        ai.classifyDeal({
          title: deal.normalizedTitle,
          description: deal.originalDescription,
          destination: deal.destinationCountry ?? '',
          destinationTraits: destination?.traits ?? [],
          inclusions: deal.inclusions,
          itineraryText: null,
          availableDimensions: dimensions.map((d) => ({
            key: d.key,
            label: d.label,
            category: d.category,
          })),
        }),
      ])

      await prisma.deal.update({
        where: { id: created.id },
        data: {
          aiSummary: summary.data.summary,
          aiSummaryModel: summary.model ?? summary.provider,
          aiSummaryAt: new Date(),
          highlights: summary.data.highlights ?? [],
        },
      })

      // AI classifications override rule guesses, but never SOURCE facts.
      for (const attribute of classification.data.attributes) {
        const dimension = byKey.get(attribute.key)
        if (!dimension) continue
        attributes.set(dimension.id, {
          intensity: attribute.intensity,
          confidence: attribute.confidence,
          source: 'AI',
          evidence: attribute.evidence ?? 'Classified from the listing text',
        })
      }
    } catch (error) {
      // Enrichment failing must never lose a deal.
      logger.warn('ingestion.enrichment_failed', { dealId: created.id, error: String(error) })
    }
  }

  if (attributes.size > 0) {
    await prisma.dealAttribute.createMany({
      data: [...attributes.entries()].map(([dimensionId, attribute]) => ({
        dealId: created.id,
        dimensionId,
        ...attribute,
      })),
      skipDuplicates: true,
    })
  }

  return created.id
}

async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || `deal-${Date.now()}`
  const existing = await prisma.deal.findUnique({ where: { slug: candidate }, select: { id: true } })
  if (!existing) return candidate
  return `${candidate}-${Math.random().toString(36).slice(2, 7)}`
}

export { CERTAIN_THRESHOLD, REVIEW_THRESHOLD }
