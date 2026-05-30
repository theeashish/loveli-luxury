/**
 * Integration-test harness: the REAL production schema in in-process Postgres.
 *
 * Loads the Supabase environment shim (supabase-preamble.sql) followed by every
 * production migration in `supabase/migrations/`, unmodified, into a pglite
 * instance (real Postgres compiled to WASM — no Docker, no cloud, no cost).
 *
 * The point: exercise the ACTUAL money RPCs (write_commission_ledger,
 * mark_order_paid, provision_distributor, ...) — not a TypeScript re-implementation.
 * For a system that moves real money, the test target must be the code that runs
 * in production.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { citext } from '@electric-sql/pglite/contrib/citext'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const migDir = join(root, 'supabase', 'migrations')

export type Row = Record<string, unknown>

export type TestDb = {
  /** Run a multi-statement SQL script (DDL, seeds). */
  exec: (sql: string) => Promise<void>
  /** Parameterised query ($1, $2 …) returning all rows. */
  query: <T extends Row = Row>(sql: string, params?: unknown[]) => Promise<T[]>
  /** Parameterised query returning the first row (or undefined). */
  one: <T extends Row = Row>(sql: string, params?: unknown[]) => Promise<T | undefined>
  /** Scalar helper: first column of the first row. */
  scalar: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>
  close: () => Promise<void>
  raw: PGlite
}

/** The production migration filenames, in apply order (filename sort). */
export function migrationFiles(): string[] {
  return readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
}

/**
 * Build a fresh database with the full production schema applied.
 * Throws (naming the offending file) if any migration fails to apply — that
 * itself is a useful regression signal: a migration that can't load on a clean
 * Postgres is a migration that can't be trusted on a clean restore.
 */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { pgcrypto, citext, uuid_ossp } })
  await db.exec(readFileSync(join(here, 'supabase-preamble.sql'), 'utf8'))
  for (const f of migrationFiles()) {
    try {
      await db.exec(readFileSync(join(migDir, f), 'utf8'))
    } catch (e) {
      await db.close()
      throw new Error(`migration ${f} failed to apply: ${(e as Error).message}`)
    }
  }
  // Defined as generic function declarations (not object-literal arrow methods)
  // so the <T> flows through to the return type cleanly under `tsc`.
  async function query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]> {
    const res = await db.query<T>(sql, params)
    return res.rows as T[]
  }
  async function one<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return (await query<T>(sql, params))[0]
  }
  async function scalar<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
    const res = await db.query(sql, params)
    const first = res.rows[0] as Row | undefined
    return first ? (Object.values(first)[0] as T) : (undefined as T)
  }
  return {
    exec: async (sql: string) => {
      await db.exec(sql)
    },
    query,
    one,
    scalar,
    close: () => db.close(),
    raw: db,
  }
}

// -----------------------------------------------------------------------------
// Seed helpers — build the minimum graph the money engine reads.
// -----------------------------------------------------------------------------

/** Map of active rank_position -> config_ranks.id (current effective rows). */
export async function rankIdsByPosition(db: TestDb): Promise<Map<number, number>> {
  const rows = await db.query<{ id: number; rank_position: number }>(
    `SELECT id, rank_position FROM config_ranks WHERE effective_until IS NULL ORDER BY rank_position`,
  )
  return new Map(rows.map((r) => [Number(r.rank_position), Number(r.id)]))
}

let seq = 0
function uniq(prefix: string): string {
  seq += 1
  return `${prefix}${String(seq).padStart(5, '0')}`
}

/** Create an auth user + profile, return the user uuid. */
export async function seedUser(db: TestDb, fullName = 'Test User'): Promise<string> {
  const email = `${uniq('user')}@test.local`
  const uid = await db.scalar<string>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [email],
  )
  await db.exec(
    `INSERT INTO profiles (id, email, full_name) VALUES ('${uid}', '${email}', '${fullName}')`,
  )
  return uid
}

/**
 * Create a distributor with the given rank position and (optional) sponsor,
 * wiring the closure tree via the production add_distributor_to_tree RPC.
 * Returns the new distributors.id.
 */
export async function seedDistributor(
  db: TestDb,
  opts: { rankPosition?: number; sponsorId?: number | null } = {},
): Promise<number> {
  const uid = await seedUser(db, 'Partner')
  const ranks = await rankIdsByPosition(db)
  const rankId = opts.rankPosition ? ranks.get(opts.rankPosition) ?? null : null
  const id = await db.scalar<number>(
    `INSERT INTO distributors (user_id, sponsor_code, sponsor_id, current_rank_id, is_active, kyc_status)
     VALUES ($1, $2, $3, $4, TRUE, 'approved') RETURNING id`,
    [uid, uniq('LL-T-'), opts.sponsorId ?? null, rankId],
  )
  await db.query(`SELECT public.add_distributor_to_tree($1, $2)`, [id, opts.sponsorId ?? null])
  return Number(id)
}

/**
 * Seed an upline chain of length `rankPositions.length`. Index 0 is the direct
 * sponsor (L1) and is returned first. Each distributor is given the rank
 * position at its index, so distributor i can earn commission level i+1.
 * Returns ids ordered L1, L2, … (sponsor first, deepest ancestor last).
 */
export async function seedChain(db: TestDb, rankPositions: number[]): Promise<number[]> {
  // Build from the top (deepest ancestor) down so each has its sponsor ready.
  let sponsor: number | null = null
  const topDown: number[] = []
  for (let i = rankPositions.length - 1; i >= 0; i--) {
    const id = await seedDistributor(db, { rankPosition: rankPositions[i], sponsorId: sponsor })
    topDown.push(id)
    sponsor = id
  }
  // topDown is [deepest … L1]; reverse to [L1 … deepest].
  return topDown.reverse()
}

/** Seed one active product + a single variant. Returns the variant id. */
export async function seedVariant(
  db: TestDb,
  opts: { pv: number; retailMinor: number; distributorMinor: number; sizeMl?: number; inventory?: number },
): Promise<number> {
  const productId = await db.scalar<number>(
    `INSERT INTO products (slug, name, is_active) VALUES ($1, $2, TRUE) RETURNING id`,
    [uniq('prod-'), 'Test Fragrance'],
  )
  return Number(
    await db.scalar<number>(
      `INSERT INTO product_variants
         (product_id, sku, size_ml, retail_price_minor, distributor_price_minor, inventory_qty, is_active, pv_per_bottle)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7) RETURNING id`,
      [
        productId,
        uniq('SKU-'),
        opts.sizeMl ?? 50,
        opts.retailMinor,
        opts.distributorMinor,
        opts.inventory ?? 1000,
        opts.pv,
      ],
    ),
  )
}

/**
 * Place a pending retail order for `variantId` × qty, attributed to
 * `sponsorId`, by a fresh customer. Returns { orderId, orderNumber }.
 */
export async function seedPendingOrder(
  db: TestDb,
  opts: { sponsorId: number; variantId: number; qty?: number; pv: number; distributorMinor: number; retailMinor: number },
): Promise<{ orderId: number; orderNumber: string }> {
  const qty = opts.qty ?? 1
  const buyer = await seedUser(db, 'Customer')
  const orderNumber = await db.scalar<string>(`SELECT public.generate_order_number()`)
  const lineTotal = opts.retailMinor * qty
  const orderId = await db.scalar<number>(
    `INSERT INTO orders
       (order_number, user_id, customer_email, kind, status, subtotal_minor, total_minor, currency, sponsor_distributor_id, payment_provider)
     VALUES ($1, $2, 'cust@test.local', 'retail', 'pending', $3, $3, 'KES', $4, 'payhero')
     RETURNING id`,
    [orderNumber, buyer, lineTotal, opts.sponsorId],
  )
  await db.query(
    `INSERT INTO order_items
       (order_id, variant_id, quantity, unit_price_minor, line_total_minor, is_commissionable, commissionable_amount_minor, commission_pv)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)`,
    [orderId, opts.variantId, qty, opts.retailMinor, lineTotal, opts.distributorMinor * qty, opts.pv * qty],
  )
  return { orderId: Number(orderId), orderNumber: String(orderNumber) }
}
