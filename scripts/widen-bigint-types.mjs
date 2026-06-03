/**
 * Post-process Supabase-generated database.ts to widen BIGINT columns the
 * codebase stringifies. The generator emits BIGINT as `number`, but
 * supabase-js round-trips BIGINT as a string when the value exceeds
 * Number.MAX_SAFE_INTEGER — so the safe runtime type is `string | number`.
 *
 * Documented as a known maintenance step in docs/site-review-2026-05-30.md
 * (audit Q34) and re-asserted post-2026-06-03 PayHero → IntaSend cutover.
 *
 * Run after `npm run supabase:types` (or after a manual regen via the
 * MCP). Idempotent — re-running is a no-op once the union is in place.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/types/database.ts'
const cols = [
  // Money columns the codebase converts to BigInt at the boundary
  'amount_minor',
  'total_minor',
  'subtotal_minor',
  'shipping_minor',
  'tax_minor',
  'discount_minor',
  'processing_fee_minor',
  'gross_total_minor',
  'net_total_minor',
  'fees_minor',
  'salary_total_minor',
  'commissions_total_minor',
  'rank_bonus_total_minor',
  'retail_profit_minor',
  'unit_price_minor',
  'line_total_minor',
  'commissionable_amount_minor',
  'voided_amount_minor',
  'paid_amount_minor',
  'amount_cents',
  'starter_price_minor',
  'joining_fee_minor',
  'retail_price_minor',
  'distributor_price_minor',
  'commissionable_minor',
  'override_amount_minor',
]

let t = readFileSync(path, 'utf8')
let changes = 0

for (const c of cols) {
  // Row + Insert + Update payloads. Match `: number` and `: number | null`
  // optionally with `?` before the colon. Bound with non-word so we don't
  // accidentally widen a substring match.
  const reNull = new RegExp(`(\\b${c}\\??: )number \\| null(?!\\w)`, 'g')
  t = t.replace(reNull, (_, lead) => {
    changes++
    return `${lead}string | number | null`
  })
  const reN = new RegExp(`(\\b${c}\\??: )number(?!\\s*\\|)(?!\\w)`, 'g')
  t = t.replace(reN, (_, lead) => {
    changes++
    return `${lead}string | number`
  })
}

writeFileSync(path, t, 'utf8')
console.log(`widened ${changes} BIGINT column refs in ${path}`)
