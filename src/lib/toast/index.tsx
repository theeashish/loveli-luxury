'use client'

/**
 * Lightweight toast system — drop-in replacement for the sonner subset we use.
 *
 * Compressed footprint: ~1.5 kB minified + gzipped (vs. sonner's ~17 kB).
 * The trade-off: no rich-color variants, no swipe-to-dismiss, no virtualised
 * stacking. Toasts here render at the top-right corner with a subtle slide-in
 * and auto-dismiss after 4 s (errors stay for 6 s).
 *
 * Public API (matches the `toast` import we already use 8× across the app):
 *
 *   import { toast } from '@/lib/toast'
 *   toast.success('Added to cart')
 *   toast.success('Bundle saved', { description: name })
 *   toast.error('Save failed', { description: err.message })
 *
 * Mount the renderer ONCE per layout (mirrors sonner):
 *
 *   import { Toaster } from '@/lib/toast'
 *   <Toaster />
 *
 * The store is a tiny module-level pubsub so calls from server-rendered code
 * paths still queue correctly once a `<Toaster />` is on the page.
 */

import { useEffect, useState } from 'react'

type Kind = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  kind: Kind
  message: string
  description?: string
}

let counter = 0
const subs = new Set<(items: ToastItem[]) => void>()
let queue: ToastItem[] = []

function publish() {
  for (const s of subs) s(queue)
}

function push(kind: Kind, message: string, opts?: { description?: string }) {
  if (typeof message !== 'string' || !message) return
  const item: ToastItem = { id: ++counter, kind, message, description: opts?.description }
  queue = [...queue, item]
  publish()
  const ttl = kind === 'error' ? 6000 : 4000
  setTimeout(() => {
    queue = queue.filter((q) => q.id !== item.id)
    publish()
  }, ttl)
}

export const toast = {
  success: (message: string, opts?: { description?: string }) => push('success', message, opts),
  error: (message: string, opts?: { description?: string }) => push('error', message, opts),
  info: (message: string, opts?: { description?: string }) => push('info', message, opts),
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(queue)
  useEffect(() => {
    subs.add(setItems)
    return () => {
      subs.delete(setItems)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={[
            'pointer-events-auto rounded-md border bg-[hsl(var(--background))] px-4 py-3 text-sm shadow-md ring-1 ring-black/5 transition-all',
            t.kind === 'success'
              ? 'border-emerald-500/30 text-[hsl(var(--foreground))]'
              : t.kind === 'error'
                ? 'border-red-500/40 text-[hsl(var(--foreground))]'
                : 'border-[hsl(var(--border))]/60 text-[hsl(var(--foreground))]',
          ].join(' ')}
          style={{ animation: 'll-toast-in 200ms ease-out' }}
        >
          <p className="font-medium">{t.message}</p>
          {t.description ? (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{t.description}</p>
          ) : null}
        </div>
      ))}
      {/* keyframe inlined to avoid a global-CSS edit and to keep this module
          fully self-contained. ~80 bytes. */}
      <style>{`@keyframes ll-toast-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
