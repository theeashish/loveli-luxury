'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/**
 * Anchor that gently follows the cursor on hover. Subtle by default
 * (8px max pull) — too much makes a button feel unstable. Falls back
 * to a normal Link on touch devices because there's no hover.
 */
export function MagneticLink({
  href,
  children,
  className,
  pull = 12,
}: {
  href: string
  children: React.ReactNode
  className?: string
  pull?: number
}) {
  const ref = useRef<HTMLAnchorElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 })

  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    x.set(dx * pull)
    y.set(dy * pull)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.span style={{ x: sx, y: sy }} className="inline-block">
      <Link
        ref={ref}
        href={href}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={className}
      >
        {children}
      </Link>
    </motion.span>
  )
}
