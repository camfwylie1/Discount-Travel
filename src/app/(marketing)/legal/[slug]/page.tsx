import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LEGAL_DOCUMENTS, getLegalDocument, REVIEW_BANNER } from '@/lib/legal/documents'
import { Alert } from '@/components/ui'
import { brand } from '@/config/brand'

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((doc) => ({ slug: doc.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const doc = getLegalDocument(slug)
  if (!doc) return { title: 'Not found' }
  return { title: doc.title, description: doc.summary }
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = getLegalDocument(slug)
  if (!doc) notFound()

  return (
    <article className="container-prose py-12 sm:py-16">
      <h1 className="text-display-lg text-balance">{doc.title}</h1>
      <p className="mt-2 text-lg text-ink-600">{doc.summary}</p>
      <p className="mt-1 text-sm text-ink-500">Last updated {doc.lastUpdated}</p>

      <Alert tone="warning" className="mt-8" title="Draft — not yet reviewed by a lawyer">
        {REVIEW_BANNER} It is published here so it can be read and corrected, not because it is
        finished.
        {doc.reviewNeeded.length > 0 && (
          <>
            <p className="mt-3 font-medium">Specifically needing Canadian legal review:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {doc.reviewNeeded.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </Alert>

      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 leading-relaxed text-ink-700 text-pretty">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <nav className="mt-14 border-t border-ink-200 pt-6" aria-label="Other legal documents">
        <h2 className="text-sm font-semibold text-ink-800">Other documents</h2>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_DOCUMENTS.filter((d) => d.slug !== doc.slug).map((other) => (
            <li key={other.slug}>
              <Link href={`/legal/${other.slug}`} className="text-sm text-terracotta-600 underline underline-offset-4">
                {other.title}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-500">
          Questions about any of this: {brand.supportEmail}
        </p>
      </nav>
    </article>
  )
}
