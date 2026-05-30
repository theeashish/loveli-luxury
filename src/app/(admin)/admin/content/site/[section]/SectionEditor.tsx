'use client'

/**
 * Client editor for a single site_content section.
 *
 * Renders the body as pretty-printed JSON in a textarea. The admin edits
 * inline, the schema description sits below as a reference, and Save /
 * Reset to defaults pipe through the server actions in ./actions.ts.
 *
 * Why JSON-in-a-textarea: the four section shapes are varied enough (some
 * have arrays, some have nested objects, some are flat) that a single
 * generic UI would be either fragile or overbuilt. JSON is the lowest-
 * friction shared denominator, the server validates strictly with Zod, and
 * the UNCONFIGURED → defaults fallback means a typo is recoverable in one
 * click.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { saveSectionContent, resetSectionToDefaults } from './actions'

export function SectionEditor({
  sectionKey,
  initialJson,
  schemaHelp,
}: {
  sectionKey: string
  initialJson: string
  schemaHelp: string
}) {
  const [text, setText] = useState(initialJson)
  const [message, setMessage] = useState<{
    kind: 'success' | 'error'
    text: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await saveSectionContent(sectionKey, text)
      if (res.ok) {
        setMessage({ kind: 'success', text: 'Saved. Homepage refreshed.' })
      } else {
        setMessage({ kind: 'error', text: res.error })
      }
    })
  }

  const handleReset = () => {
    if (!confirm('Reset this section to the built-in defaults? Your current changes will be lost.')) return
    setMessage(null)
    startTransition(async () => {
      const res = await resetSectionToDefaults(sectionKey)
      if (res.ok) {
        setMessage({
          kind: 'success',
          text: 'Reset to defaults. Reload this page to load the default text into the editor.',
        })
      } else {
        setMessage({ kind: 'error', text: res.error })
      }
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/admin/content/site"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← All sections
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={pending}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded border p-3 text-sm ${
            message.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-rose-300 bg-rose-50 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={26}
        className="w-full rounded-lg border border-neutral-300 bg-white p-4 font-mono text-[13px] leading-relaxed text-neutral-900 focus:border-neutral-500 focus:outline-none"
      />

      <details className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <summary className="cursor-pointer font-medium text-neutral-900">
          Field reference for this section
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] text-neutral-700">
          {schemaHelp}
        </pre>
      </details>
    </div>
  )
}
