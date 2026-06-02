# Daraja via PayHero — onboarding (sandbox → live)

For: Ashish · Written: 2026-06-02.
Companions:
- `docs/go-live-mpesa.md` — the technical Go-Live runbook (env vars, callback URLs, smoke test).
- `scripts/payhero-smoke.mjs` — the operator tool for verifying each step.

**Your screenshot context.** You opened the Safaricom Daraja developer
portal and saw your sandbox app "Loveli Luxury Perfumes" (Consumer Key,
Consumer Secret, Passkey: N/A, Short Code: N/A, Products: M-PESA EXPRESS
Sandbox). PayHero asked you for these credentials. **That's correct
behaviour** — PayHero's onboarding takes the customer's own Daraja
credentials and uses them to make M-Pesa calls on your behalf.

This doc walks you through the rest of the chain.

## The big picture

Three Safaricom artifacts you need before launch, each from a different
team:

| Artifact | What it is | Who issues it | How long |
|---|---|---|---|
| **Daraja app** | API key pair (Consumer Key + Secret) to authenticate to the M-Pesa API. You already have a SANDBOX one. | Safaricom Developer Portal (self-serve) | ~5 min |
| **M-Pesa Shortcode** (Paybill or Till) | The number customers actually pay to. You don't have this yet (Short Code: N/A). | Safaricom Commercial M-Pesa team | 1–4 weeks |
| **Daraja Go-Live approval** | Promotes your sandbox app to a Production app, tying it to your Shortcode and issuing a LIVE Passkey. | Safaricom Daraja team (review process) | 1–3 weeks after you submit |

You can run on SANDBOX for development (using the well-known test
shortcode `174379` and the published sandbox passkey) right now. But to
take real money, you need the Shortcode + Go-Live in your name.

Once those land, you give PayHero the LIVE values, PayHero updates your
PayHero channel to live, and you swap the Vercel env from sandbox to
live. Code change: zero (env vars only).

---

## Step 1 — (Today, ~5 min) Fill the sandbox Passkey + Shortcode

For sandbox testing, Safaricom publishes a single shared test
shortcode + passkey for everyone. Adding them to your Daraja app makes
the app fully usable in sandbox:

- **Sandbox Shortcode:** `174379`
- **Sandbox Lipa Na M-Pesa Online Passkey:**
  `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`

Go to the same Daraja portal page → your "Loveli Luxury Perfumes" app
→ edit → set those two values → save.

**Verify** — the app card should now show real values for both Passkey
and Short Code (not N/A). You can also do a quick raw-Daraja test from
the portal's "Try It Out" interface against the M-PESA Express endpoint.

This is enough for sandbox testing AND for sharing with PayHero so they
can configure your sandbox channel. **It does not let you take real
money** — that's Step 2 + 3.

---

## Step 2 — (Start NOW, longest lead time) Apply for an M-Pesa Shortcode

This is a separate Safaricom commercial process from Daraja. You can do
it in parallel with the rest, but **it has the longest lead time** —
start today, even if everything else slips.

Two options:
- **Paybill** — better for partner-program payouts + business
  accounting. Recommended for Loveli.
- **Till Number** — simpler but more limited (no B2C payouts to
  customers, just C2B).

How to apply:

1. Visit https://www.safaricom.co.ke/business/sme/sme-products/m-pesa
   or walk into any Safaricom Business Centre with your business KYC
   documents (Certificate of Incorporation, KRA PIN, director IDs,
   business permit).
2. Apply for a **Paybill** in the name of "Loveli Luxury" (or the
   registered company name).
3. Safaricom processes in 1–4 weeks. They'll issue the Shortcode
   number and the initial credentials.

**Critical**: the Paybill must be opened in the name of the entity that
will own the Loveli Luxury business. Personal-name shortcodes won't pass
Daraja Go-Live for a commercial product.

---

## Step 3 — (After Step 2) Apply for Daraja Go-Live

This promotes your sandbox app to production and links it to the
Paybill from Step 2. **You cannot do this without the Paybill from
Step 2.**

1. In the Daraja portal, on your "Loveli Luxury Perfumes" app, look for
   a **"Go Live"** or **"Apply for Production Access"** button.
2. Safaricom asks for:
   - Your Paybill / shortcode number (from Step 2)
   - Business documents (KYC again — sometimes new uploads)
   - A description of the product (something like: "E-commerce platform
     selling fragrance products with M-Pesa STK Push checkout and B2C
     payouts to affiliate partners")
   - Your callback URLs — **for our setup, you give them the PayHero
     callback URL, not ours.** PayHero will tell you the exact one to
     register. (Don't put a Loveli URL here unless you're going direct
     to Daraja, which is Path B.)
3. Submit. Safaricom reviews in 1–3 weeks. They sometimes come back
   with clarifying questions — answer promptly.
4. On approval, the app issues you a **LIVE Consumer Key + Consumer
   Secret + Passkey** (different from sandbox), and the Shortcode is
   tied to it.

---

## Step 4 — Share the LIVE credentials with PayHero

You mentioned PayHero has a page that requests these. Once Step 3
approves, paste each of these from your Daraja app card into PayHero's
credential request form:

| Field on PayHero side | What you give them |
|---|---|
| Consumer Key | LIVE value from your Daraja app card (after Go-Live) |
| Consumer Secret | LIVE value (use Daraja's "Show" / "Copy" button — keep secure) |
| Passkey | LIVE LNM Passkey (no longer "N/A") |
| Short Code | Your Paybill number (no longer "N/A") |
| Initiator / Security credential (if asked) | For B2C only — Safaricom issues these alongside the LIVE app. Ask PayHero exactly what shape they want them in. |

**Sandbox vs Live**: if PayHero asks you for SANDBOX credentials first
(to test their integration), use the values from Step 1. When LIVE
lands, you update the same form with the live values.

**If PayHero's page asks for something not listed above**, screenshot
that page and send it to me — onboarding pages do change and I want to
give you exact instructions per their current form, not a guess.

---

## Step 5 — PayHero issues your LIVE channel IDs

After you submit the LIVE credentials, PayHero:
1. Creates a LIVE M-Pesa STK channel bound to your Paybill. You get a
   new numeric channel id (replaces the current sandbox `8238`).
2. Creates a LIVE B2C channel for payouts. You get another numeric
   channel id (this is what fills the missing
   `PAYHERO_CHANNEL_ID_B2C`).
3. May issue a new API auth token, or keep the existing one — they'll
   tell you.

You'll see these in your PayHero dashboard → Channels.

---

## Step 6 — Swap Vercel env vars to LIVE

In Vercel dashboard → `loveli-luxury` project → Settings →
Environment Variables → Production scope, update:

| Var | From | To |
|---|---|---|
| `PAYHERO_CHANNEL_ID_STK` | `8238` (sandbox) | LIVE channel id from Step 5 |
| `PAYHERO_CHANNEL_ID_B2C` | (unset) | LIVE B2C channel id from Step 5 |
| `PAYHERO_AUTH_TOKEN` | sandbox token | LIVE token from Step 5 (if PayHero rotated it) |
| `PAYHERO_WEBHOOK_TOKEN` | current value | **keep the same** unless you have a reason to rotate. Re-rotating means re-registering the callback URLs in PayHero too. |

Also: **delete the stale `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`** while
you're in there. It's a placeholder, no credential leak, but it has no
business being in the env any more.

After saving env vars in Vercel, **redeploy** so the new functions pick
them up:

```bash
cd D:\loveli-luxury-phase1-scaffold\loveli-luxury
vercel deploy --prod --yes
```

---

## Step 7 — Register BOTH callback URLs in PayHero

PayHero needs to know where to POST callbacks. From inside PayHero's
dashboard, on each of your two LIVE channels:

| Channel | Callback URL |
|---|---|
| STK (C2B inbound) | `https://loveli-luxury.vercel.app/api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>` |
| B2C (outbound payouts) | `https://loveli-luxury.vercel.app/api/payhero/payout-webhook?key=<PAYHERO_WEBHOOK_TOKEN>` |

**These are two different routes.** Registering only the STK one is
the most common cause of "M-Pesa is broken" reports — every payment
completes on the customer's phone but their order stays `pending` on
our side because the callback never lands. The B2C analogue: every
partner payout fires but never marks `completed` in our DB.

**Note**: do not paste the literal text `<PAYHERO_WEBHOOK_TOKEN>` into
PayHero. Replace it with the real 64-char value, which you can copy from
Vercel (Settings → Environment Variables → `PAYHERO_WEBHOOK_TOKEN` →
"Show value"). The value never has to leave Vercel + PayHero — it
doesn't go to GitHub or any other place.

Verify each URL with a browser GET — should return JSON like
`{ok: true, tokenAccepted: true, debug: {...}}`. We have a helper:

```bash
cd D:\loveli-luxury-phase1-scaffold\loveli-luxury
node --env-file=.env.local scripts/payhero-smoke.mjs --check-webhooks
```

---

## Step 8 — Smoke test with real money (one tiny transaction each way)

This is the test that proves everything from Step 1 to Step 7 works.
Use **your own M-Pesa number** — never a customer's — and tiny amounts
(KES 1 each):

```bash
# Inbound: STK push to your phone for KES 1
node --env-file=.env.local scripts/payhero-smoke.mjs --stk \
  --to=+254XXXXXXXXX --amount=1

# Outbound: B2C transfer of KES 1 to your phone
node --env-file=.env.local scripts/payhero-smoke.mjs --b2c \
  --to=+254XXXXXXXXX --amount=1
```

The script asks for typed confirmation each time and prints exactly
what it's going to send. Replace `+254XXXXXXXXX` with your real number.

After each fire, verify in the DB:

```sql
-- STK should produce a webhook delivery within ~30 seconds
SELECT received_at, event_id, event_type, processed_at
FROM webhook_deliveries
ORDER BY received_at DESC
LIMIT 5;

-- B2C should produce its own delivery, tagged 'payout.*'
SELECT received_at, event_type
FROM webhook_deliveries
WHERE event_type LIKE 'payout.%'
ORDER BY received_at DESC
LIMIT 5;
```

If either side produces no row in `webhook_deliveries` within 60s,
**the callback URL or token is wrong in PayHero** (Step 7). Fix and
re-fire.

---

## What to do RIGHT NOW (before any of the long-lead steps)

Three things you can do today that don't depend on Safaricom approval:

1. **Apply for the Paybill** (Step 2). Longest lead time. Start it
   immediately — even if you change your mind on something else, you'll
   want a Paybill.
2. **Complete sandbox Passkey + Short Code on your Daraja app** (Step 1).
   Five minutes. Lets you fully test the sandbox pipeline.
3. **Send me the PayHero credentials-request page.** I can write
   Step 4 to match the exact field names + shapes their form expects,
   so the day Go-Live lands you don't lose hours on form-filling.

Steps 3, 5, 6, 7, 8 all queue behind Step 2 + Daraja Go-Live.

---

## Failure modes to watch for

These are the things that bite teams during this onboarding. Knowing
them in advance saves days.

- **Paybill name mismatch.** If the Paybill is opened in a name that
  doesn't match the Daraja Go-Live application, Safaricom rejects
  Go-Live and you start over. Match the names exactly.
- **Sandbox-passkey-on-live.** If you accidentally leave the sandbox
  passkey on your live channel, every payment fails. PayHero usually
  catches this, but worth knowing.
- **Two different webhook URLs.** Register both. See Step 7.
- **Token rotation breaks callbacks.** If you rotate
  `PAYHERO_WEBHOOK_TOKEN` in Vercel, the callback URL embedded in
  PayHero still has the OLD value — every call returns 401 and orders
  stay `pending`. Either don't rotate after launch, or update both
  sides in lockstep.
- **B2C requires a funded wallet.** Empty wallet = `initiateB2C`
  succeeds-looking but the actual transfer fails async via webhook.
  Top up before you smoke-test Step 8.

---

## Quick reference: where each value lives once launch is done

| Value | Lives in | Set by |
|---|---|---|
| Daraja Consumer Key (LIVE) | Safaricom Daraja app + PayHero account | Safaricom on Go-Live approval |
| Daraja Consumer Secret (LIVE) | Same | Same |
| Daraja Passkey (LIVE) | Same | Same |
| M-Pesa Shortcode (LIVE Paybill) | Same | Safaricom Paybill team |
| PayHero LIVE STK channel id | `PAYHERO_CHANNEL_ID_STK` in Vercel | You, after PayHero issues it |
| PayHero LIVE B2C channel id | `PAYHERO_CHANNEL_ID_B2C` in Vercel | Same |
| PayHero auth token | `PAYHERO_AUTH_TOKEN` in Vercel (marked sensitive) | PayHero |
| Webhook URL token | `PAYHERO_WEBHOOK_TOKEN` in Vercel (marked sensitive) + each PayHero callback URL | You, on initial setup |
| Callback URLs | PayHero dashboard, on each channel | You, per Step 7 |
