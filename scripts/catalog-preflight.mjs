#!/usr/bin/env node
/**
 * catalog-preflight.mjs
 *
 * Audits the live catalog against the launch requirements and tells the
 * operator exactly what's missing per fragrance. Run this repeatedly while
 * Ruth is seeding the 9 launch products via /admin/catalog, to track
 * progress and catch missing fields before launch.
 *
 * Each fragrance needs ALL of:
 *   - a products row with the expected slug, name, is_active=TRUE, description
 *   - at least one ACTIVE product_variants row with size_ml=50, pv_per_bottle=700,
 *     retail_price_minor=280000, distributor_price_minor=140000, inventory_qty>0
 *   - at least one product_images row (homepage card + PDP gallery need it)
 *   - a product_fragrance_meta row (PDP detail block)
 *
 * Reads via direct PostgREST fetch using the service-role key — same surface
 * production uses, no realtime/websocket dependency.
 *
 *   node --env-file=.env.local scripts/catalog-preflight.mjs
 *   npm run catalog:preflight
 *
 * Exit code 0 if every required field is present on every required slug, 1
 * otherwise.
 */

const EXPECTED_SLUGS = [
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

// Launch-ready variant shape, locked by the adopted comp plan.
const REQUIRED = {
  size_ml: 50,
  pv_per_bottle: 700,
  retail_price_minor: 280000, // KES 2,800
  distributor_price_minor: 140000, // KES 1,400
  min_inventory_qty: 1,
}

function envOrExit(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`✗ ${name} unset. Pull env first: vercel env pull .env.local`)
    process.exit(1)
  }
  return v
}

const SUPABASE_URL = envOrExit('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
const SERVICE_KEY = envOrExit('SUPABASE_SERVICE_ROLE_KEY')

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostgREST ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function loadCatalog() {
  const [products, variants, images, metas] = await Promise.all([
    rest('products?select=id,slug,name,description,is_active,created_at&order=slug'),
    rest(
      'product_variants?select=id,product_id,sku,size_ml,retail_price_minor,distributor_price_minor,pv_per_bottle,inventory_qty,is_active',
    ),
    rest('product_images?select=id,product_id'),
    rest('product_fragrance_meta?select=product_id'),
  ])
  return { products, variants, images, metas }
}

function pretty(n) {
  return new Intl.NumberFormat('en-KE').format(n)
}

function checkSlug(slug, catalog) {
  const p = catalog.products.find((x) => x.slug === slug)
  if (!p) return { slug, status: 'MISSING', issues: ['product row missing'] }

  const issues = []
  if (!p.is_active) issues.push('product is_active=false')
  if (!p.description || p.description.trim().length < 10) {
    issues.push('description missing or too short (<10 chars)')
  }

  const variants = catalog.variants.filter((v) => v.product_id === p.id && v.is_active)
  if (variants.length === 0) {
    issues.push('no active variant')
  } else {
    const v = variants.find((x) => x.size_ml === REQUIRED.size_ml) ?? variants[0]
    if (v.size_ml !== REQUIRED.size_ml) {
      issues.push(`active variant size=${v.size_ml}ml, expected ${REQUIRED.size_ml}ml`)
    }
    if (Number(v.pv_per_bottle) !== REQUIRED.pv_per_bottle) {
      issues.push(`pv_per_bottle=${v.pv_per_bottle}, expected ${REQUIRED.pv_per_bottle}`)
    }
    if (Number(v.retail_price_minor) !== REQUIRED.retail_price_minor) {
      issues.push(
        `retail_price_minor=${v.retail_price_minor}, expected ${REQUIRED.retail_price_minor} (KES ${pretty(REQUIRED.retail_price_minor / 100)})`,
      )
    }
    if (Number(v.distributor_price_minor) !== REQUIRED.distributor_price_minor) {
      issues.push(
        `distributor_price_minor=${v.distributor_price_minor}, expected ${REQUIRED.distributor_price_minor} (KES ${pretty(REQUIRED.distributor_price_minor / 100)})`,
      )
    }
    if (Number(v.inventory_qty) < REQUIRED.min_inventory_qty) {
      issues.push(`inventory_qty=${v.inventory_qty}, expected at least ${REQUIRED.min_inventory_qty}`)
    }
  }

  if (catalog.images.filter((i) => i.product_id === p.id).length === 0) {
    issues.push('no product_images row (homepage card + PDP gallery will be blank)')
  }

  if (!catalog.metas.find((m) => m.product_id === p.id)) {
    issues.push('product_fragrance_meta missing (PDP detail block will not render)')
  }

  return {
    slug,
    status: issues.length === 0 ? 'OK' : 'INCOMPLETE',
    productId: p.id,
    issues,
  }
}

async function main() {
  const catalog = await loadCatalog()

  console.log('\nCatalog launch-readiness preflight')
  console.log('  (run `npm run catalog:preflight` to re-check after edits)\n')

  const results = EXPECTED_SLUGS.map((slug) => checkSlug(slug, catalog))
  const okCount = results.filter((r) => r.status === 'OK').length

  for (const r of results) {
    const tag =
      r.status === 'OK' ? '✓ OK         ' : r.status === 'MISSING' ? '✗ MISSING    ' : '⚠ INCOMPLETE '
    const id = r.productId ? `(id=${r.productId})` : ''
    console.log(`  ${tag} ${r.slug.padEnd(15)} ${id}`)
    for (const issue of r.issues) console.log(`               · ${issue}`)
  }

  // Test-SKU detection: anything in products NOT in the expected set
  const unexpected = catalog.products.filter(
    (p) => !EXPECTED_SLUGS.includes(p.slug) && p.is_active,
  )
  if (unexpected.length > 0) {
    console.log('\n  Active products NOT in the launch set (consider deactivating):')
    for (const p of unexpected) {
      console.log(`    · ${p.slug.padEnd(15)} "${p.name}" id=${p.id}`)
    }
  }

  console.log(`\n${okCount}/${EXPECTED_SLUGS.length} launch slugs ready.`)
  if (okCount < EXPECTED_SLUGS.length) {
    console.log('See docs/catalog-seeding-playbook.md for the per-slug seeding steps.')
    process.exit(1)
  }
  console.log('Catalog is launch-ready.')
}

main().catch((e) => {
  console.error('\n✗ Preflight failed:', e.message ?? e)
  process.exit(1)
})
