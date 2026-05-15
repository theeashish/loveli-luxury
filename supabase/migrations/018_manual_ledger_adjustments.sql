-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MANUAL LEDGER ADJUSTMENTS
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      018_manual_ledger_adjustments.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 9 — admin-driven, audited, signed
--                 commission adjustments that the payout-drafting flow
--                 includes in its gross calculation.
--
-- Why a new table?
--   commission_ledger.source_order_id is NOT NULL REFERENCES orders(id).
--   Manual adjustments are not tied to a specific order — they're ops
--   corrections (a missed bonus, a clawback the admin chooses to refund,
--   a goodwill credit, a deduction agreed with a distributor). Storing
--   them on commission_ledger would require either an FK-free sentinel
--   row or weakening the FK. A separate table keeps semantics clean,
--   leaves commission_ledger as the immutable per-order fan-out, and
--   makes auditing trivial.
--
-- Inclusion in payouts:
--   payouts/draft.ts now also reads unpaid manual_ledger_adjustments for
--   the period and includes their amount in commissions_total_minor.
--   Setting payout_id on the adjustment row claims it the same way
--   commission_ledger does.
-- =============================================================================


CREATE TABLE IF NOT EXISTS manual_ledger_adjustments (
  id                  BIGSERIAL PRIMARY KEY,
  distributor_id      BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  amount_minor        BIGINT NOT NULL,                       -- signed: positive = credit, negative = debit
  currency            CHAR(3) NOT NULL DEFAULT 'KES',
  period_year         INT NOT NULL,
  period_month        INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reason              TEXT NOT NULL CHECK (length(reason) >= 3),
  actor_id            UUID REFERENCES profiles(id),
  payout_id           BIGINT REFERENCES payouts(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mla_distributor_period
  ON manual_ledger_adjustments(distributor_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_mla_unpaid
  ON manual_ledger_adjustments(distributor_id)
  WHERE payout_id IS NULL;

ALTER TABLE manual_ledger_adjustments ENABLE ROW LEVEL SECURITY;

-- Distributors can read their own adjustments (transparency).
DROP POLICY IF EXISTS mla_self_read ON manual_ledger_adjustments;
CREATE POLICY mla_self_read
  ON manual_ledger_adjustments FOR SELECT
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE user_id = auth.uid()
    )
  );

-- Admin can do anything. No client writes.
DROP POLICY IF EXISTS mla_admin ON manual_ledger_adjustments;
CREATE POLICY mla_admin
  ON manual_ledger_adjustments FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- =============================================================================
-- END OF MIGRATION 018
-- =============================================================================
