'use client'

import { useEffect, useRef } from 'react'

/**
 * Custom cursor: a small filled dot + a larger outline ring that lags
 * slightly behind. The ring grows when hovering interactive elements
 * (anchors, buttons, [data-cursor]). The native cursor stays visible
 * (we don't hide it) so the page is fully usable on devices that don't
 * support hover.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let rx = mx
    let ry = my
    let raf = 0

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`
    }
    const loop = () => {
      rx += (mx - rx) * 0.18
      ry += (my - ry) * 0.18
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(loop)
    }

    const interactive = 'a, button, [role="button"], input, select, textarea, [data-cursor="hover"]'
    const onOver = (e: Event) => {
      const t = e.target as Element | null
      if (t && t.closest && t.closest(interactive)) {
        ring.classList.add('ring-hovered')
      }
    }
    const onOut = (e: Event) => {
      const t = e.target as Element | null
      if (t && t.closest && t.closest(interactive)) {
        ring.classList.remove('ring-hovered')
      }
    }

    document.body.classList.add('has-custom-cursor')
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.body.classList.remove('has-custom-cursor')
    }
  }, [])

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="custom-cursor-dot pointer-events-none fixed left-0 top-0 z-[100] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--primary))] mix-blend-difference"
      />
      <div
        ref={ringRef}
        aria-hidden
        className="custom-cursor-ring pointer-events-none fixed left-0 top-0 z-[99] h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[hsl(var(--primary))]/70 transition-[width,height,opacity] duration-300"
      />
    </>
  )
}
