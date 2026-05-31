#!/usr/bin/env node
/**
 * optimize-product-images.mjs
 *
 * Production-image optimizer for Loveli Luxury Scents fragrance renders.
 *
 * Reads raw AI-generated images from public/_inbox/{slug}.{ext} and produces
 * public/products/{slug}.jpg, sized and compressed to the perf budget the
 * masterplan documents:
 *   - 3:4 vertical (centered crop)
 *   - Longest edge 1600 px
 *   - JPG, ~150–250 KB each (re-quality if first attempt overshoots)
 *
 * Uses the `sharp` dep that already ships with the app (no extra install).
 * Pure Node ES module; run from the loveli-luxury/ directory:
 *
 *   node scripts/optimize-product-images.mjs
 *
 * Per the photography brief, the expected slugs are the nine homepage
 * fragrances + an optional hero. Any inbox file matching one of these names
 * is processed; the rest are reported and skipped.
 */
import { readdir, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, parse } from 'node:path'

const ROOT = process.cwd()
const INBOX = join(ROOT, 'public', '_inbox')
const OUTDIR = join(ROOT, 'public', 'products')

// Slugs that the site expects. Match docs/photography-render-brief-2026-05.md.
const EXPECTED_SLUGS = new Set([
  'ocean-desire',
  'coastal-sage',
  'crimson-noir',
  'black-torque',
  'afar',
  'vanilla-smoke',
  'sunset-bliss',
  'pink-allure',
  'orange-aura',
  'hero', // optional
])

const TARGET = {
  // 3:4 vertical. Longest edge = 1600 → height 1600, width 1200.
  width: 1200,
  height: 1600,
  // Byte budget. The optimizer iterates quality downward until we land in range.
  minBytes: 150 * 1024,
  maxBytes: 250 * 1024,
  // Starting JPG quality. Drops by 5 each retry until the budget is met or
  // quality bottoms out at 50 (lower than this is visibly poor).
  qualityStart: 88,
  qualityFloor: 50,
}

async function loadSharp() {
  try {
    const mod = await import('sharp')
    return mod.default ?? mod
  } catch (e) {
    console.error(
      '\nERROR: could not load `sharp`. It should already be installed.\n' +
        'If this is a fresh checkout, run `npm install` first.\n',
    )
    console.error(e.message)
    process.exit(1)
  }
}

function pretty(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

/**
 * Auto-crop to 3:4 by computing the largest 3:4 rectangle that fits inside the
 * source dimensions, centered. Then resize to TARGET.width x TARGET.height
 * (Lanczos), encode JPG, iterate quality down until the byte budget is met or
 * we hit the floor.
 */
async function optimizeOne(sharp, srcPath, slug) {
  const img = sharp(srcPath, { failOn: 'none' })
  const meta = await img.metadata()
  if (!meta.width || !meta.height) {
    return { slug, ok: false, error: 'unreadable image' }
  }

  // Largest centered 3:4 rectangle inside (w × h). target ratio = 3/4 = 0.75.
  let cropW, cropH
  const ratio = meta.width / meta.height
  if (ratio > 0.75) {
    // Source is wider than 3:4 → height is the limit.
    cropH = meta.height
    cropW = Math.round(cropH * 0.75)
  } else {
    // Source is taller than 3:4 → width is the limit.
    cropW = meta.width
    cropH = Math.round(cropW / 0.75)
  }
  const left = Math.round((meta.width - cropW) / 2)
  const top = Math.round((meta.height - cropH) / 2)

  let q = TARGET.qualityStart
  let buf
  let attempt = 0
  while (q >= TARGET.qualityFloor) {
    attempt += 1
    buf = await sharp(srcPath, { failOn: 'none' })
      .extract({ left, top, width: cropW, height: cropH })
      .resize(TARGET.width, TARGET.height, {
        fit: 'cover',
        position: 'centre',
        kernel: 'lanczos3',
      })
      .jpeg({ quality: q, progressive: true, mozjpeg: true })
      .toBuffer()
    if (buf.length <= TARGET.maxBytes) break
    q -= 5
  }

  if (!buf) return { slug, ok: false, error: 'no encode' }

  const outPath = join(OUTDIR, `${slug}.jpg`)
  await sharp(buf).toFile(outPath)

  // Re-stat for a precise size after disk write.
  const st = await stat(outPath)
  return {
    slug,
    ok: true,
    bytes: st.size,
    quality: q,
    attempts: attempt,
    sourceDims: `${meta.width}×${meta.height}`,
    outDims: `${TARGET.width}×${TARGET.height}`,
    inBudget: st.size >= TARGET.minBytes && st.size <= TARGET.maxBytes,
  }
}

async function main() {
  await ensureDir(OUTDIR)
  if (!existsSync(INBOX)) {
    console.log(`No inbox at ${INBOX}. Create it and drop raw AI renders in.`)
    console.log('Each file should be named {slug}.{ext}, e.g. ocean-desire.png.')
    process.exit(0)
  }

  const sharp = await loadSharp()
  const files = await readdir(INBOX)
  const work = []
  const skipped = []
  for (const f of files) {
    const { name } = parse(f)
    if (EXPECTED_SLUGS.has(name)) {
      work.push({ file: f, slug: name })
    } else {
      skipped.push(f)
    }
  }

  if (skipped.length) {
    console.log(`Skipping ${skipped.length} file(s) with no matching slug:`)
    for (const s of skipped) console.log(`  ${s}`)
    console.log('')
  }
  if (!work.length) {
    console.log('No matching files to optimize. Expected slugs:')
    for (const s of EXPECTED_SLUGS) console.log(`  ${s}.{ext}`)
    process.exit(0)
  }

  console.log(`Optimizing ${work.length} file(s) → ${OUTDIR}\n`)
  const results = []
  for (const w of work) {
    const srcPath = join(INBOX, w.file)
    try {
      const r = await optimizeOne(sharp, srcPath, w.slug)
      results.push(r)
      if (r.ok) {
        const flag = r.inBudget ? 'OK     ' : 'OVER   '
        console.log(
          `${flag} ${w.slug.padEnd(16)} ${r.sourceDims.padEnd(11)} → ${r.outDims}   ${pretty(r.bytes).padStart(7)}   q=${r.quality}`,
        )
      } else {
        console.log(`FAIL   ${w.slug.padEnd(16)} ${r.error}`)
      }
    } catch (e) {
      console.log(`FAIL   ${w.slug.padEnd(16)} ${e.message}`)
      results.push({ slug: w.slug, ok: false, error: e.message })
    }
  }

  const overs = results.filter((r) => r.ok && !r.inBudget)
  if (overs.length) {
    console.log(
      `\n${overs.length} image(s) above the ${pretty(TARGET.maxBytes)} budget even at q=${TARGET.qualityFloor}.`,
    )
    console.log(
      'These will still ship (over-budget images are not blocked), but consider regenerating with simpler backgrounds.',
    )
  }
  const fails = results.filter((r) => !r.ok)
  if (fails.length) process.exit(1)
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
