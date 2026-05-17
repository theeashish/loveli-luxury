'use client'

import { useState } from 'react'

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          },
          () => {
            // fail silently — fallback is just-read-the-code
          },
        )
      }}
      className="rounded-md border border-emerald-400 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-800 transition hover:bg-emerald-100"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}
