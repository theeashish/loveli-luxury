# M-Pesa Go-Live Runbook (PayHero / Daraja)

**Status:** the payment code is production-ready and provider-agnostic. Sandbox
versus production is a configuration switch (PayHero dashboard + Vercel env
vars), not a code change. Verified 2026-05-22: a full-codebase grep found no
hardcoded sandbox paybill, channel id, or sandbox URL anywhere.

## How payments work (so the switch is clear)
- The app calls PayHero's backend (`backend.payhero.co.ke/api/v2`). PayHero
  fronts Safaricom Daraja.
- STK push: `POST /payments` with `channel_id = PAYHERO_CHANNEL_ID_STK`. Whether
  that channel is sandbox or live is set inside the PayHero dashboard.
- Confirmation is webhook only: PayHero POSTs to
  `/api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>`. Frontend polling never
  flips order state.
- Payouts (B2C): `POST /withdraw` with `channel_id = PAYHERO_CHANNEL_ID_B2C`.

## Go-Live steps, in order

### 1. Safaricom Daraja Go-Live (external, owner; longest lead time)
Apply for and confirm Daraja production access for the M-Pesa shortcode.
Sandbox today uses paybill **542542** (correct, not a bug). The planned
production target is paybill **174379**, store **8846**. Confirm the final
production shortcode with Safaricom and PayHero before switching.

### 2. Create LIVE channels in PayHero
In the PayHero dashboard, create or activate a LIVE M-Pesa STK channel bound to
the production shortcode, and a LIVE B2C channel for payouts. Note both channel
ids.

### 3. Set production env vars in Vercel (Production scope), then redeploy
| Var | Value |
|---|---|
| `PAYHERO_AUTH_TOKEN` | the LIVE Basic auth token from PayHero "API Keys" (paste as-is, no base64) |
| `PAYHERO_CHANNEL_ID_STK` | the LIVE STK channel id |
| `PAYHERO_CHANNEL_ID_B2C` | the LIVE B2C channel id |
| `PAYHERO_WEBHOOK_TOKEN` | keep the existing opaque secret (min 20 chars), or rotate it |

Env changes need a fresh deploy to take effect: `vercel deploy --prod --yes`.

### 4. Register the callback URL in PayHero
Set the channel callback URL to exactly:
`https://loveli-luxury.vercel.app/api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>`

The `key` must match `PAYHERO_WEBHOOK_TOKEN`. If it is missing or wrong, the
customer pays on their phone but the order stays `pending`. That is the single
most common "M-Pesa is broken" cause.

Quick check: `GET` that same URL in a browser returns `tokenAccepted: true`
when the token matches.

### 5. Fund the B2C wallet
Top up the PayHero B2C float so partner payouts can settle.

### 6. Smoke test with one small real transaction
Place a real low-value order and pay with a real M-Pesa line. Confirm: the STK
prompt arrives, payment completes, the order flips to `paid` within seconds, the
M-Pesa receipt is stored on the order, the distributor is provisioned (signup),
and the commission ledger is written. Check Vercel logs for one
`[payhero.stk.init]` line and one webhook delivery.

### 7. Rollback
To revert to sandbox: restore the sandbox `PAYHERO_CHANNEL_ID_STK` / `_B2C` and
`PAYHERO_AUTH_TOKEN` in Vercel and redeploy. No code change.

## Code readiness (verified 2026-05-22)
- All PayHero config is env-driven (`src/lib/payhero/service.ts`,
  `src/lib/env.ts`). No hardcoded channel ids, paybills, or sandbox URLs.
- Webhook is idempotent (dedup table + `mark_order_paid`), token-gated, and
  amount-checked.

## Reliability gaps

### Fixed 2026-05-28 — `payment_attempts` column drift
The audit table sat at 0 rows after ~15 STK pushes. Root cause was a column
drift on the live table (migration 019's `CREATE TABLE IF NOT EXISTS` was a
no-op because an earlier hand-applied DDL had already created the table with
only 7 of the 10 columns 019 documented). The dispatcher kept sending
`attempt_type` and `error_message`; PostgREST returned a "column does not
exist" error in the resolved `{ error }`; the wrapper never inspected it.
Migration 030 (`030_payment_attempts_column_drift.sql`) restores the schema
and the dispatcher now surfaces insert errors via `console.warn`. See
masterplan Appendix G.

### Confirmed 2026-05-28 — no PayHero webhook has reached the endpoint yet
`webhook_deliveries` is at 0 rows all-time. Investigated: the
`record_webhook_delivery` RPC is correct and inserts cleanly when called
directly, and the webhook route's flow is sound. The 4 paid/fulfilled orders
were admin-reconciled (the M-Pesa receipt was pasted in from the PayHero
dashboard and the same RPC chain run via
`src/app/api/payhero/reconcile/route.ts` or
`src/app/(admin)/admin/orders/[id]/actions.ts`). So this is **not a code
bug** — it accurately reflects the sandbox-development pattern.

**Action belongs to the Go-Live smoke test (§6 above):** after the callback
URL is registered in step §4, place one real low-value transaction and
verify a row appears in `webhook_deliveries` within seconds. If no row, the
URL/token is wrong (the most common "M-Pesa is broken" cause).
