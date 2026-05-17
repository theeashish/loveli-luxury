/**
 * Tests for the pure idempotency decision helpers used by the PayHero
 * init routes. These are the brain of the double-deduction fix:
 *
 *   - `decidePendingAction` decides whether to reuse, expire, or
 *     ignore a pending order found during init.
 *   - `shouldRefireStk` gates whether we actually call PayHero again
 *     when reusing — within the STK lifetime the prior prompt is
 *     still live and a refire would just incur a second wallet fee.
 *
 * Pure functions, so no Supabase or HTTP mocking required.
 */

import { describe, expect, it } from 'vitest'
import {
  decidePendingAction,
  shouldRefireStk,
  type PendingOrderRow,
} from '../../src/lib/payhero/idempotency'

const NOW = new Date('2026-05-17T10:00:00Z').getTime()
const STALE_PENDING_MS = 15 * 60 * 1000 // 15 min
const STK_REFIRE_THROTTLE_MS = 60 * 1000 // 60 s

const minuteAgo = (mins: number) =>
  new Date(NOW - mins * 60 * 1000).toISOString()
const secondsAgo = (secs: number) =>
  new Date(NOW - secs * 1000).toISOString()

const order = (overrides: Partial<PendingOrderRow> = {}): PendingOrderRow => ({
  id: 42,
  order_number: 'LL-2026-000042',
  created_at: minuteAgo(1),
  ...overrides,
})

// ---------------------------------------------------------------------
// decidePendingAction — the core "what do we do with an existing
// pending order?" decision.
// ---------------------------------------------------------------------

describe('decidePendingAction', () => {
  it('returns "none" when no pending order exists', () => {
    const action = decidePendingAction(null, NOW, STALE_PENDING_MS)
    expect(action).toEqual({ type: 'none' })
  })

  it('returns "reuse" for a pending order created seconds ago', () => {
    const action = decidePendingAction(
      order({ created_at: secondsAgo(30) }),
      NOW,
      STALE_PENDING_MS,
    )
    expect(action).toEqual({
      type: 'reuse',
      orderId: 42,
      orderNumber: 'LL-2026-000042',
    })
  })

  it('returns "reuse" for a pending order created 14 minutes ago (still fresh)', () => {
    const action = decidePendingAction(
      order({ created_at: minuteAgo(14) }),
      NOW,
      STALE_PENDING_MS,
    )
    expect(action.type).toBe('reuse')
  })

  it('returns "reuse" at exactly the boundary (15 min - 1 ms)', () => {
    const justInsideMs = NOW - STALE_PENDING_MS + 1
    const action = decidePendingAction(
      order({ created_at: new Date(justInsideMs).toISOString() }),
      NOW,
      STALE_PENDING_MS,
    )
    expect(action.type).toBe('reuse')
  })

  it('returns "expire" at exactly the boundary (15 min on the dot)', () => {
    const onBoundaryMs = NOW - STALE_PENDING_MS
    const action = decidePendingAction(
      order({ created_at: new Date(onBoundaryMs).toISOString() }),
      NOW,
      STALE_PENDING_MS,
    )
    expect(action).toEqual({ type: 'expire', orderId: 42 })
  })

  it('returns "expire" for a pending order created 20 minutes ago', () => {
    const action = decidePendingAction(
      order({ created_at: minuteAgo(20) }),
      NOW,
      STALE_PENDING_MS,
    )
    expect(action).toEqual({ type: 'expire', orderId: 42 })
  })

  it('returns "expire" for a pending order created hours ago (abandoned)', () => {
    const action = decidePendingAction(
      order({ created_at: minuteAgo(60 * 6) }),
      NOW,
      STALE_PENDING_MS,
    )
    expect(action).toEqual({ type: 'expire', orderId: 42 })
  })

  it('honours a custom staleAfterMs for the rare admin sweep job', () => {
    const action = decidePendingAction(
      order({ created_at: minuteAgo(5) }),
      NOW,
      60 * 1000, // 1 minute window
    )
    expect(action.type).toBe('expire')
  })
})

// ---------------------------------------------------------------------
// shouldRefireStk — the throttle that stops the reuse branch from
// firing a second wallet fee when the prior STK is still alive.
// ---------------------------------------------------------------------

describe('shouldRefireStk', () => {
  it('returns true when there has never been a prior attempt', () => {
    expect(shouldRefireStk(null, NOW, STK_REFIRE_THROTTLE_MS)).toBe(true)
  })

  it('returns false when the last attempt was 1 second ago', () => {
    expect(
      shouldRefireStk(secondsAgo(1), NOW, STK_REFIRE_THROTTLE_MS),
    ).toBe(false)
  })

  it('returns false when the last attempt was 30 seconds ago (still live)', () => {
    expect(
      shouldRefireStk(secondsAgo(30), NOW, STK_REFIRE_THROTTLE_MS),
    ).toBe(false)
  })

  it('returns false at the boundary minus 1 ms', () => {
    const justInside = new Date(NOW - STK_REFIRE_THROTTLE_MS + 1).toISOString()
    expect(shouldRefireStk(justInside, NOW, STK_REFIRE_THROTTLE_MS)).toBe(false)
  })

  it('returns true at exactly the boundary (60 s on the dot)', () => {
    const onBoundary = new Date(NOW - STK_REFIRE_THROTTLE_MS).toISOString()
    expect(shouldRefireStk(onBoundary, NOW, STK_REFIRE_THROTTLE_MS)).toBe(true)
  })

  it('returns true when the last attempt was 90 seconds ago (STK long dead)', () => {
    expect(
      shouldRefireStk(secondsAgo(90), NOW, STK_REFIRE_THROTTLE_MS),
    ).toBe(true)
  })

  it('returns true when the last attempt was hours ago', () => {
    expect(
      shouldRefireStk(minuteAgo(180), NOW, STK_REFIRE_THROTTLE_MS),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------
// Composed scenarios — exercise the helpers as a pair, the way the
// init route does. These are the "two POSTs in quick succession" and
// "two POSTs 20 min apart" cases from the plan.
// ---------------------------------------------------------------------

describe('idempotency composed scenarios', () => {
  it('rapid double-init within 60 s: reuse + throttled (no second STK fire)', () => {
    // T=0   user submits → order #42 created, STK fired (logged in
    //       payment_attempts at T=0)
    // T=10s page hiccups, user re-submits
    //
    // The init route looks up the pending order (10s old) and the
    // last stk_push attempt (also 10s old). It should reuse the
    // order AND throttle the fire.
    const pending = order({ created_at: secondsAgo(10) })
    const lastFire = secondsAgo(10)

    const action = decidePendingAction(pending, NOW, STALE_PENDING_MS)
    expect(action.type).toBe('reuse')

    const fireAgain = shouldRefireStk(lastFire, NOW, STK_REFIRE_THROTTLE_MS)
    expect(fireAgain).toBe(false)
  })

  it('legitimate retry after STK expiry: reuse + fire (one new STK)', () => {
    // T=0   user submits → order #42 created, STK fired
    // T=80s panel timed out at 75s, user clicked "Try again"
    //
    // Order still pending (80s old, well under 15 min). Last STK
    // attempt is 80s old, past the 60s throttle. Reuse + fire.
    const pending = order({ created_at: secondsAgo(80) })
    const lastFire = secondsAgo(80)

    const action = decidePendingAction(pending, NOW, STALE_PENDING_MS)
    expect(action.type).toBe('reuse')

    const fireAgain = shouldRefireStk(lastFire, NOW, STK_REFIRE_THROTTLE_MS)
    expect(fireAgain).toBe(true)
  })

  it('long-abandoned cart: expire, then proceed (caller marks status=expired)', () => {
    // T=0    user opens checkout, fires STK, walks away
    // T=20m  user returns, re-submits with different details
    //
    // Pending is 20 min old → past the 15 min reuse window. Caller
    // marks it 'expired' (freeing the unique index slot) and creates
    // a fresh order. The throttle is moot in this branch — fresh
    // create always fires its first STK.
    const pending = order({ created_at: minuteAgo(20) })
    const action = decidePendingAction(pending, NOW, STALE_PENDING_MS)
    expect(action).toEqual({ type: 'expire', orderId: 42 })
  })

  it('the original bug profile: two STKs would fire per intent', () => {
    // Before the fix: every init created a new order and fired STK,
    // so a double-submit produced two wallet fees. After the fix:
    // a pending order found within 60s short-circuits the fire.
    //
    // This test pins the behaviour: with both helpers wired up, a
    // rapid re-init produces ZERO additional PayHero calls.
    const pending = order({ created_at: secondsAgo(5) })
    const lastFire = secondsAgo(5)

    const action = decidePendingAction(pending, NOW, STALE_PENDING_MS)
    const fireAgain = shouldRefireStk(lastFire, NOW, STK_REFIRE_THROTTLE_MS)

    const wouldFireExtraStk = action.type === 'reuse' && fireAgain
    expect(wouldFireExtraStk).toBe(false)
  })
})
