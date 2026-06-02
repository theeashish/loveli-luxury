# Legal Review Packet — Loveli Luxury Scents Partner Program

For: a Kenyan lawyer reviewing the compensation plan and partner program
before real-money launch.
Prepared: 2026-05-31. Owner: Ashish (capernstone@gmail.com). Client/admin:
Ruth Karimi (rymiruzz@gmail.com).

**The ask.** Loveli Luxury Scents operates a partner program with multi-level
commissions for retail fragrance sales in Kenya. We want a Kenyan
lawyer to confirm the plan + program rules + customer-facing T&Cs are
defensible under Kenyan law, give us specific language to change if not,
and flag anything missing before we take real money.

The packet is structured so you can read it in 30–45 minutes and form an
opinion. Sections 1–4 are the substance; section 5 lists the specific
laws/regulations we believe apply; section 6 is the questions we're
asking you to answer.

---

## 1. What Loveli is

A premium fragrance e-commerce store with an invite-only partner program
attached. Two registers, deliberately separated in the product:

- **Retail.** Customers buy Eau de Parfum. Storefront, M-Pesa STK
  checkout, WhatsApp concierge, delivery in Kenya. This is the primary
  business.
- **Partner program.** A discreet, **invite-only** programme where
  approved individuals (we call them "partners" externally; "distributors"
  internally) sell to retail customers and earn commission on those
  sales, plus a residual on their downline's retail sales. Partners
  must have a sponsor — there is no self-signup.

The product separation is intentional: the partner program is *one* page
on the public site (`/partners`), reachable only via the footer or an
invite link. The home page itself never advertises the program. This is
section 1 of our launch posture: **partners only enter when invited; the
public storefront is fragrance retail.**

**Why this matters legally.** Kenya's regulatory environment (Section 5
below) draws a sharp line between **pyramid schemes** (income from
recruitment) and **legitimate multi-level marketing** (income from
genuine retail product sales). The whole platform is engineered to make
the latter provable in code and documentation.

## 2. The locked compensation plan (Ruth's adopted plan)

**Status:** locked 2026-05-22 (masterplan Appendix C), live in production
as of migrations 029 + 036.

### 2.1 The product economics

| Variant | Retail price | IBO (partner) price | Point Value (PV) |
|---|---|---|---|
| 50 ml Eau de Parfum | KES 2,800 | KES 1,400 | 700 PV |
| 30 ml Eau de Parfum (optional) | KES 1,500 | KES 700 | 350 PV |

Commission is calculated as `PV × rate%` (integer arithmetic in minor
units; no floating-point money math anywhere in the system). A 50 ml
sale therefore generates KES 140 at level 1 (700 × 20% / 100), KES 77
at level 2, and so on down the table.

### 2.2 The five ranks

| # | Rank | Personal Active Customers (PAC) per qualifying month | Active recruits | Group sales target (KES/mo) | One-time rank bonus | Monthly lifestyle bonus |
|---|---|---|---|---|---|---|
| 1 | Ambassador | 5 | 5 | 100,000 | KES 5,000 | – |
| 2 | Executive | 20 | 10 | 300,000 | KES 15,000 | KES 5,000 |
| 3 | Gold Director | 50 | 20 | 750,000 | KES 40,000 | KES 20,000 |
| 4 | Platinum Director | 80 | 50 | 2,500,000 | KES 120,000 | KES 100,000 |
| 5 | Crown President | 130 | 120 | 7,500,000 | KES 300,000 | KES 250,000 |

**Qualifying months requirement:** a partner must hold the target levels
for 2–3 consecutive months (per rank) to actually achieve the rank.
Active customer count is computed from real, paid, non-refunded orders.

### 2.3 The commission rates (5 levels deep, "unilevel" structure)

| Level | Rate (of PV) | KES per 50ml bottle |
|---|---|---|
| L1 (direct sponsor) | 20% | 140 |
| L2 | 11% | 77 |
| L3 | 6% | 42 |
| L4 | 2% | 14 |
| L5 | 1% | 7 |
| **Total payout per bottle** | **40%** | **280** |

**Rank gate** (locked in code and SQL): a partner at rank N earns on
levels 1..N only. So an Ambassador earns L1 only (no override income at
all until they hit Executive). The rank gate is the structural feature
that prevents "I'm at the top of the tree and I get paid no matter what
my downline does" — the partner must climb the rank ladder by personal
retail performance to unlock deeper levels.

### 2.4 What is NEVER commissionable (locked in the SQL engine)

This is the most important paragraph of this packet:

> Commissions fire ONLY on **paid retail orders**. The
> `write_commission_ledger` SQL function refuses to run on unpaid orders.
> Recruiting a partner pays nothing. A partner's own starter-kit
> purchase is not commissionable. Refunded orders trigger a clawback
> against the same partners who earned on them. This is enforced in
> the database, not just in policy — see `migration 014` + `migration
> 040` (the UNIQUE-index double-pay guard).

The full SQL function carries a `COMMENT` documenting this invariant
(`migration 043`) so it is provable by introspection.

## 3. The customer-facing program rules (the "/ids" page)

Live at `https://loveli-luxury.vercel.app/ids` (Income Disclosure
Statement). The page is **non-negotiable copy** — it states the program
rules in plain language, ABOVE any aspirational content, including:

> 1. Commissions only fire on confirmed retail sales. Recruiting a
>    partner pays nothing.
> 2. A partner's own starter purchase is not commissionable.
> 3. Refunded orders trigger a clawback against the same partners who
>    earned on them.
> 4. Maintenance: a partner must place verified retail sales each month
>    to remain active.
> 5. **No income is guaranteed. Earnings depend entirely on retail
>    performance.**

The page also reserves space for **published earnings statistics**
(median monthly earnings, % of partners earning > 0, recoup rate, top
5% earnings) which today shows "DATA PENDING" pending real partner
history — see Section 6 question 3 below.

## 4. The customer + partner policies (live)

The site already publishes three policy pages:

- `/policies/authenticity` — provenance + storage + the "if you suspect
  a fake, we test on our cost" promise.
- `/policies/delivery` — service area, delivery windows, free-delivery
  threshold.
- `/policies/refund` — 7-day sealed-only refund window; refunded orders
  void any commission they earned (links back to /ids).

There is **not yet a separate Partner Agreement** for the partner
program. Today the program rules at `/ids` + the policies above are the
only legal-text surfaces. Section 6 question 2 asks you what additional
surface (PDF? click-through during signup?) is required by Kenyan law.

## 5. The regulatory landscape we believe applies

These are the laws + regulators we want you to assess the plan against.
**Tell us if anything is missing.**

### 5.1 Direct/MLM-specific

- **Pyramid Schemes (Prohibition) Act 2007** (Cap 502, Kenya). Section 2
  defines a pyramid scheme. **Our model is engineered to be the
  opposite of what the Act prohibits:** income from retail sales of a
  real product, not from recruitment fees. The IBO price (KES 1,400 for
  a bottle that retails at KES 2,800) is a real wholesale margin, not
  a "membership fee".
- **Sale of Goods Act (Cap 31)** — applies to every retail order.
- **Consumer Protection Act 2012** — applies to every retail customer
  (delivery, refund, false advertising, etc.).

### 5.2 Payments + AML

- **Central Bank of Kenya (CBK)** prudential guidelines for mobile
  money. PayHero is a CBK-licensed M-Pesa aggregator; partner payouts go
  via M-Pesa B2C. We are not an FI ourselves.
- **Proceeds of Crime and Anti-Money Laundering Act (POCAMLA) 2009.**
  Partner payouts are reportable above thresholds — we keep an
  immutable `audit_log` table that records every commission earned,
  every payout fired, every clawback. Section 6 question 4 asks
  whether we have all the KYC fields we need.
- **National ID** is collected at partner signup; **MSISDN** is verified
  by SMS (Africa's Talking) before any payout fires; the deactivation
  flow stores the previous email + the actor + before-data in the
  audit log for reversibility.

### 5.3 Data + privacy

- **Data Protection Act 2019.** We are a data controller. We collect
  email, phone, address, national ID (partners), and order history.
  Storage is on Supabase (EU-West-1). Access is gated by Row-Level
  Security (every table) and the service-role key is server-only.
- **Right to erasure** is implemented as a two-tier "delete user" admin
  action: a soft-delete (reversible; preserves audit) and a hard-delete
  that fully removes the auth user + profile + addresses + distributor
  row but **refuses** if the user has audit-required financial history
  (paid orders, earned commissions, payouts) — see
  `src/app/(admin)/admin/system/users/actions.ts`. Section 6 question 5
  asks if this satisfies the Act's erasure requirement.

### 5.4 Advertising + claims

- The masterplan and the IDS page enforce **no income claims** in any
  marketing copy. The simulator on `/ids` (when populated) defaults to
  median reality, not best case.
- Specific banned words enforced across copy: "*Discover, hand-crafted,
  craft / craftsmanship, journey, unlock*" plus em-dashes. This is
  brand discipline, not law; flag if any of these terms is *required*
  for some legal disclosure.

## 6. Specific questions we need you to answer

1. **Pyramid Schemes Act compliance.** Reviewing section 2.4 ("What is
   never commissionable") + section 2.3 (rank gate + retail-tied
   commissions) + section 3 (program rules) — is there anything in the
   plan that would expose Loveli to a complaint under Cap 502? If yes,
   what specifically would you change?

2. **Partner Agreement.** Do the existing /ids + /policies/* surfaces
   suffice as the legal "agreement" between Loveli and a partner, or
   does Kenyan law require a discrete signed (or click-through) Partner
   Agreement at signup? If a click-through is enough, can you draft (or
   approve) the language we should show?

3. **Income Disclosure Statement.** The /ids page exists as a
   placeholder waiting for real data. (a) Is publishing an IDS *required*
   under any Kenyan law, or is it best practice we're adopting? (b) What
   specific stats do you require us to publish before launch, and what
   methodology language must accompany them?

4. **KYC.** Today partner signup collects national ID + DOB + payout
   MSISDN + a verified-by-SMS link between the partner and the MSISDN.
   Is this enough for POCAMLA at our expected transaction volumes
   (we'd estimate KES 1–5M/month gross sales in year one)? Is there a
   threshold at which we have to do more (proof of address,
   declaration of beneficial owner, etc.)?

5. **Data Protection Act 2019.** (a) Does our two-tier delete model
   (soft = reversible + audit preserved; hard = refuses on financial
   trail) satisfy the right-to-erasure? (b) What additional disclosures
   must we put on the site for compliance — privacy policy URL, DPO
   contact, data-retention timelines?

6. **Tax.** Partner commissions: are they (a) employment income, (b)
   self-employed business income, or (c) miscellaneous income? Who is
   responsible for withholding — Loveli or the partner? Does VAT
   apply to commissions? (Our current default is treating partners as
   self-employed and not withholding; tell us if this is wrong.)

7. **Disputes.** If a partner disputes a clawback, what venue applies?
   Do we need an arbitration clause baked into the Partner Agreement?

## 7. What's already enforced in the code (so you don't have to take our word)

The following are **provable from source** — not promises, but constraints
the system runs on:

| Claim | Where it lives in code |
|---|---|
| Commission only fires on `status = 'paid'` orders | `supabase/migrations/014_comp_plan_v2_pv.sql` (`write_commission_ledger` body line 350+); `supabase/migrations/043_commission_ledger_invariant_comment.sql` pins the rule as a SQL COMMENT on the function |
| At most one commission_ledger row per (order, recipient, level) | `supabase/migrations/040_commission_ledger_dedupe_guard.sql` (DB-level UNIQUE index) |
| Rank gate (rank N earns L1..N only) | `migration 014`, `write_commission_ledger`, `v_recipient_max_level` check |
| No recruitment commission, no self-purchase commission | Same function; `is_commissionable` flag on order_items + the `status='paid'` gate together prevent it |
| Refunded orders trigger clawback | `supabase/migrations/008_commission_clawback.sql` + `migration 011` (clawback_resolutions audit) |
| Money math in BIGINT minor units (no floats) | All `*_minor` columns BIGINT; `src/lib/money.ts` for formatters |
| All money paths through service-role + RPCs, not client | `src/lib/supabase/service.ts` is server-only; PostgREST RLS on every table |
| Payout requires verified MSISDN | `src/app/(admin)/admin/payouts/[id]/actions.ts` lines 65–89 |
| Payouts are admin-fired only (no auto-payout, no self-service request) | Same file + `src/app/(admin)/admin/payouts/bulk-actions.ts` (the only paths that call `initiateB2C`) |
| Soft-deleted users cannot keep earning | `src/app/(admin)/admin/system/users/actions.ts` (flips `distributors.is_active=FALSE`) + `migration 044` (reconciles prior strands) |
| Immutable audit log | `supabase/migrations/001_initial_schema.sql` audit_log table; INSERT policy on `migration 033` blocks actor_id forgery |

If you want to inspect any of these, the repo is on GitHub
(theeashish/loveli-luxury), `main` branch.

## 8. The launch posture we're asking you to bless

Real-money launch requires three things to clear in order:

1. **Safaricom Daraja Go-Live approval** (external, in flight).
2. **This legal review** complete with no blocking findings, OR with a
   defined punch-list we agree to ship before launch.
3. **A real catalog** seeded (in progress — see
   `docs/catalog-seeding-playbook.md`).

Once those three clear we run the M-Pesa Go-Live runbook
(`docs/go-live-mpesa.md`) and the system goes live.

## 9. Cost + timeline ask

We'd like:
- A written opinion within **2 weeks** of you receiving this packet.
- A flat fee (your call) covering: this review, one round of revisions
  on any clauses you want changed, and sign-off after revisions land.
- If anything in this packet needs longer than 2 weeks, the longest item
  + its eta is more useful than a vague "let me get back to you."

Reach Ashish at `capernstone@gmail.com` or Ruth at `rymiruzz@gmail.com`.
The whole system is online and you can ask for read-only credentials
to the admin panel if useful.

---

*Document is versioned in the repo at `docs/legal-review-packet.md`. If
this is the version you receive, the git commit SHA is at the top of
the file's history and any subsequent change will be flagged before we
ship to launch.*
