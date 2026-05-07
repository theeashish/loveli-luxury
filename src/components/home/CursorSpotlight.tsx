'use client'

import { useEffect, useRef } from 'react'

/**
 * Soft gold spotlight that follows the cursor inside its parent.
 * The parent must be `position: relative` and clip overflow.
 */
export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return
    // Centre by default so reduced-motion users still see something pretty.
    el.style.setProperty('--mx', '50%')
    el.style.setProperty('--my', '40%')
    const onMove = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--mx', `${x}%`)
      el.style.setProperty('--my', `${y}%`)
    }
    parent.addEventListener('mousemove', onMove)
    return () => parent.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700"
      style={{
        background:
          'radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), hsl(38 56% 60% / 0.18), transparent 70%)',
      }}
    />
  )
}
