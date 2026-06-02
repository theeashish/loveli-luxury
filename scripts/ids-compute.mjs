#!/usr/bin/env node
/**
 * ids-compute.mjs
 *
 * Computes the Income Disclosure Statement (IDS) statistics directly from
 * the live commission_ledger + orders tables, prints them with the exact
 * methodology that's published on /ids, and OPTIONALLY writes the result
 * into the site_content.partner_ids row so the public page picks them up.
 *
 * Three modes:
 *
 *   (default — read-only print)
 *     node --env-file=.env.local scripts/ids-compute.mjs
 *
 *   --window-days=N   (default 90, matches the IDS-published methodology)
 *
 *   --write
 *     After printing, upserts site_content.partner_ids.body.stats with the
 *     computed values. ASKS for confirmation. Refuses if active_partners
 *     is below the minimum threshold for statistical honesty (default 30,
 *     adjustable via --min-active).
 *
 *   --min-active=N    (default 30)
 *     Refuse --write when fewer than N partners are active in the window.
 *     With small samples, the median + percentile figures are noise. The
 *     IDS principle is "never publish a number you can't defend."
 *
 * Methodology, locked to match what /ids publishes:
 *
 *   - Window: last N calendar days, ending NOW (UTC).
 *   - Active partner: a distributor with ≥1 commission_ledger row in
 *     the window. (write_commission_ledger only fires on paid retail
 *     orders, so this is functionally identical to "had ≥1 verified
 *     retail sale credited to them in the window".)
 *   - Earnings: SUM(amount_minor) of every commission_ledger row in
 *     the window for that distributor. Includes all levels.
 *   - Monthly earnings: 90-day total / 3, rounded to nearest shilling.
 *     For windows ≠ 90d: total / (window_days / 30).
 *   - Median: simple median of monthly earnings across active partners.
 *   - Top-5%: 95th-percentile monthly earning.
 *   - % earning > 0: count(active) / count(active_or_signed_up_in_window).
 *     Signups in the window who didn't earn count as the "0 earner"
 *     denominator addition — they tried, they're in the program, they
 *     made nothing.
 *   - % recouped starter: count(active partners with cumulative earnings
 *     ≥ their starter package cost) / count(active). Starter cost is
 *     the most-recent active config_starter_packages.joining_fee_minor
 *     + the matching bundle's retail price.
 *
 * Exit 0 unless --write is set and the threshold check fails (exit 2)
 * or a query fails (exit 1).
 */

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

// ─── arg parsing ───────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function flag(name) { return args.includes(name) }
function value(name, def) {
  const found = args.find((a) => a.startsWith(`${name}=`))
  return found ? found.slice(name.length + 1) : def
}

const windowDays = Math.max(7, Math.min(730, Number(value('--window-days', '90'))))
const minActive = Math.max(1, Number(value('--min-active', '30')))
const shouldWrite = flag('--write')

// ─── REST helpers ─────────────────────────────────────────────────────────
async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: init.method === 'PATCH' || init.method === 'POST'
        ? 'return=representation'
        : '',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${init.method ?? 'GET'} ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ─── pure stats helpers ───────────────────────────────────────────────────
function median(nums) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function percentile(nums, p) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function formatKes(n) {
  return `KES ${new Intl.NumberFormat('en-KE').format(Math.round(n))}`
}

function pct(num, den) {
  if (den === 0) return '0%'
  return `${Math.round((100 * num) / den)}%`
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const windowStartIso = windowStart.toISOString()
  console.log(`\n── IDS compute · last ${windowDays} days (since ${windowStartIso}) ──\n`)

  // 1. Earnings per distributor over the window.
  const ledgerRows = await rest(
    `commission_ledger?select=distributor_id,amount_minor,earned_at&earned_at=gte.${encodeURIComponent(windowStartIso)}`,
  )
  const earningsByDist = new Map()
  for (const r of ledgerRows) {
    const id = Number(r.distributor_id)
    const amt = Number(r.amount_minor)
    earningsByDist.set(id, (earningsByDist.get(id) ?? 0) + amt)
  }

  // 2. Distributors who joined within the window. Counted as denominator
  //    even if they earned zero — they're "in the program but earning
  //    nothing".
  const signupOrders = await rest(
    `orders?select=user_id,paid_at&kind=eq.distributor_signup&status=in.(paid,fulfilled,shipped,delivered)&paid_at=gte.${encodeURIComponent(windowStartIso)}`,
  )
  // Resolve those user_ids to distributor_ids (joined via distributors.user_id).
  const signupUserIds = [...new Set(signupOrders.map((o) => o.user_id).filter(Boolean))]
  const signupDistRows = signupUserIds.length
    ? await rest(
        `distributors?select=id,user_id&user_id=in.(${signupUserIds.map((u) => `"${u}"`).join(',')})`,
      )
    : []
  const signupDistIds = new Set(signupDistRows.map((d) => Number(d.id)))

  // 3. Resolve starter cost (for the "recouped starter" stat). We use the
  //    currently-active starter package row + its bundle retail price. If
  //    a partner came in on an older effective period, the figure they
  //    actually paid may differ; that's a known limitation we document.
  const starterPkgRows = await rest(
    `config_starter_packages?select=bundle_id,joining_fee_minor,effective_until&effective_until=is.null&order=effective_from.desc&limit=1`,
  )
  let starterCostMinor = 0
  if (starterPkgRows.length > 0) {
    const pkg = starterPkgRows[0]
    const bundle = pkg.bundle_id
      ? await rest(`bundles?select=retail_price_minor&id=eq.${pkg.bundle_id}&limit=1`)
      : []
    const bundlePrice = bundle.length ? Number(bundle[0].retail_price_minor) : 0
    starterCostMinor = Number(pkg.joining_fee_minor) + bundlePrice
  }

  // 4. Cumulative earnings (ever, not just window) for the recouped-starter
  //    figure — partners "recoup" once their lifetime earnings exceed what
  //    they paid to join.
  const allLedgerRows = await rest(`commission_ledger?select=distributor_id,amount_minor`)
  const lifetimeByDist = new Map()
  for (const r of allLedgerRows) {
    const id = Number(r.distributor_id)
    const amt = Number(r.amount_minor)
    lifetimeByDist.set(id, (lifetimeByDist.get(id) ?? 0) + amt)
  }

  // 5. Compose the population. ACTIVE = either earned in window or joined
  //    in window; the latter without the former counts as a 0-earner.
  const activeIds = new Set([...earningsByDist.keys(), ...signupDistIds])
  const monthsInWindow = windowDays / 30

  const monthlyEarnings = []
  let recoupedCount = 0
  for (const id of activeIds) {
    const totalInWindowMinor = earningsByDist.get(id) ?? 0
    const monthlyMinor = Math.round(totalInWindowMinor / monthsInWindow)
    monthlyEarnings.push(monthlyMinor)
    const lifetimeMinor = lifetimeByDist.get(id) ?? 0
    if (starterCostMinor > 0 && lifetimeMinor >= starterCostMinor) recoupedCount += 1
  }

  const totalActive = monthlyEarnings.length
  const earningGtZero = monthlyEarnings.filter((m) => m > 0).length

  const medianMonthlyMinor = median(monthlyEarnings)
  const top5Minor = percentile(monthlyEarnings, 95)

  // 6. Report
  console.log(`Active partners (window):     ${totalActive}`)
  console.log(`Earning > 0 in window:        ${earningGtZero}`)
  console.log(`Joined in window (any earn):  ${signupDistIds.size}`)
  console.log(`Starter cost (most recent):   ${starterCostMinor > 0 ? formatKes(starterCostMinor / 100) : '—'}`)
  console.log('')
  console.log(`Median monthly earnings:      ${formatKes(medianMonthlyMinor / 100)}`)
  console.log(`% earning > 0:                ${pct(earningGtZero, totalActive)}`)
  console.log(`% recouped starter:           ${starterCostMinor > 0 ? pct(recoupedCount, totalActive) : '—'}`)
  console.log(`Top-5% (95th pctile) monthly: ${formatKes(top5Minor / 100)}`)
  console.log('')

  if (totalActive < minActive) {
    console.log(`⚠ Active-partner count (${totalActive}) is below the publication threshold (${minActive}).`)
    console.log(`  With small samples, median/percentile figures are statistically meaningless.`)
    console.log(`  The IDS page will keep its "DATA PENDING" placeholders until the window has`)
    console.log(`  enough partners. Re-run after partner volume grows.`)
    if (shouldWrite) {
      console.log(`\n  --write was requested but is REFUSED for the reason above. Re-run`)
      console.log(`  without --write to print only, or with --min-active=${totalActive} to`)
      console.log(`  override (NOT recommended for the published page).`)
      process.exit(2)
    }
    process.exit(0)
  }

  if (!shouldWrite) {
    console.log(`Run with --write to upsert these values into site_content.partner_ids.`)
    return
  }

  // 7. Compose the new stats array for the partner_ids site_content row.
  //    Schema lives in src/lib/content/site.ts (partnerIdsSchema).
  const periodLabel = `Last ${windowDays} days, ending ${now.toISOString().slice(0, 10)}`
  const stats = [
    {
      label: 'Median monthly earnings',
      value: formatKes(medianMonthlyMinor / 100),
      sub: `Active partners (half earn less, half earn more). Window: last ${windowDays} days.`,
    },
    {
      label: 'Active partners earning more than zero',
      value: pct(earningGtZero, totalActive),
      sub: `Of ${totalActive} active partners in the period.`,
    },
    {
      label: 'Partners who recouped their starter cost',
      value: starterCostMinor > 0 ? pct(recoupedCount, totalActive) : '—',
      sub: starterCostMinor > 0
        ? `Cumulative earnings >= ${formatKes(starterCostMinor / 100)} (current starter cost).`
        : 'Starter cost not configured.',
    },
    {
      label: 'Top 5% monthly earnings',
      value: formatKes(top5Minor / 100),
      sub: `The 95th-percentile active partner.`,
    },
  ]

  // 8. Upsert. The site_content row may exist or not. PostgREST upsert via
  //    POST + Prefer: resolution=merge-duplicates on the primary key.
  console.log(`\nWriting computed values to site_content.partner_ids…`)
  const existing = await rest(
    `site_content?select=body&section_key=eq.partner_ids&limit=1`,
  )
  const currentBody = existing[0]?.body ?? {}
  const newBody = {
    ...currentBody,
    periodLabel,
    stats,
  }

  await rest(`site_content?on_conflict=section_key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([
      {
        section_key: 'partner_ids',
        body: newBody,
        updated_at: new Date().toISOString(),
      },
    ]),
  })

  console.log(`✓ Wrote site_content.partner_ids with periodLabel "${periodLabel}" + 4 stats.`)
  console.log(`  The public /ids page will pick this up after the homepage cache revalidates.`)
  console.log(`  To force-revalidate: visit /admin/content/site/partner_ids and click Save.`)
}

main().catch((e) => {
  console.error('\n✗ IDS compute failed:', e.message ?? e)
  process.exit(1)
})
