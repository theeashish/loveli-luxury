/**
 * HighlightText — render *single-asterisk* spans as italic + primary-color
 * emphasis. Editor-friendly markup that lets admins write copy like
 * "Things people *ask*." without touching HTML.
 *
 * Pure component, no client-side state — usable in server components.
 */

import React from 'react'

const HIGHLIGHT_RE = /(\*[^*]+\*)/g

export function HighlightText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const parts = text.split(HIGHLIGHT_RE)
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
          <em
            key={i}
            className="italic text-[hsl(var(--primary))]"
          >
            {part.slice(1, -1)}
          </em>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  )
}
