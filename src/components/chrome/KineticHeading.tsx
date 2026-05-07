'use client'

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Splits children (rendered as a single string per slot) into per-word
 * spans and reveals them in a slow stagger from below the line. Use slots
 * to interleave styled emphasis (e.g. italic gold "Elegance"):
 *
 *   <KineticHeading className="...">
 *     <Slot>The Scent of</Slot>
 *     <Slot italic gold>Elegance</Slot>
 *     <Slot>, Bottled.</Slot>
 *   </KineticHeading>
 */
const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
}

const word: Variants = {
  hidden: { y: '110%', opacity: 0 },
  show: {
    y: '0%',
    opacity: 1,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
  },
}

export function KineticHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.h1
      initial="hidden"
      animate="show"
      variants={container}
      className={className}
    >
      {children}
    </motion.h1>
  )
}

export function Slot({
  children,
  italic,
  gold,
}: {
  children: string
  italic?: boolean
  gold?: boolean
}) {
  const words = children.split(' ').filter(Boolean)
  return (
    <span className={italic ? 'italic' : undefined}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-block overflow-hidden align-baseline pb-1">
          <motion.span
            variants={word}
            className={`inline-block ${gold ? 'text-[hsl(var(--primary))]' : ''}`}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
