import { describe, it, expect } from 'vitest'
import { selectMissingOrderIds } from '@/lib/mlm/commission-reconcile'

describe('selectMissingOrderIds', () => {
  it('returns commissionable orders that have no commission rows', () => {
    const orders = [{ id: 11 }, { id: 19 }, { id: 20 }, { id: 21 }]
    const commissionable = new Set([11, 19, 20]) // 21 is not commissionable
    const withCommission = new Set([19]) // only 19 already has a commission
    expect(selectMissingOrderIds(orders, commissionable, withCommission)).toEqual([11, 20])
  })

  it('returns empty when every commissionable order already has its commission', () => {
    const orders = [{ id: 1 }, { id: 2 }]
    expect(selectMissingOrderIds(orders, new Set([1, 2]), new Set([1, 2]))).toEqual([])
  })

  it('ignores non-commissionable orders even when they have no commission', () => {
    const orders = [{ id: 5 }]
    expect(selectMissingOrderIds(orders, new Set(), new Set())).toEqual([])
  })
})
