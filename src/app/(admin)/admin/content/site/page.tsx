/**
 * /admin/content/site
 *
 * Index of editable site-content sections. Each section is a JSONB row in
 * the site_content table, edited via the per-section page. The site falls
 * back to in-code defaults if a row is missing or malformed, so a bad edit
 * (or no edits at all) never breaks the front side.
 */

import Link from 'next/link'
import { getAllSectionMetas } from '@/lib/content/site'

export const metadata = { title: 'Site content', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SiteContentIndexPage() {
  const sections = await getAllSectionMetas()

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-eyebrow text-neutral-500">Content</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Site content
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Edit the copy that appears on the public site. Each section falls back
          to a built-in default if you delete the row or save invalid content,
          so the site never breaks from a typo. Use{' '}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
            *asterisks*
          </code>{' '}
          inside a string to italicise and gold-highlight a phrase.
        </p>
      </header>

      <ul className="space-y-3">
        {sections.map((s) => (
          <li
            key={s.key}
            className="flex items-center justify-between gap-6 rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-300"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-neutral-900">
                  {s.label}
                </h2>
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                  {s.key}
                </code>
                {s.updatedAt === null && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    UNCONFIGURED — showing defaults
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-600">{s.description}</p>
              {s.updatedAt && (
                <p className="mt-2 text-xs text-neutral-500">
                  Last updated:{' '}
                  {new Date(s.updatedAt).toLocaleString('en-KE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </div>
            <Link
              href={`/admin/content/site/${s.key}`}
              className="shrink-0 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
