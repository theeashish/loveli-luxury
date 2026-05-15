-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MSISDN SMS VERIFICATION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      016_msisdn_verifications.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 4 — back the self-service MSISDN
--                 verification flow with a one-time-code table.
--
-- Design:
--   - When a distributor submits a new payout MSISDN, the existing
--     settings action stamps it on distributors.payout_msisdn_pending
--     AND inserts a row here with a SHA-256-hashed 6-digit code and a
--     short TTL (default 15 minutes).
--   - The distributor enters the code on /account/distributor/settings/verify.
--     A match (within TTL, not used, attempts < 5) flips the distributor's
--     payout_msisdn to the pending value with verified_at = NOW.
--   - Admin can still approve manually from /admin/distributors/verifications
--     (covers the case where SMS delivery fails or the distributor lost
--     the code).
-- =============================================================================


CREATE TABLE IF NOT EXISTS msisdn_verifications (
  id                BIGSERIAL PRIMARY KEY,
  distributor_id    BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  msisdn            TEXT NOT NULL,
  code_hash         TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,
  attempts          INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active (unused, non-expired) row per distributor at a time.
-- Enforced as a partial unique index so re-submitting overrides the prior.
CREATE UNIQUE INDEX IF NOT EXISTS uq_msisdn_verifications_active
  ON msisdn_verifications(distributor_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msisdn_verifications_expires_at
  ON msisdn_verifications(expires_at);

ALTER TABLE msisdn_verifications ENABLE ROW LEVEL SECURITY;

-- Distributor can read their own pending row. No writes by clients.
DROP POLICY IF EXISTS msisdn_verifications_self_read ON msisdn_verifications;
CREATE POLICY msisdn_verifications_self_read
  ON msisdn_verifications FOR SELECT
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE user_id = auth.uid()
    )
  );

-- Admin can read all (for support).
DROP POLICY IF EXISTS msisdn_verifications_admin ON msisdn_verifications;
CREATE POLICY msisdn_verifications_admin
  ON msisdn_verifications FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- =============================================================================
-- END OF MIGRATION 016
-- =============================================================================
