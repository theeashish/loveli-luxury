#!/usr/bin/env node
/**
 * verify-product-images.mjs
 *
 * Checks every expected product image in public/products/ against the brand +
 * perf rules from docs/photography-render-brief-2026-05.md:
 *
 *   - Exists with the correct slug.
 *   - Is a JPG (the next/image pipeline + sharp config assume JPG/PNG → optimized).
 *   - 3:4 vertical (±2% tolerance — generation rarely lands on an exact pixel ratio).
 *   - Between 80 KB and 300 KB (hard cap; the optimizer aims for 150–250 KB).
 *   - Has reasonable dimensions (we don't want a 400 px image masquerading as
 *     a hero).
 *
 * Run after `scripts/optimize-product-images.mjs`:
 *
 *   node scripts/verify-product-images.mjs
 *
 * Exit 0 = all good. Exit 1 = at least one image failed a hard rule (missing,
 * wrong format, way out of size). Warnings (soft tolerances) print but don't
 * fail the script.
 */
import { stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DIR = join(ROOT, 'public', 'products')

// Required slugs (homepage grid). hero is optional.
const REQUIRED = [
  'ocean-desire',
  'coastal-sage',
  'crimson-noir',
  'black-torque',
  'afar',
  'vanilla-smoke',
  'sunset-bliss',
  'pink-allure',
  'orange-aura',
]
const OPTIONAL = ['hero']

const RULES = {
  minBytes: 80 * 1024,
  maxBytes: 300 * 1024,
  // 3:4 (height/width = 4/3 = 1.333). Allow ±2% drift.
  targetRatio: 4 / 3,
  ratioTolerance: 0.02,
  minLongEdge: 800,
}

/** Parse JPG dimensions from a SOF marker. Pure Node, no deps. */
function jpgDimensions(buf) {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return null // not a JPG
  let i = 2
  while (i < buf.length) {
    while (buf[i] !== 0xff && i < buf.length) i += 1
    while (buf[i] === 0xff && i < buf.length) i += 1
    const marker = buf[i]
    // SOF0..SOF15 (skip SOF4 = DHT and SOF8/SOFC are different segments — these
    // marker ranges are the standard "frame-with-dimensions" set).
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const h = (buf[i + 4] << 8) | buf[i + 5]
      const w = (buf[i + 6] << 8) | buf[i + 7]
      return { width: w, height: h }
    }
    // Skip this segment: 2-byte segment length follows marker.
    const segLen = (buf[i + 1] << 8) | buf[i + 2]
    i += 1 + segLen
  }
  return null
}

async function checkOne(slug, required) {
  const path = join(DIR, `${slug}.jpg`)
  const errors = []
  const warnings = []
  if (!existsSync(path)) {
    if (required) errors.push('missing')
    else return { slug, errors: [], warnings: ['optional, not present'], skipped: true }
    return { slug, errors, warnings }
  }
  const st = await stat(path)
  const bytes = st.size
  if (bytes < RULES.minBytes) {
    warnings.push(`small file (${(bytes / 1024).toFixed(0)} KB < ${RULES.minBytes / 1024} KB) — likely under-rendered`)
  }
  if (bytes > RULES.maxBytes) {
    errors.push(`oversize file (${(bytes / 1024).toFixed(0)} KB > ${RULES.maxBytes / 1024} KB) — re-run optimizer`)
  }
  const buf = readFileSync(path)
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) {
    errors.push('not a JPG (magic bytes mismatch)')
    return { slug, errors, warnings, bytes }
  }
  const dims = jpgDimensions(buf)
  if (!dims) {
    errors.push('could not parse JPG dimensions')
    return { slug, errors, warnings, bytes }
  }
  const ratio = dims.height / dims.width
  const ratioOff = Math.abs(ratio - RULES.targetRatio) / RULES.targetRatio
  if (ratioOff > RULES.ratioTolerance) {
    errors.push(
      `aspect ratio ${(ratio).toFixed(3)} (h/w) — expected ${RULES.targetRatio.toFixed(3)} (3:4) ±${(RULES.ratioTolerance * 100).toFixed(0)}%`,
    )
  }
  const longEdge = Math.max(dims.width, dims.height)
  if (longEdge < RULES.minLongEdge) {
    warnings.push(`small render (long edge ${longEdge} px < ${RULES.minLongEdge} px)`)
  }
  return { slug, errors, warnings, bytes, dims }
}

function pretty(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`No directory at ${DIR}.`)
    process.exit(1)
  }

  const all = []
  for (const slug of REQUIRED) all.push(await checkOne(slug, true))
  for (const slug of OPTIONAL) all.push(await checkOne(slug, false))

  let hardFails = 0
  console.log('\nProduct-image verification:\n')
  console.log('  Slug              Status   Size      Dims        Notes')
  console.log('  ─────────────────────────────────────────────────────────────────')
  for (const r of all) {
    if (r.skipped) {
      console.log(`  ${r.slug.padEnd(16)}  -        -         -           optional, absent`)
      continue
    }
    const status = r.errors.length > 0 ? 'FAIL ' : r.warnings.length > 0 ? 'WARN ' : 'OK   '
    if (r.errors.length > 0) hardFails += 1
    const sizeStr = r.bytes ? pretty(r.bytes).padStart(8) : '   -    '
    const dimsStr = r.dims ? `${r.dims.width}×${r.dims.height}`.padEnd(11) : '-          '
    const notes = [...r.errors, ...r.warnings].join('; ')
    console.log(`  ${r.slug.padEnd(16)}  ${status}    ${sizeStr}  ${dimsStr}  ${notes}`)
  }

  console.log('')
  if (hardFails === 0) {
    console.log('All required images present and within rules.')
    process.exit(0)
  }
  console.log(`${hardFails} required image(s) failed verification.`)
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
