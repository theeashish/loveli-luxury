'use client'

import { useState } from 'react'

/**
 * Tiny copy-to-clipboard button. We don't surface clipboard errors — a
 * silently un-copied link is recoverable by selecting the text manually,
 * which is right next to the button.
 */
export function CopyButton({
  value,
  children,
}: {
  value: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-xs uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))]"
    >
      {copied ? 'Copied' : children}
    </button>
  )
}
