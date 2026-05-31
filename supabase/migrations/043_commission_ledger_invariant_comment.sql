-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMMISSION INVARIANT COMMENT
-- =============================================================================
-- Migration:   043_commission_ledger_invariant_comment.sql
-- Date:        30 May 2026
-- Purpose:     Pin the IDS-published invariant in the write_commission_ledger
--              function comment so the next engineer reading the SQL sees the
--              rule before the body.
--
-- The rule:    Commissions fire ONLY on confirmed retail sales. Recruitment
--              events pay nothing. Self-purchases that have not been paid pay
--              nothing. Unpaid orders pay nothing. The check-in-code lives at
--              the top of the function body (IF v_status <> 'paid' RAISE);
--              this comment makes it discoverable from \df, the dashboard, or
--              schema introspection without reading the body.
--
-- This is a NO-OP migration in behaviour — it's a metadata change only — but
-- it propagates the IDS commitment from the public page (/ids, migration 042)
-- into the engine itself, so a future migration that drops the unpaid check
-- has to also strip this comment. That's a deliberate speed bump.
-- =============================================================================

COMMENT ON FUNCTION public.write_commission_ledger(BIGINT) IS
  'Writes commission_ledger rows for a paid order. INVARIANT (published at /ids): '
  'commissions fire ONLY on confirmed retail sales. Refuses to run on unpaid orders. '
  'No commission is written for recruitment events, signup-package self-purchases '
  'that have not been paid, or unpaid restocks. Idempotent: a second call for the '
  'same order is a no-op. See migration 040 for the DB-level UNIQUE guard that '
  'backs this up against concurrent callers.';

-- =============================================================================
-- END OF MIGRATION 043
-- =============================================================================
