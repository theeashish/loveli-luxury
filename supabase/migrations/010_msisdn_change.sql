-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MSISDN CHANGE FLOW
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      010_msisdn_change.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 6 wave 1.
--                 Adds two columns to distributors so a distributor can
--                 submit a new payout M-Pesa number that an admin then
--                 verifies before payouts can fire to it. Channel-
--                 agnostic — the actual SMS / STK-push verification is
--                 deferred to a later phase; an admin manually approves
--                 in the meantime.
-- Flow:
--   1. Distributor submits a new MSISDN from the portal:
--        UPDATE distributors
--           SET payout_msisdn_pending     = '+254...',
--               payout_msisdn_pending_at  = NOW()
--      AND we also clear payout_msisdn_verified_at so any pending
--      payouts cannot fire (Phase 5's payout-init guard handles this).
--   2. Admin reviews on /admin/distributors/verifications:
--        UPDATE distributors
--           SET payout_msisdn               = pending,
--               payout_msisdn_verified_at   = NOW(),
--               payout_msisdn_pending       = NULL,
--               payout_msisdn_pending_at    = NULL
--   3. New payouts can be drafted/initiated against the verified number.
-- =============================================================================


ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS payout_msisdn_pending     TEXT,
  ADD COLUMN IF NOT EXISTS payout_msisdn_pending_at  TIMESTAMPTZ;

-- Partial index — pending verifications surface fast for the admin queue.
CREATE INDEX IF NOT EXISTS idx_distributors_msisdn_pending
  ON distributors(payout_msisdn_pending_at DESC)
  WHERE payout_msisdn_pending IS NOT NULL;

-- =============================================================================
-- END OF MIGRATION 010
-- =============================================================================
