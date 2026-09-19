'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Badge, Button, Field, Select } from '@/components/ui'

interface ImportResult {
  batchId: string
  dryRun: boolean
  summary: { total: number; valid: number; invalid: number; duplicates: number; imported: number }
  unknownColumns: string[]
  parseErrors: string[]
  complianceConditions: string[]
  problemRows: { rowNumber: number; title: string; status: string; errors: string[]; warnings: string[] }[]
  warningCount: number
}

export function ImportPanel({
  providers,
}: {
  providers: { id: string; name: string; status: string; allowedMethods: string[] }[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [providerId, setProviderId] = useState('')
  const [format, setFormat] = useState<'csv' | 'json' | 'xml'>('csv')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const provider = providers.find((p) => p.id === providerId)
  const methodFor = { csv: 'CSV_UPLOAD', json: 'JSON_IMPORT', xml: 'XML_FEED' } as const
  const methodAllowed = provider ? provider.allowedMethods.includes(methodFor[format]) : true

  async function run(dryRun: boolean) {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Choose a file first.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)

    const body = new FormData()
    body.append('file', file)
    body.append('providerId', providerId)
    body.append('format', format)
    body.append('dryRun', String(dryRun))
    // Skip AI enrichment on a dry run — it is the expensive step.
    body.append('enrich', String(!dryRun))

    const response = await fetch('/api/admin/import', { method: 'POST', body })
    const data = await response.json().catch(() => ({}))
    setBusy(false)

    if (!response.ok) {
      setError(data.error ?? 'The import failed.')
      return
    }
    setResult(data as ImportResult)
    if (!dryRun) router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provider" htmlFor="providerId" required>
          <Select id="providerId" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">Choose a provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status !== 'PERMITTED' && p.status !== 'PERMITTED_WITH_CONDITIONS' ? ` — ${p.status}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="File format" htmlFor="format" required>
          <Select id="format" value={format} onChange={(e) => setFormat(e.target.value as 'csv')}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </Select>
        </Field>
      </div>

      {provider && !methodAllowed && (
        <Alert tone="error" title="This provider does not permit that method">
          {provider.name} permits:{' '}
          {provider.allowedMethods.length > 0
            ? provider.allowedMethods.join(', ')
            : 'nothing — their compliance record blocks all ingestion'}
          . The import will be refused before the file is read.
        </Alert>
      )}

      <Field label="File" htmlFor="file" hint="Up to 20 MB. Column names are matched loosely — see DATA_INGESTION.md.">
        <input
          ref={fileRef}
          id="file"
          type="file"
          accept=".csv,.json,.xml,text/csv,application/json,text/xml,application/xml"
          className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-ink-900 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-ink-800"
        />
      </Field>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => run(true)} loading={busy} disabled={!providerId}>
          Validate without importing
        </Button>
        <Button onClick={() => run(false)} loading={busy} disabled={!providerId}>
          Import
        </Button>
      </div>

      {result && (
        <div className="space-y-4 rounded-card border border-ink-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{result.dryRun ? 'Validation report' : 'Import complete'}</h3>
            <Badge variant="neutral">{result.summary.total} rows</Badge>
            <Badge variant="moss">{result.summary.valid} valid</Badge>
            {result.summary.invalid > 0 && <Badge variant="berry">{result.summary.invalid} rejected</Badge>}
            {result.summary.duplicates > 0 && <Badge variant="gold">{result.summary.duplicates} duplicate</Badge>}
            {!result.dryRun && <Badge variant="ocean">{result.summary.imported} imported</Badge>}
          </div>

          {result.complianceConditions.length > 0 && (
            <Alert tone="info" title="Conditions attached to this provider">
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.complianceConditions.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </Alert>
          )}

          {result.unknownColumns.length > 0 && (
            <Alert tone="warning" title="Columns we did not recognise">
              These were kept as provider metadata rather than mapped to a field:{' '}
              <strong>{result.unknownColumns.join(', ')}</strong>. If one should map to a real
              field, rename the column — DATA_INGESTION.md lists every accepted name.
            </Alert>
          )}

          {result.parseErrors.length > 0 && (
            <Alert tone="warning" title="Parsing notes">
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {result.parseErrors.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}

          {result.problemRows.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Rows needing attention</h4>
              <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-ink-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {result.problemRows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2 tabular-nums text-ink-500">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2">
                          <Badge variant={row.status === 'INVALID' ? 'berry' : 'gold'}>
                            {row.status.toLowerCase()}
                          </Badge>
                          <ul className="mt-1 space-y-0.5 text-xs text-ink-600">
                            {[...row.errors, ...row.warnings].slice(0, 3).map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.dryRun && result.summary.valid > 0 && (
            <Button onClick={() => run(false)} loading={busy}>
              Looks right — import {result.summary.valid} deals
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
