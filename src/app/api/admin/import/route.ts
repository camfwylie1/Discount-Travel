import { apiAdmin } from '@/lib/auth/guards'
import { enforceRateLimit, fail, handler, ok } from '@/lib/api'
import { runImport } from '@/lib/ingestion/pipeline'
import { ComplianceError } from '@/lib/ingestion/types'
import { audit } from '@/lib/analytics/events'
import { logger } from '@/lib/observability/logger'

export const maxDuration = 60

const MAX_IMPORT_BYTES = 20 * 1024 * 1024

/**
 * DEAL IMPORT
 *
 * Accepts a CSV, JSON or XML file, runs it through the pipeline and returns
 * a per-row report. The compliance gate runs first: a blocked or unreviewed
 * provider is refused before the file is read at all.
 */
export const POST = handler(async (request) => {
  const auth = await apiAdmin()
  if (!auth.ok) return fail(auth.error, auth.status)
  const limited = enforceRateLimit(request, 'upload', auth.user.id)
  if (limited) return limited

  const form = await request.formData().catch(() => null)
  if (!form) return fail('Send the file as multipart form data.', 400)

  const file = form.get('file')
  const providerId = String(form.get('providerId') ?? '')
  const format = String(form.get('format') ?? '').toLowerCase()
  const dryRun = form.get('dryRun') === 'true'
  const publish = form.get('publish') !== 'false'
  const enrich = form.get('enrich') !== 'false'

  if (!providerId) return fail('Choose a provider.', 422)
  if (!['csv', 'json', 'xml'].includes(format)) {
    return fail('Format must be csv, json or xml.', 422)
  }
  if (!file || typeof file === 'string') return fail('Choose a file to import.', 422)
  if (file.size > MAX_IMPORT_BYTES) {
    return fail(`Files must be smaller than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`, 413)
  }

  const text = await file.text()

  try {
    const result = await runImport(text, {
      providerId,
      format: format as 'csv' | 'json' | 'xml',
      uploadedById: auth.user.id,
      filename: file.name,
      dryRun,
      publish,
      enrich,
    })

    await audit({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: dryRun ? 'import.validated' : 'import.completed',
      entityType: 'ImportBatch',
      entityId: result.batchId,
      after: {
        total: result.total,
        imported: result.imported,
        invalid: result.invalid,
        duplicates: result.duplicates,
      },
    })

    return ok({
      batchId: result.batchId,
      dryRun,
      summary: {
        total: result.total,
        valid: result.valid,
        invalid: result.invalid,
        duplicates: result.duplicates,
        imported: result.imported,
      },
      unknownColumns: result.unknownColumns,
      parseErrors: result.parseErrors,
      complianceConditions: result.complianceConditions,
      // Only the problem rows come back — a 5,000-row success needs no detail.
      problemRows: result.rows
        .filter((r) => r.status === 'INVALID' || r.status === 'DUPLICATE')
        .slice(0, 100)
        .map((r) => ({
          rowNumber: r.rowNumber,
          title: r.normalised?.originalTitle ?? '(no title)',
          status: r.status,
          errors: r.errors.map((e) => `${e.field}: ${e.message}`),
          warnings: r.warnings.map((w) => `${w.field}: ${w.message}`),
        })),
      warningCount: result.rows.reduce((sum, r) => sum + r.warnings.length, 0),
    })
  } catch (error) {
    if (error instanceof ComplianceError) {
      logger.warn('admin.import_blocked', { providerId, error: error.message })
      return fail(error.message, 403)
    }
    throw error
  }
})
