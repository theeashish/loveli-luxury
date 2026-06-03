# PayHero → IntaSend migration (2026-06-03)

Canonical narrative for the platform's payment-provider cutover.

## Why

Owner decision, 2026-06-03. PayHero was retired in favour of IntaSend so
the platform can:

- Use IntaSend as a **float wallet**: collections fund the wallet,
  payouts draw from it. PayHero required a separate STK-push merchant
  account and a separate B2C account with a Safaricom support-ticket
  onboarding path that hadn't yet cleared.
- Accept **card and bank** payments at the same code path as M-Pesa,
  without standing up a second provider.
- Sign webhooks with a shared challenge secret (mandatory verification),
  closing the "PayHero doesn't sign callbacks; we rely on a URL token"
  gap.
- Drop the Daraja Go-Live track entirely — IntaSend abstracts Safaricom
  for both C2B and B2C.

## Build order

```
Phase 0  Remove PayHero (no IntaSend yet)
  0a  Inventory                                ✓
  0b  Migration 046: enum extension            ✓
  0b  Migration 047: neutral payments / payouts / webhook_events
                                               ✓
  0c  Migration 048: backfill payments from
      orders.payhero_*                          ✓
  0d  Delete src/lib/payhero/* + src/app/api/payhero/* +
      payhero tests + payhero-smoke.mjs         ✓
  0e  Provider-neutral dispatcher + apply-payment-success +
      diagnostics + payouts/draft               ✓
  0f  Strip PAYHERO_* env vars + CSP host;
      add INTASEND_* placeholders               ✓
  0g  Admin payouts + admin orders rewire to
      neutral columns                           ✓
  0h  Checkout/signup UI rewire                 ✓
  0i  Archive PayHero docs + update memory      ✓ (this commit)
  0j  Verify grep clean + build green + commit  ✓ (this commit)

Phase 1  IntaSend foundation                    pending
  - Install intasend-node
  - src/lib/intasend/{client,types,signature,fees}.ts
  - env validation already in place

Phase 2  intasend-collect endpoint + webhook    pending
  - POST /api/intasend/collect (JWT, validate, STK push or
    hosted-checkout link via SDK with wallet_id, insert payments)
  - POST /api/intasend/webhook (signature verify against
    INTASEND_WEBHOOK_CHALLENGE, idempotency via webhook_deliveries,
    update payments.status, call applyPaymentSuccess on complete)
  - GET /api/intasend/status (replaces the deleted PayHero status route)
  - POST /api/intasend/retry-stk

Phase 3  HARD STOP                              pending
  Owner provides INTASEND_PUBLISHABLE_KEY / INTASEND_SECRET_TOKEN /
  INTASEND_WALLET_ID / INTASEND_WEBHOOK_CHALLENGE / INTASEND_TEST=true.
  We drive one real STK push through to settled, confirm the webhook
  lands and the commission ledger writes. Only after that do we build
  Phase 4.

Phase 4  intasend-payout + approve + webhook    pending
Phase 5  Reconciliation cron                    pending
```

## What's on disk after Phase 0

**Migrations**:
- `046_intasend_payout_status_enum.sql` — `queued`, `pending_approval`
- `047_intasend_neutral_schema.sql` — `payments` table, extended `payouts`,
  `webhook_deliveries.invoice_or_tracking_id`, dropped `'payhero'` defaults
- `048_backfill_payments_from_payhero.sql` — historical PayHero
  transactions copied into `payments` with `raw_payload.backfill` tag

**Code**:
- `src/lib/payments/{dispatcher,apply-payment-success,fees,idempotency}.ts`
  — provider-neutral interfaces. `initiatePayment` throws until Phase 1.
- `src/app/api/checkout/init/route.ts`, `src/app/api/partner-signup/init/route.ts`
  — neutral, write `payment_provider: 'intasend'` on new orders, point
  refire/status URLs at `/api/intasend/*`.
- `src/components/checkout/StkPushPanel.tsx`, `CheckoutForm.tsx`,
  `src/components/distributors/SignupForm.tsx` — point at
  `/api/intasend/{status,retry-stk}`. Phase 0 leaves these endpoints
  unimplemented; the StkPushPanel reaches its 75 s timeout and offers a
  retry button.
- `src/app/api/cron/reconcile-pending/route.ts` — bearer-gated stub that
  returns 200 with `scanned: 0` until Phase 2 wires the IntaSend status
  probe.
- `src/app/(admin)/admin/payouts/*` + `src/app/(admin)/admin/orders/[id]/*`
  — neutral, read the new payouts columns (`tracking_id`, `requires_approval`,
  `account`, `bank_code`) and surface a legacy "PayHero reference" row
  on historical payouts.

**Env / config**:
- `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_TOKEN`, `INTASEND_WALLET_ID`,
  `INTASEND_WEBHOOK_CHALLENGE`, `INTASEND_TEST`,
  `INTASEND_PAYOUT_APPROVAL_CEILING_KES` validated in `src/lib/env.ts`.
- `next.config.js` CSP: `connect-src` now allows
  `https://payment.intasend.com` and `https://sandbox.intasend.com`.

**Preserved (intentionally)**:
- `orders.payhero_checkout_reference`, `orders.payhero_external_reference`,
  `orders.payhero_mpesa_receipt` — nullable, historical only. Admin order
  detail pages still surface them for past orders.
- `payouts.payhero_transfer_reference`, `payouts.payhero_mpesa_receipt`
  — same posture. The detail page labels these "Legacy PayHero reference".
- `payment_attempts` table — provider-agnostic audit log. IntaSend writes
  rows here with `provider: 'intasend'`.

## Security rules (active from Phase 0)

- All IntaSend calls server-side. Publishable key is server-validated;
  it may only travel to the browser if/when we ship the inline-checkout
  widget on a single, tightly-scoped page.
- Webhook signature verification will be mandatory on every IntaSend
  webhook (Phase 2). If we ever ship without verification, the right
  fix is a full handler rewrite, not a patch.
- Idempotency via the existing `webhook_deliveries` UNIQUE(provider,
  event_id) constraint + `record_webhook_delivery` RPC.
- RLS on `payments` (members read their own; admins do everything).
- Amounts validated server-side. The fee model lives in
  `src/lib/payments/fees.ts` (Phase 0 stub returns 0; Phase 1 plugs in
  IntaSend's schedule).
- Payouts above `INTASEND_PAYOUT_APPROVAL_CEILING_KES` (default 100,000
  KES) require a superadmin approval action before they fire. Enforced
  by `payouts.requires_approval` + `approved_by`.
