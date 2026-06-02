# M-Pesa Go-Live Runbook (PayHero + Daraja, C2B + B2C)

Last hardened: 2026-05-31. Companion: `scripts/payhero-smoke.mjs` —
tiered smoke tool referenced throughout this runbook.

**Status:** the payment code is production-ready and provider-agnostic.
Sandbox vs production is a configuration switch (PayHero dashboard +
Vercel env vars), not a code change. Re-verified 2026-05-31: no hardcoded
sandbox paybill, channel id, or sandbox URL anywhere in the codebase.

## What this runbook covers

Two directions, both through PayHero:

| Direction | What it is | App call | Webhook the app exposes |
|---|---|---|---|
| **C2B** (STK push) | Customer pays via M-Pesa Express prompt | `POST /api/v2/payments` (`PAYHERO_CHANNEL_ID_STK`) | `POST /api/payhero/webhook?key=…` |
| **B2C** (payout) | App pays a partner's M-Pesa | `POST /api/v2/withdraw` (`PAYHERO_CHANNEL_ID_B2C`) | `POST /api/payhero/payout-webhook?key=…` |

**Critical: the two webhook URLs are different routes.** Both must be
registered separately in the PayHero dashboard. A common cause of
"M-Pesa is broken" is registering only the STK callback and assuming
B2C uses the same one. It doesn't.

---

## Go-Live, in order

Each step has a verification immediately after it. Don't move to the
next step until the verification passes. If a step fails, **stop and
diagnose** — sandbox lets you reproduce most of these without spending
real money. Real-money launch costs more than a 20-minute rollback.

### Step 1 — Safaricom Daraja Go-Live (external; owner; ~1–4 weeks)

This is the only blocker we cannot accelerate. Daraja is Safaricom's
M-Pesa API. PayHero is the gateway that talks to Daraja for us. Until
Daraja approves the production shortcode, real money cannot move.

- Sandbox today uses paybill **542542** — this is correct, not a
  misconfiguration. Do not "fix" it until production credentials are
  approved.
- Planned production target: paybill **174379**, store **8846**.
  **Confirm with Safaricom AND PayHero before switching** — paybill
  numbers can be reassigned during the approval process.

**Verification:** Safaricom emails confirmation of production access for
the shortcode. Keep that email.

### Step 2 — PayHero LIVE channels

In the PayHero dashboard:

1. Create or activate a **LIVE M-Pesa STK channel** bound to the
   production shortcode from step 1. Record the numeric channel id.
2. Create or activate a **LIVE B2C channel** for payouts. Record its
   channel id.
3. Generate a fresh API token in **API Keys**. (You can keep the
   sandbox token if you want, but rotating at the cutover is cleaner
   forensically — if something goes wrong you can tell whether you
   were running on the old or new token.)

**Verification:** dashboard shows both channels in "Active" state with
the live shortcode.

### Step 3 — Set production env vars in Vercel

Project → Settings → Environment Variables → **Production scope**:

| Var | Source | Value shape |
|---|---|---|
| `PAYHERO_AUTH_TOKEN` | PayHero dashboard "API Keys" | A long base64-ish string. **No `"Basic "` prefix.** Paste exactly what the dashboard shows. |
| `PAYHERO_CHANNEL_ID_STK` | Step 2.1 | Numeric, e.g. `1234` |
| `PAYHERO_CHANNEL_ID_B2C` | Step 2.2 | Numeric, e.g. `5678` |
| `PAYHERO_WEBHOOK_TOKEN` | Generate: `openssl rand -hex 32` | Min 20 chars; keep it stable across rotations unless you have a leak reason |
| `ENABLE_PAYOUTS` | — | Set to `true` only when you're ready for the B2C webhook to write to `payouts` rows. Until then, the payout webhook acknowledges but doesn't update anything. |

After saving the env vars in Vercel: **trigger a fresh deploy** so the
running functions pick up the new values:

```bash
vercel deploy --prod --yes
```

**Verification (run from your laptop, takes 30 seconds):**

```bash
# Pull the production env into a local file (don't commit it).
vercel env pull .env.production --environment=production

# Validate the values look right.
node --env-file=.env.production scripts/payhero-smoke.mjs --check-config
```

You should see ✓ for every variable and two callback URLs printed at
the bottom — these are what you'll register in step 4.

### Step 4 — Register BOTH callback URLs in PayHero

PayHero does not sign webhooks. The security model is the URL secret
itself: we embed `?key=<PAYHERO_WEBHOOK_TOKEN>` in the URL we register,
and the app's webhook route timing-safe-compares the received key
against the env value. If the token is wrong, the customer pays on
their phone but the order stays `pending` forever. **This is the single
most common "M-Pesa is broken" cause.**

In the PayHero dashboard, set the callback URL on:

- **STK channel (C2B)** → callback URL:
  ```
  https://loveli-luxury.vercel.app/api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>
  ```
- **B2C channel** → callback URL:
  ```
  https://loveli-luxury.vercel.app/api/payhero/payout-webhook?key=<PAYHERO_WEBHOOK_TOKEN>
  ```

Use the exact URLs the smoke script printed in step 3.

**Verification:** the smoke script can GET each webhook URL and confirm
the token matches:

```bash
node --env-file=.env.production scripts/payhero-smoke.mjs --check-webhooks
```

You should see ✓ for both routes with `tokenAccepted: true`. If a route
returns `tokenAccepted: false`, the `?key=…` value you registered in
PayHero does not match `PAYHERO_WEBHOOK_TOKEN` in Vercel. Fix one or
the other; do not move on.

### Step 5 — Fund the B2C wallet

Top up the PayHero B2C float so partner payouts can settle. Start
modestly — a few thousand KES — until you've smoke-tested at least one
real B2C transfer. Reload as needed once you trust the flow.

**Verification:** PayHero dashboard shows the B2C wallet balance updated.

### Step 6 — Real-money smoke test (C2B + B2C, in that order)

This is the test that catches every config error from steps 1–4. **Use
your own phone number** — never a customer's — and tiny amounts (KES 1
each). The smoke script handles both sides.

**6.1 — STK push (C2B):**

```bash
node --env-file=.env.production scripts/payhero-smoke.mjs --stk \
  --to=+254XXXXXXXXX --amount=1
```

The script asks for typed confirmation, then fires the STK push. Your
phone rings within ~5 seconds. Enter the M-Pesa PIN. Money moves.

Then verify the webhook flowed all the way through:

```sql
-- Should return at least one row within ~30 seconds of the PIN entry.
SELECT event_id, event_type, signature_ok, processed_at
FROM webhook_deliveries
ORDER BY received_at DESC LIMIT 5;

-- For a real partner-signup or retail order placed via the site UI
-- (not the smoke script — that doesn't create an order in our DB),
-- you'll also see commission_ledger rows fan out within the same window.
```

If `webhook_deliveries` stays at zero rows after 60s, **the webhook URL
or token is wrong**. Re-do step 4.

**6.2 — B2C payout:**

```bash
node --env-file=.env.production scripts/payhero-smoke.mjs --b2c \
  --to=+254XXXXXXXXX --amount=1
```

Your phone receives KES 1 within seconds. The B2C webhook will fire and
the smoke script's synthetic `external_reference` (`PO-9990000…`) won't
match any real payouts row — the webhook handler will log
"payout … not found" and ack 200. **That's expected and correct
behaviour** for a synthetic transaction. What matters is that the
webhook **arrived and was processed**:

```sql
SELECT event_id, event_type, processed_at, error
FROM webhook_deliveries
WHERE event_type LIKE 'payout.%'
ORDER BY received_at DESC LIMIT 5;
```

### Step 7 — Drive ONE real signup end-to-end

The smoke script tests the gateway. Now test the **app** path through
the gateway. With a fresh phone or a test buyer account:

1. Visit `/partners/signup`, fill the form (real-looking values, KES 1
   starter package, your own M-Pesa number).
2. Submit. The STK panel should show "Check your phone".
3. Enter PIN. Within 30 seconds the panel should flip to success.
4. Confirm in the DB:

```sql
-- The order
SELECT id, order_number, status, paid_at, payhero_mpesa_receipt
FROM orders WHERE order_number = 'LL-2026-NNNNNN';

-- The webhook
SELECT * FROM webhook_deliveries WHERE body::text LIKE '%LL-2026-NNNNNN%';

-- The distributor row (signup orders provision one)
SELECT id, sponsor_code, is_active FROM distributors
WHERE user_id = (SELECT user_id FROM orders WHERE order_number = 'LL-2026-NNNNNN');

-- The commission ledger (will be empty if no sponsor upline; otherwise
-- you'll see 1-5 rows depending on chain depth + sponsor ranks)
SELECT level, amount_minor, distributor_id FROM commission_ledger
WHERE source_order_id = (SELECT id FROM orders WHERE order_number = 'LL-2026-NNNNNN')
ORDER BY level;
```

When this works, **the whole money flow is proven** — you can open the
gates.

---

## Rollback

Both directions roll back identically: restore the previous
`PAYHERO_CHANNEL_ID_STK` / `PAYHERO_CHANNEL_ID_B2C` / `PAYHERO_AUTH_TOKEN`
in Vercel env, redeploy. No code change. Customers who had pending
orders during the cutover window may need manual reconciliation via
`/admin/orders` (existing UI).

If you rotate `PAYHERO_WEBHOOK_TOKEN`, **also re-register both callback
URLs in PayHero with the new token** — otherwise the webhooks land at a
URL whose `?key=` no longer matches our env, and they get a 401.

---

## Code readiness (re-verified 2026-05-31)

- All PayHero config is env-driven (`src/lib/payhero/service.ts`,
  `src/lib/env.ts`). No hardcoded channel ids, paybills, or sandbox URLs.
- Webhook is idempotent (dedup table + `mark_order_paid` + migration 040
  UNIQUE on `commission_ledger(source_order_id, distributor_id, level)`),
  token-gated (timing-safe compare), and amount-checked.
- `apply-payment-success.ts` orchestrates the post-payment chain from
  five entry points (webhook, reconcile API, admin server-action, status
  self-heal, cron sweeper) — they all converge on the same idempotent
  RPC chain.

## Reliability gaps already addressed

- **Fixed 2026-05-28** — `payment_attempts` column drift (migration 030).
  See masterplan Appendix G.
- **Fixed 2026-05-30** — soft-delete didn't flip
  `distributors.is_active`, leaving stranded distributor rows that the
  commission engine kept including. Code fix in
  `src/app/(admin)/admin/system/users/actions.ts`, migration 044
  reconciles the one pre-existing strand. See masterplan + `docs/mpesa-signup-debug-2026-05-30.md`.
- **Confirmed 2026-05-30** — no real STK push has been driven through
  prod end-to-end yet (`webhook_deliveries` at 0 rows all-time, 4 paid
  orders were admin-reconciled). **Step 6 above is the first real test
  of the live path.** That's what the smoke script exists for.

## Cross-references

- `scripts/payhero-smoke.mjs` — operator tool referenced above.
- `tests/unit/payhero-smoke.test.ts` — pins the MSISDN validation rules
  so a typo in `--to=…` cannot reach the API.
- `tests/unit/payhero.test.ts` — pins the STK/B2C request shapes the
  app sends.
- `src/lib/payhero/service.ts` — the production STK + B2C + webhook
  helpers.
- `src/app/api/payhero/webhook/route.ts` — inbound STK callback handler.
- `src/app/api/payhero/payout-webhook/route.ts` — B2C callback handler.
- `docs/mpesa-signup-debug-2026-05-30.md` — Ruth's "no STK prompt"
  diagnostic.
- `docs/disaster-recovery-runbook.md` — what to do when something goes
  wrong after Go-Live.
