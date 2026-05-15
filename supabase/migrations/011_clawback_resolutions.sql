-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — CLAWBACK RESOLUTIONS
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      011_clawback_resolutions.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 6 wave 2.
--                 Tracks the workflow status of refunded orders whose
--                 commission_ledger rows were already paid out by the
--                 time the refund happened. The migration-008 RPC voids
--                 the UNPAID rows automatically; everything that was
--                 already disbursed needs a human decision: write off
--                 the loss, or queue a deduction against a future
--                 payout. This table is that workflow.
-- =============================================================================


CREATE TABLE IF NOT EXISTS clawback_resolutions (
  id                          BIGSERIAL PRIMARY KEY,
  order_id                    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  paid_amount_minor           BIGINT NOT NULL CHECK (paid_amount_minor >= 0),
  paid_count                  INT    NOT NULL CHECK (paid_count       >= 0),
  resolution                  TEXT,
  deducted_from_payout_id     BIGINT REFERENCES payouts(id),
  notes                       TEXT,
  resolved_by                 UUID   REFERENCES profiles(id),
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id),
  CHECK (
    resolution IS NULL
    OR resolution IN ('written_off', 'deducted_from_payout')
  ),
  -- If a payout id is referenced, the resolution must be the matching kind.
  CHECK (
    (deducted_from_payout_id IS NULL)
    OR (resolution = 'deducted_from_payout')
  ),
  -- A resolution decision implies a resolver + timestamp.
  CHECK (
    (resolution IS NULL AND resolved_at IS NULL)
    OR (resolution IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_clawback_pending
  ON clawback_resolutions(created_at DESC)
  WHERE resolution IS NULL;

ALTER TABLE clawback_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clawback_admin ON clawback_resolutions;
CREATE POLICY clawback_admin
  ON clawback_resolutions FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- =============================================================================
-- END OF MIGRATION 011
-- =============================================================================
