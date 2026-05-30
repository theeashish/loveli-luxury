/**
 * Commission engine — REAL production SQL, exercised end to end.
 *
 * These tests run the ACTUAL `write_commission_ledger` / `mark_order_paid`
 * RPCs from the production migrations against the live-configured comp plan
 * (migrations 029 + 036: L1 20% / L2 11% / L3 6% / L4 2% / L5 1%, 50ml = 700 PV).
 *
 * The pre-existing unit tests (commission-calculator.test.ts) exercise a pure
 * TypeScript function that is NOT wired into any production path and encodes a
 * superseded rate sheet. THESE tests cover the code that actually pays people.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestDb,
  seedChain,
  seedVariant,
  seedPendingOrder,
  type TestDb,
} from '../db/harness'

// 50ml bottle per the adopted client plan (Appendix C / migration 029).
const PV_50ML = 700
const RETAIL_50ML = 280000 // KES 2,800 in minor units
const DISTRIBUTOR_50ML = 140000 // KES 1,400 (IBO price)

// Documented worked example (masterplan Appendix C): a single 50ml sale pays
// each qualifying upline level, in KES minor units.
const EXPECTED_BY_LEVEL: Record<number, number> = {
  1: 14000, // 700 PV × 20% × 100 = KES 140
  2: 7700, //  700 PV × 11% × 100 = KES 77
  3: 4200, //  700 PV ×  6% × 100 = KES 42
  4: 1400, //  700 PV ×  2% × 100 = KES 14
  5: 700, //   700 PV ×  1% × 100 = KES 7
}

const VARIANT = { pv: PV_50ML, retailMinor: RETAIL_50ML, distributorMinor: DISTRIBUTOR_50ML }
const ORDER = { pv: PV_50ML, distributorMinor: DISTRIBUTOR_50ML, retailMinor: RETAIL_50ML }

describe('write_commission_ledger (production SQL)', () => {
  let db: TestDb

  beforeAll(async () => {
    db = await createTestDb()
  })
  afterAll(async () => {
    if (db) await db.close()
  })

  it('loads the adopted client comp plan: L1-L5 = 20/11/6/2/1, deeper levels zero-rate', async () => {
    const rates = await db.query<{ level: number; rate_basis_points: number }>(
      `SELECT level, rate_basis_points FROM config_commission_rates
        WHERE effective_until IS NULL ORDER BY level`,
    )
    const byLevel = new Map(rates.map((r) => [Number(r.level), Number(r.rate_basis_points)]))
    expect(byLevel.get(1)).toBe(2000)
    expect(byLevel.get(2)).toBe(1100)
    expect(byLevel.get(3)).toBe(600)
    expect(byLevel.get(4)).toBe(200)
    expect(byLevel.get(5)).toBe(100)
    // Safety property: the adopted plan pays exactly five levels. Any deeper
    // level rows that survive in config MUST be zero-rate so the engine can
    // never silently pay a sixth or seventh level. (029 keeps L6/L7 at 0.)
    for (const [level, bp] of byLevel) {
      if (level > 5) expect(bp, `level ${level} must be zero-rate`).toBe(0)
    }
  })

  it('pays a 50ml sale down a 5-level chain at exactly 140/77/42/14/7', async () => {
    // Chain where each upline holds a rank high enough to earn its level.
    const [l1, l2, l3, l4, l5] = (await seedChain(db, [1, 2, 3, 4, 5])) as [
      number,
      ...number[],
    ]
    const variant = await seedVariant(db, VARIANT)
    const { orderId } = await seedPendingOrder(db, { sponsorId: l1, variantId: variant, ...ORDER })

    const paid = await db.scalar<boolean>(`SELECT public.mark_order_paid($1, 'MPESA-TEST', NOW())`, [
      orderId,
    ])
    expect(paid).toBe(true)

    const written = await db.scalar<number>(`SELECT public.write_commission_ledger($1)`, [orderId])
    expect(Number(written)).toBe(5)

    const rows = await db.query<{ distributor_id: number; level: number; amount_minor: number }>(
      `SELECT distributor_id, level, amount_minor FROM commission_ledger
        WHERE source_order_id = $1 ORDER BY level`,
      [orderId],
    )

    const byLevel = new Map(rows.map((r) => [Number(r.level), r]))
    for (const [level, expected] of Object.entries(EXPECTED_BY_LEVEL)) {
      const row = byLevel.get(Number(level))
      expect(row, `level ${level} commission row`).toBeDefined()
      expect(Number(row!.amount_minor), `level ${level} amount`).toBe(expected)
    }

    // Each level credited the correct recipient.
    expect(Number(byLevel.get(1)!.distributor_id)).toBe(l1)
    expect(Number(byLevel.get(2)!.distributor_id)).toBe(l2)
    expect(Number(byLevel.get(3)!.distributor_id)).toBe(l3)
    expect(Number(byLevel.get(4)!.distributor_id)).toBe(l4)
    expect(Number(byLevel.get(5)!.distributor_id)).toBe(l5)

    // Total paid out = sum of the worked example.
    const total = rows.reduce((s, r) => s + Number(r.amount_minor), 0)
    expect(total).toBe(14000 + 7700 + 4200 + 1400 + 700)
  })

  it('is idempotent: a second write for the same order adds no rows (no double-pay)', async () => {
    const [l1] = (await seedChain(db, [1, 2, 3])) as [number, ...number[]]
    const variant = await seedVariant(db, VARIANT)
    const { orderId } = await seedPendingOrder(db, { sponsorId: l1, variantId: variant, ...ORDER })
    await db.scalar(`SELECT public.mark_order_paid($1, 'MPESA-TEST', NOW())`, [orderId])

    const first = Number(await db.scalar(`SELECT public.write_commission_ledger($1)`, [orderId]))
    const second = Number(await db.scalar(`SELECT public.write_commission_ledger($1)`, [orderId]))
    expect(first).toBeGreaterThan(0)
    expect(second).toBe(0)

    const count = Number(
      await db.scalar(`SELECT COUNT(*) FROM commission_ledger WHERE source_order_id = $1`, [orderId]),
    )
    expect(count).toBe(first)
  })

  it('DB guard (migration 040) makes a concurrent double-write impossible', async () => {
    // Prove the unique index rejects a second row for the same
    // (order, recipient, level) — the outcome a lost concurrent race attempts.
    const [l1] = (await seedChain(db, [1])) as [number, ...number[]]
    const variant = await seedVariant(db, VARIANT)
    const { orderId } = await seedPendingOrder(db, { sponsorId: l1, variantId: variant, ...ORDER })
    await db.scalar(`SELECT public.mark_order_paid($1, 'REF', NOW())`, [orderId])
    await db.scalar(`SELECT public.write_commission_ledger($1)`, [orderId])

    let rejected = false
    try {
      // Clone the existing L1 row — exactly what a second concurrent caller
      // would insert after both passed write_commission_ledger's count guard.
      await db.exec(
        `INSERT INTO commission_ledger
           (distributor_id, source_order_id, source_distributor_id, level,
            commission_basis_minor, rate_basis_points, amount_minor, currency,
            config_commission_rate_id, earned_at, basis_pv)
         SELECT distributor_id, source_order_id, source_distributor_id, level,
            commission_basis_minor, rate_basis_points, amount_minor, currency,
            config_commission_rate_id, earned_at, basis_pv
           FROM commission_ledger
          WHERE source_order_id = ${orderId} AND level = 1`,
      )
    } catch (e) {
      rejected = /unique|duplicate/i.test(String((e as Error).message))
    }
    expect(rejected).toBe(true)
  })

  it('enforces the rank gate: an under-ranked upline earns nothing for that level', async () => {
    // L3 ancestor holds only rank 2 → cannot earn a level-3 commission.
    const [l1, l2, l3] = (await seedChain(db, [1, 2, 2])) as [number, ...number[]]
    const variant = await seedVariant(db, VARIANT)
    const { orderId } = await seedPendingOrder(db, { sponsorId: l1, variantId: variant, ...ORDER })
    await db.scalar(`SELECT public.mark_order_paid($1, 'MPESA-TEST', NOW())`, [orderId])
    await db.scalar(`SELECT public.write_commission_ledger($1)`, [orderId])

    const recipients = (
      await db.query<{ distributor_id: number }>(
        `SELECT distributor_id FROM commission_ledger WHERE source_order_id = $1`,
        [orderId],
      )
    ).map((r) => Number(r.distributor_id))

    expect(recipients).toContain(l1)
    expect(recipients).toContain(l2)
    expect(recipients).not.toContain(l3) // gated out
  })

  it('writes no commissions for an order with no sponsor (pure retail)', async () => {
    const variant = await seedVariant(db, VARIANT)
    const [l1] = (await seedChain(db, [1])) as [number, ...number[]]
    const { orderId } = await seedPendingOrder(db, { sponsorId: l1, variantId: variant, ...ORDER })
    await db.exec(`UPDATE orders SET sponsor_distributor_id = NULL WHERE id = ${orderId}`)
    await db.scalar(`SELECT public.mark_order_paid($1, 'MPESA-TEST', NOW())`, [orderId])
    const written = Number(await db.scalar(`SELECT public.write_commission_ledger($1)`, [orderId]))
    expect(written).toBe(0)
  })
})

describe('mark_order_paid (production SQL)', () => {
  let db: TestDb
  beforeAll(async () => {
    db = await createTestDb()
  })
  afterAll(async () => {
    if (db) await db.close()
  })

  it('is idempotent and decrements inventory exactly once', async () => {
    const [l1] = (await seedChain(db, [1])) as [number, ...number[]]
    const variant = await seedVariant(db, { ...VARIANT, inventory: 10 })
    const { orderId } = await seedPendingOrder(db, {
      sponsorId: l1,
      variantId: variant,
      qty: 3,
      ...ORDER,
    })

    const first = await db.scalar<boolean>(`SELECT public.mark_order_paid($1, 'REF1', NOW())`, [orderId])
    const second = await db.scalar<boolean>(`SELECT public.mark_order_paid($1, 'REF2', NOW())`, [orderId])
    expect(first).toBe(true) // performed the transition
    expect(second).toBe(false) // idempotent no-op

    const inv = Number(
      await db.scalar(`SELECT inventory_qty FROM product_variants WHERE id = $1`, [variant]),
    )
    expect(inv).toBe(7) // 10 − 3, decremented once not twice

    const status = await db.scalar<string>(`SELECT status FROM orders WHERE id = $1`, [orderId])
    expect(status).toBe('paid')
  })
})
