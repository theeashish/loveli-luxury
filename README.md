# Loveli Luxury Scents

Premium African fragrance commerce platform with an invite-only partner program.
Kenya-first, mobile-first, M-Pesa-native.

**Production:** https://loveli-luxury.vercel.app
**Stack:** Next.js 14 (App Router) · TypeScript strict · Supabase (Postgres + RLS) · PayHero (M-Pesa STK + B2C) · Vercel · Sentry · Resend · Tailwind · Vitest

---

## Quick start

```bash
# 1. Install Node 20+
node --version

# 2. Install dependencies
npm install

# 3. Copy env template and fill in real values
cp .env.example .env.local
# (Supabase + PayHero credentials live in your Vercel project)

# 4. Run dev server
npm run dev
# → http://localhost:3000

# 5. Run tests
npm test
```

---

## Canonical documentation

This repo's source of truth for *what* the system is and *what state it's in*
lives in `docs/`. Do not rely on this README beyond the quick start — it stays
deliberately minimal so the in-depth docs can stay authoritative.

- **`docs/PROJECT-BRIEF.md`** — owner-facing snapshot: what works today, what's
  pending, what the comp plan looks like. Read this first.
- **`docs/transformation-masterplan-2026-05.md`** — engineer-facing canonical
  state doc, with timestamped appendices (A–J) capturing every change since
  the May 2026 transformation kicked off.
- **`docs/delivery-punchlist-2026-05.md`** — the launch checklist (P0/P1/P2/P3
  with ownership tags).
- **`docs/go-live-mpesa.md`** — M-Pesa Daraja Go-Live runbook.
- **`docs/photography-render-brief-2026-05.md`** — owner brief for regenerating
  homepage product imagery on-brand.

---

## Workflow

- No git in this workspace — edits go straight onto main (solo-developer
  workflow, by owner preference).
- Vercel deploys are **manual**: `vercel deploy --prod --yes` from `loveli-luxury/`
  after every change. Push-to-main does NOT auto-deploy.
- Always run `npm run typecheck && npm test && npm run build` before deploying.

---

## License

Proprietary. © Loveli Luxury Scents.
