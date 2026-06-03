# Archived documentation

This directory holds documentation that was canonical at the time of writing
but has been superseded by a later decision. Files here are kept on disk so
the chain of reasoning (and the operational runbooks that were live at the
time) remains discoverable for future audit. None of these documents
describe how the platform works today.

## PayHero → IntaSend migration (2026-06-03)

Owner decision (2026-06-03): the platform retired PayHero entirely in
favour of IntaSend. See `docs/intasend-migration-2026-06.md` for the
canonical migration narrative; everything below is the pre-cutover record.

- **`go-live-mpesa.md`** — PayHero sandbox → production switchover runbook.
  Superseded by the IntaSend onboarding flow in the same migration doc.
- **`daraja-via-payhero-onboarding.md`** — end-to-end Safaricom Daraja
  setup via PayHero (C2B credentials, B2C support-ticket path, webhook
  registration). IntaSend abstracts Daraja so this is no longer required.
- **`mpesa-signup-debug-2026-05-30.md`** — diagnosis of a specific PayHero
  STK push failure during a 2026-05-30 partner signup. Provider-specific.
- **`PAYHERO_CUTOVER.md`** — the original Flutterwave → PayHero cutover
  notes. Doubly historical now (both providers retired).

If a future ops task ever needs the PayHero runbooks (e.g. reconciling an
ancient settlement), the files are here. Treat the live `docs/` content as
the source of truth for everything else.
