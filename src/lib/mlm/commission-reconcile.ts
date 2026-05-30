import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Commission safety net.
 *
 * The webhook treats a failed `write_commission_ledger` as NON-FATAL
 * (returns "commissionPending") and never retries — that is exactly how
 * order 11 silently lost its commission. This module finds any paid,
 * commissionable order that has no commission rows and backfills it by
 * re-running the (idempotent) `write_commission_ledger` RPC.
 *
 * Driven by the daily cron `/api/cron/commission-reconcile` and the admin
 * page `/admin/comp/commission-health`.
 */

type Service = SupabaseClient<Database>

const COMMISSIONABLE_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'] as const

export type MissingCommissionOrder = {
  orderId: number
  orderNumber: string
  status: string
  kind: string
}

/**
 * PURE: given candidate orders and the two id-sets, return the ids that are
 * commissionable but have no commission rows. Extracted for unit testing.
 */
export function selectMissingOrderIds(
  orders: ReadonlyArray<{ id: number }>,
  commissionableOrderIds: ReadonlySet<number>,
  orderIdsWithCommission: ReadonlySet<number>,
): number[] {
  return orders
    .map((o) => o.id)
    .filter((id) => commissionableOrderIds.has(id) && !orderIdsWithCommission.has(id))
}

export async function findOrdersMissingCommission(
  service: Service,
): Promise<MissingCommissionOrder[]> {
  const ordersRes = await service
    .from('orders')
    .select('id, order_number, status, kind, sponsor_distributor_id')
    .in('status', [...COMMISSIONABLE_STATUSES])
    .not('sponsor_distributor_id', 'is', null)
  const orders = (ordersRes.data ?? []) as Array<{
    id: number
    order_number: string
    status: string
    kind: string
    sponsor_distributor_id: number | null
  }>
  if (orders.length === 0) return []
  const orderIds = orders.map((o) => o.id)

  const itemsRes = await service
    .from('order_items')
    .select('order_id')
    .eq('is_commissionable', true)
    .in('order_id', orderIds)
  const commissionable = new Set<number>(
    ((itemsRes.data ?? []) as Array<{ order_id: number }>).map((r) => r.order_id),
  )

  const ledgerRes = await service
    .from('commission_ledger')
    .select('source_order_id')
    .in('source_order_id', orderIds)
  const withCommission = new Set<number>(
    ((ledgerRes.data ?? []) as Array<{ source_order_id: number }>).map((r) => r.source_order_id),
  )

  const missingIds = new Set(selectMissingOrderIds(orders, commissionable, withCommission))
  return orders
    .filter((o) => missingIds.has(o.id))
    .map((o) => ({ orderId: o.id, orderNumber: o.order_number, status: o.status, kind: o.kind }))
}

export type ReconcileResult = {
  found: number
  backfilled: Array<{
    orderId: number
    orderNumber: string
    rowsWritten: number
    error: string | null
  }>
}

export async function reconcileMissingCommissions(service: Service): Promise<ReconcileResult> {
  const missing = await findOrdersMissingCommission(service)
  const backfilled: ReconcileResult['backfilled'] = []

  for (const o of missing) {
    const res = (await service.rpc('write_commission_ledger', { p_order_id: o.orderId })) as {
      data: number | null
      error: { message: string } | null
    }
    const rowsWritten = res.error ? 0 : res.data ?? 0
    backfilled.push({
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      rowsWritten,
      error: res.error?.message ?? null,
    })
    await service.from('audit_log').insert({
      action: 'commission.reconcile_backfill',
      resource_type: 'orders',
      resource_id: String(o.orderId),
      after_data: { rows_written: rowsWritten, error: res.error?.message ?? null },
    })
  }

  return { found: missing.length, backfilled }
}
