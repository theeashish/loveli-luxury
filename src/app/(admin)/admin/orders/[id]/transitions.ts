/**
 * Plain-data definitions for the admin order state machine.
 *
 * Lives in its own (non-'use server') module so the admin detail page
 * can import the per-status allowed actions without pulling in the
 * server-action file. Next.js requires that files marked 'use server'
 * export ONLY async functions; any non-function export (a Record, a
 * constant, a type) trips the build.
 */

export type AnyStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'refunded'

export type Action = 'cancel' | 'fulfill' | 'ship' | 'deliver' | 'refund'

export const ALLOWED_ACTIONS: Record<AnyStatus, Action[]> = {
  pending: ['cancel'],
  paid: ['fulfill', 'refund'],
  fulfilled: ['ship', 'refund'],
  shipped: ['deliver', 'refund'],
  delivered: [],
  cancelled: [],
  failed: [],
  refunded: [],
}
