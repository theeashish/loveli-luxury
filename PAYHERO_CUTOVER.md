# PayHero cutover runbook

**Updated after reading the actual PayHero docs.** Important shape changes from the first draft:

- Auth: a **single pre-encoded token** from the PayHero dashboard (not username + password)
- Webhooks are **not HMAC-signed** by PayHero — we use a URL-secret instead
- Callback body is **flat JSON** with mixed casing, not `{response: {...}}`

Total time if everything works first try: 15 minutes.

---

## Step 1 — Apply migration 019 in Supabase

✅ Done. (Confirmed in your earlier message.)

---

## Step 2 — Generate `PAYHERO_WEBHOOK_TOKEN`

Run this in any terminal (Node 20+ on your machine works, or use a random-string generator online):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

You'll get something like `9c0fa6a9d8e7c54a91b3f5e2d6c8b4a73e1d2f9b8a7c6e5d4f3a2b1c9e8d7f6a`. **Save this value** — you'll paste the same string into two places: Vercel env (Step 3) and the PayHero dashboard callback URL (Step 4).

---

## Step 3 — Paste 4 env vars in Vercel

In Vercel → loveli-luxury → Settings → Environment Variables → **Add Environment Variable**, add these one at a time, all **Production**, all **Encrypted**:

| # | Name | Value | Where from |
|---|---|---|---|
| 1 | `PAYHERO_AUTH_TOKEN` | the pre-encoded Basic token | PayHero dashboard → API Keys → copy the "Basic Auth Token" or "API Key" value **without the `Basic ` prefix** |
| 2 | `PAYHERO_CHANNEL_ID_STK` | numeric channel id (e.g. `133`) | PayHero dashboard → Payment Channels → your STK push (Lipa na M-Pesa) channel |
| 3 | `PAYHERO_CHANNEL_ID_B2C` | numeric channel id | PayHero dashboard → Payment Channels → your B2C / Withdrawals channel |
| 4 | `PAYHERO_WEBHOOK_TOKEN` | the random hex string from Step 2 | You generated it above |

⚠ **Do not paste `PAYMENT_PROVIDER_DEFAULT` yet** — that's Step 6 (the actual flip).

If you previously added `PAYHERO_API_USERNAME` / `PAYHERO_API_PASSWORD` / `PAYHERO_WEBHOOK_SECRET` from an earlier draft of these instructions — **delete those rows**. We don't use them anymore.

---

## Step 4 — Register the callback URLs in PayHero dashboard

The webhook URLs include the token as a query parameter. PayHero just POSTs to whatever URL you tell it; the token gates who's allowed in.

Replace `YOUR_WEBHOOK_TOKEN` below with the same value you pasted into `PAYHERO_WEBHOOK_TOKEN`:

| Channel / context in PayHero | Callback URL to paste |
|---|---|
| STK Push channel callback | `https://loveli-luxury.vercel.app/api/payhero/webhook?key=YOUR_WEBHOOK_TOKEN` |
| B2C / Withdrawals callback | `https://loveli-luxury.vercel.app/api/payhero/payout-webhook?key=YOUR_WEBHOOK_TOKEN` |

In some PayHero accounts the callback URL is set per-channel (on the Payment Channels page). In others it's a single global URL. If global, just use the STK URL — payout callbacks will go through the same endpoint (we'll route by payload shape if needed — message me if this is what you see).

You can also pass the callback URL **per request** in the API body (the `callback_url` field) — our dispatcher already does this. So even if the dashboard-level URL is unset, every STK push call we make includes the correct URL inline.

---

## Step 5 — Smoke-test via `/admin/diagnostics`

(Migration 019 already applied means PayHero rows will surface useful info.)

1. Sign in as admin
2. Open `https://loveli-luxury.vercel.app/admin/diagnostics`
3. Click **Run diagnostics →**
4. In the result, scroll to the **PayHero** group:

```
ok  PAYMENT_PROVIDER_DEFAULT        flutterwave         ← will still say flutterwave; that's fine
ok  PAYHERO_AUTH_TOKEN              set
ok  PAYHERO_CHANNEL_ID_STK          set
ok  PAYHERO_CHANNEL_ID_B2C          set
ok  PAYHERO_WEBHOOK_TOKEN           set
ok  API reachable + auth ok         endpoint responded HTTP 4xx (token accepted)
```

If `API reachable + auth ok` is **fail** with "auth rejected (HTTP 401)" — your `PAYHERO_AUTH_TOKEN` value is wrong. Recheck the dashboard.

---

## Step 6 — Flip the provider switch

1. Vercel → Environment Variables → Add:
   - `PAYMENT_PROVIDER_DEFAULT` = `payhero` (Production, plain text)
2. Vercel → Deployments → ⋯ on latest production → **Redeploy** (~60s)

After redeploy lands, every new checkout init routes through PayHero STK push.

---

## Step 7 — End-to-end test order (real Kes 10)

1. Open `/distributors/signup` in an **incognito** window
2. Sign in as a non-admin, non-distributor test user (or sign up fresh)
3. Pick the cheapest starter bundle
4. Enter your phone number in the M-Pesa field (E.164: `+254...`)
5. Submit
6. The page switches to **StkPushPanel** — "Check your phone for the M-Pesa PIN prompt"
7. On your phone, enter your M-Pesa PIN
8. Within ~5 seconds of entering PIN:
   - PayHero hits `/api/payhero/webhook?key=…`
   - `mark_order_paid` flips the order to `paid`
   - `provision_distributor` creates the distributor row
   - `write_commission_ledger` writes the commission fanout
   - Panel polls `/api/payhero/status`, sees `paid`, redirects to `/checkout/return`
9. Visit `/account/distributor` — your portal renders with your new sponsor code

**Verify in Supabase SQL:**

```sql
SELECT
  o.order_number,
  o.status,
  o.payment_provider,
  o.payhero_mpesa_receipt,
  o.paid_at,
  (SELECT count(*) FROM commission_ledger WHERE source_order_id = o.id) AS commission_rows,
  (SELECT count(*) FROM webhook_deliveries WHERE event_id IN (
    SELECT body->>'reference' FROM webhook_deliveries WHERE provider='payhero'
  )) AS webhooks_received
FROM orders o
WHERE o.kind = 'distributor_signup'
ORDER BY o.created_at DESC
LIMIT 5;
```

Newest row should show: `status = paid`, `payment_provider = payhero`, an M-Pesa receipt number, `commission_rows >= 1`, and at least one webhook delivery recorded.

---

## Rollback

**Fast env-only:**

- Vercel → env → set `PAYMENT_PROVIDER_DEFAULT` = `flutterwave` → redeploy

**Full deploy rollback:**

- Vercel → Deployments → previous prod deploy → **Promote to Production**

Migration 019 stays applied (additive, no breakage). Env vars stay; if you flip back later they'll be there.

---

## After 7 days of stable PayHero

(Wait — don't do this now.)

1. Remove `src/lib/flutterwave/service.ts`
2. Remove `src/app/api/payments/webhook/route.ts` + `src/app/api/payouts/webhook/route.ts`
3. Drop `FLUTTERWAVE_*` env vars
4. `npm uninstall flutterwave-node-v3`
5. Migration to drop `orders.flutterwave_*` and `payouts.flutterwave_transfer_id`
