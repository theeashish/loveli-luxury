-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMMISSION DOUBLE-PAY GUARD (DB-LEVEL)
-- =============================================================================
-- Migration:   040_commission_ledger_dedupe_guard.sql
-- Date:        30 May 2026
-- Purpose:     Make double-payment of commissions IMPOSSIBLE at the database
--              level, not merely improbable at the application level.
--
-- Why:         write_commission_ledger (migration 014) guards a repeat run with
--              a check-then-act test:
--                  SELECT COUNT(*) ... WHERE source_order_id = p_order_id;
--                  IF v_existing > 0 THEN RETURN 0; END IF;
--              That correctly stops SEQUENTIAL repeats (e.g. the webhook, then
--              an admin reconcile minutes later). But it is a read-then-write
--              with no lock, so two callers firing CONCURRENTLY for the same
--              order (the PayHero webhook and the /status self-heal poll landing
--              in the same instant) can both read zero and both insert a full
--              set of rows — paying every upline twice. For a system that moves
--              real money the guarantee must live in the schema, not the app.
--
-- Invariant:   commission_ledger holds ONLY auto-written, per-order fan-out
--              rows. source_order_id is NOT NULL (migration 001), and manual
--              corrections live in the SEPARATE manual_ledger_adjustments table
--              (migration 018) — never here. So exactly one row per
--              (order, recipient, level) is correct, and we enforce it.
--
-- Guarantee:   The loser of any concurrent race takes a unique_violation; its
--              whole write_commission_ledger transaction rolls back while the
--              winner's rows stand. Exactly one set of commissions per order,
--              always. Verified against the live DB before shipping: zero
--              existing (source_order_id, distributor_id, level) duplicates.
--
-- Ops note:    If this index ever fails to build, the table already contains a
--              duplicate auto row — i.e. the race has already fired. That is a
--              finding, not a migration bug. Detection query:
--                SELECT source_order_id, distributor_id, level, COUNT(*)
--                  FROM commission_ledger
--                 GROUP BY 1,2,3 HAVING COUNT(*) > 1;
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_ledger_order_recipient_level
  ON commission_ledger (source_order_id, distributor_id, level);

COMMENT ON INDEX public.uq_commission_ledger_order_recipient_level IS
  'Airtight double-pay guard: at most one commission row per (order, recipient, '
  'level). Backs up the check-then-act guard inside write_commission_ledger '
  'against concurrent callers. Added migration 040 (2026-05-30).';

-- =============================================================================
-- END OF MIGRATION 040
-- =============================================================================
