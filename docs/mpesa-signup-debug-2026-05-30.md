# M-Pesa signup "no STK prompt" — diagnostic note for Ruth's report

For: Ashish · Written: 2026-05-30 · Subject: Ruth said no STK push on signup.

## What I actually verified in prod (project `thweaebhxsfxuxeosjty`)

| Check | Result |
|---|---|
| Ruth's current account `rymiruzz@gmail.com` (auth user `dedfac7a-…`) | Created 2026-05-16, last sign-in **today 18:43 UTC**, full_name "Ruth Karimi", **0 orders ever**, not a distributor |
| `payment_attempts` rows (last 30 days) | **Zero** (across all users) |
| `webhook_deliveries` all-time | **Zero**. No real PayHero STK has been *completed* end-to-end in prod, ever. The 4 paid signup orders were admin-reconciled. |
| Active starter bundle | `Founders Starter` (id=1, KES 1, is_active=TRUE) |
| `public.default_sponsor_code()` | `LL-EX-J9ZL` (Ashish's, distributor id=2, active) |
| Ruth's **OLD** soft-deleted account (`d4c963c8-…`) | distributor id=7, was **still `is_active = TRUE`** with sponsor_code `LL-JX-GRBR`, payout_msisdn `+254723562343`. Reconciled in migration 044 — see "Latent bug fixed" below. |

**Translation:** Ruth's attempt today did not create an order — so it failed
*before* `/api/partner-signup/init` reached step 10 (the orders.insert). That
puts the failure on the client side or in steps 1–9 of the route. We need her
to tell us what she saw on screen, because the form does surface errors there.

## Three things to ask Ruth (resolves ~90% of these reports)

1. **"What did the **Phone for M-Pesa** field look like at submit time?
   Was it `0712345678` or `+254712345678`?"**
   Our backend Zod regex requires E.164 (`+254…`). If she typed the
   Kenyan-natural `0712…`, the route returns 400 `"Phone must be E.164 format
   e.g. +254712345678"` and the form shows that. **Most common cause.**

2. **"After clicking Submit, what was on screen 20 seconds later? An error
   message in the form, or a polling card that said something like 'Check
   your phone'?"**
   Different answer = different bug:
   - **Error message** → form-side or server-side validation rejected. Ask
     her for the exact text. It will tell us exactly which field.
   - **Polling card** → the order was created and the STK push fired but
     either (a) PayHero sandbox doesn't push to real numbers reliably, or
     (b) the channel/auth config is wrong. (See "If she got to the polling
     card" below.)

3. **"What was in the **Sponsor code** field at submit time?"**
   It should be `LL-EX-J9ZL`, pre-filled from the cookie our middleware sets
   for first-time visitors. If she somehow had it blank, the form-side
   regex check rejects with `"Sponsor code must look like LL-XX-XXXX."`.

## If she got to the polling card and no prompt arrived

Then the order WAS created (we'd see it in `orders` under her user_id) and
the STK push WAS attempted (we'd see it in `payment_attempts`). Since both
tables are empty for her, she did NOT reach this state. **But for future
reference:**

PayHero on Daraja sandbox is only reliable with their official test MSISDN
`254708374149`. Real numbers in sandbox sometimes receive STK, often don't.
That is **not fixable from our code** — it is the documented sandbox
behaviour. It resolves itself when Safaricom Daraja Go-Live clears and we
swap to a live channel id in `PAYHERO_CHANNEL_ID_STK`.

To distinguish "sandbox didn't push" from "our config is wrong" once she's
past the form, check this in Vercel logs: every successful STK init writes
a structured log line:

```
[payhero.stk.init] {"externalReference":"LL-2026-NNNNNN","amountKes":N,"msisdn":"254...","ts":"..."}
```

If you see one for Ruth's order but her phone got nothing, it's a sandbox
delivery issue. If you don't see one, PayHero's API errored — the route
would have returned 502 to Ruth.

## Latent bug fixed today (independent of Ruth's signup issue)

Reviewing this also surfaced a real money-system bug. The
`/admin/system/users → deactivateUser` action revoked roles + banned the
auth user + anonymised the email — **but never flipped
`distributors.is_active`**. Consequence:

- The commission engine kept including soft-deleted users in the upline
  chain (write_commission_ledger filters on `d.is_active = TRUE`).
- The stored `payout_msisdn` on the still-active distributor row could
  receive a B2C transfer when payouts ran.

For a money system, deactivation must sever **both** identities. Fixed
today:
1. `actions.ts` now flips `distributors.is_active = FALSE` inside
   `deactivateUser`, captures the previous state in the audit row for
   reversal.
2. Migration **044** reconciles existing strands. Applied to prod —
   stranded count is now 0. The one strand was Ruth's old account
   (distributor id 7, code `LL-JX-GRBR`), which has been flipped inactive
   with a full audit-log row.

This does **not** affect her current signup attempt under
`rymiruzz@gmail.com` — that's a separate user_id.

## What would make the next attempt by Ruth fully debuggable

I deliberately did **not** wire Sentry breadcrumbs into the signup route
in this session — it's the kind of change you want to think about for a
money path, and it's the next thing I'd ship in this area. Two specific
moves, ranked:

1. **Structured log + Sentry breadcrumb at every early-return** in
   `/api/partner-signup/init` (sponsor lookup, profile lookup, address
   lookup, Zod parse). Tag with `user_id` + `error_class`. ~30 minutes.
2. **A `signup_attempts` audit table** that records the request shape
   (with phone partially redacted) at the very top of the route. So even
   a 400-on-parse leaves a trail you can read from the admin panel. ~1
   hour including admin viewer.

Say the word and I'll do them. Otherwise: ask Ruth the three questions
above and the answers will pin it.

## Cross-references

- `docs/go-live-mpesa.md` — the M-Pesa Go-Live runbook
- `docs/PROJECT-BRIEF.md` §4 — payments status (sandbox 542542 is correct)
- Migration 044 (this session) — stranded-distributor reconcile
- `src/app/(admin)/admin/system/users/actions.ts` — soft-delete fix
- `src/app/api/partner-signup/init/route.ts` — the route Ruth's submit
  hits; trace the steps top-to-bottom to map a failure to its return point
