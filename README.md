# Loveli Luxury International

Ecommerce + MLM platform for Loveli Luxury International, a Kenya-first luxury perfume brand expanding globally.

**Stack:** Next.js 14 (App Router) · TypeScript strict · Supabase (Postgres, Auth, RLS) · Flutterwave (unified collect + payout) · Tailwind · Vitest

**Status:** Phase 1 scaffold. Foundation, schema, commission engine, salary calculator. Catalog, checkout, distributor portal in progress.

---

## Quick start

```bash
# 1. Install Node 20+
node --version

# 2. Install dependencies
npm install

# 3. Copy env template and fill in real values
cp .env.example .env.local
# Edit .env.local with values from Supabase + Flutterwave dashboards

# 4. Run dev server
npm run dev
# → http://localhost:3000

# 5. Run tests
npm test

# 6. Type check
npm run typecheck
```

---

## Project structure

```
loveli-luxury/
├── src/
│   ├── app/                      Next.js App Router pages and layouts
│   ├── components/               Reusable UI (shadcn/ui base)
│   ├── lib/
│   │   ├── env.ts                Zod-validated environment variables
│   │   ├── money.ts              BigInt minor units, basis points math
│   │   ├── flutterwave/          Payment + payout service
│   │   ├── mlm/
│   │   │   ├── commission-calculator.ts    Pure function, fully tested
│   │   │   ├── salary-calculator.ts        Two-condition qualifier
│   │   │   └── types.ts
│   │   └── supabase/
│   │       ├── client.ts         Browser client (RLS-enforced)
│   │       ├── server.ts         Server Component client
│   │       └── service.ts        Service-role client (bypasses RLS, server-only)
│   ├── middleware.ts             Auth refresh on every request
│   └── types/database.ts         Supabase-generated types
├── supabase/migrations/
│   └── 001_initial_schema.sql    22 tables, 47 RLS policies, full seed config
├── tests/
│   ├── unit/                     Vitest unit tests (TDD-first)
│   ├── integration/              DB integration tests (Phase 6)
│   └── fixtures/
│       └── comp-plan-examples.ts  Worked examples from PDF as canonical fixtures
├── scripts/
│   └── check-secrets.sh          Pre-commit + CI secret scanner
├── .github/workflows/ci.yml      Typecheck, lint, test, build, secret scan
├── next.config.js                CSP, HSTS, frame-deny, permissions policy
├── tsconfig.json                 strict + noUncheckedIndexedAccess
└── vitest.config.ts              80% coverage threshold on src/lib
```

---

## Security policy (NON-NEGOTIABLE)

This project follows strict industry-standard security from the start. Violations require full rebuild, not patches.

1. **No hardcoded credentials.** All secrets in `.env.local` (gitignored) or platform env vars
2. **`.env*` files are forbidden in git.** Pre-commit hook + CI block them
3. **RLS is mandatory** on every Supabase table. No exceptions
4. **Service-role key is server-only.** Never imported into client components
5. **Webhook signatures are verified** before any DB write
6. **CSP, HSTS, frame-deny** set in `next.config.js` and enforced by Cloudflare in production
7. **Branch protection on `main`.** No direct pushes. PRs require passing CI + review
8. **Audit log writes** on every config change. Immutable, no UPDATE or DELETE policy

If a credential leaks: rotate immediately, audit logs, do NOT patch in place. Treat the project as compromised and follow the incident runbook.

---

## Commission engine

Core logic in `src/lib/mlm/commission-calculator.ts`. Pure function, no DB calls. Tested against the PDF worked examples as canonical fixtures.

Run the tests to see assertions matching every numeric example from the comp plan:

```bash
npm test
```

Expected output: all tests pass on numbers including:

- 30ml package → Kes 800 / 360 / 200 / 120 / 80 / 40 / 40 across levels 1–7 (total Kes 1,640 = 41%)
- 50ml package → Kes 1,440 / 648 / 360 / 216 / 144 / 72 / 72 (total Kes 2,952 = 41%)
- Bronze month 1 example → Kes 8,400 gross, Kes 3,900 net after starter pack
- Gold active month example → Kes 67,000 gross
- Gold performance bonus → 2% × Kes 50,000 excess = Kes 1,000

---

## Money handling

- **Storage:** BigInt minor units (cents). 1 KES = 100 cents
- **Rates:** Integer basis points. 20% = 2000bp. 1.5% = 150bp
- **Display:** Convert at the edge using `formatKes()`. Never display raw bigints
- **Database columns:** `BIGINT NOT NULL` ending in `_minor`. CHECK constraints reject negatives where appropriate
- **Floats are forbidden** in any commission, salary, or payout calculation

---

## Database schema

See `supabase/migrations/001_initial_schema.sql`. 22 tables in 9 domains:

1. Auth and profiles (with `user_role` enum)
2. Catalog (products, variants, bundles, bundle items)
3. Addresses and orders (with `order_kind` enum separating retail / signup / restock)
4. MLM core (distributors + closure-table tree capped at depth 7)
5. Config tables (commission rates, ranks, salary tiers, starter packages) with versioning via `effective_from / effective_until`
6. Commission ledger, monthly salaries, rank-up bonuses, payouts
7. GSV snapshots for fast monthly close
8. Audit log (append-only via RLS, superadmin reads only)
9. RLS policies on every table

---

## Phase 1 deliverables (this drop)

- ✅ Repo scaffold with Next.js 14 + TypeScript strict
- ✅ Database migration with full schema, RLS, indexes, seed config
- ✅ Money helpers and commission calculator with full test coverage
- ✅ Salary calculator
- ✅ Flutterwave service for collect + M-Pesa B2C payout
- ✅ Supabase client/server/service factories with correct boundaries
- ✅ Security headers in `next.config.js` (CSP, HSTS, X-Frame-Options, etc.)
- ✅ Pre-commit secret scanner
- ✅ CI workflow with TruffleHog
- ✅ Strict `.gitignore` covering all secret patterns
- ✅ Auth refresh middleware

## Phase 2 next (catalog and bundles)

- Product/variant/bundle CRUD admin pages
- Public catalog with SSG product pages
- Bundle UX referencing flatstomachtea.co.za depth
- Cart with Zustand persistence
- Inventory tracking

---

## Owner

Built by **Abala (NexDocs / Mbogiwood Productions)** for Loveli Luxury International.
