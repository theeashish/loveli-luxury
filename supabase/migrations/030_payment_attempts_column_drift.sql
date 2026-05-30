-- 030_payment_attempts_column_drift.sql
--
-- Column drift fix. payment_attempts was created by an earlier (pre-019) hand-
-- applied DDL with 7 columns (id, order_id, provider, request_payload,
-- response_payload, status, attempted_at). Migration 019's CREATE TABLE IF
-- NOT EXISTS was therefore a silent no-op, so the three additional columns
-- it documented (attempt_type, http_status, error_message) never landed.
-- The dispatcher inserts attempt_type and error_message; PostgREST returned
-- "column does not exist"; the best-effort wrapper swallowed it; the audit
-- table sat at 0 rows after ~15 STK pushes.
--
-- This migration brings the live schema into line with what 019 documented.
-- Idempotent and reversible-by-omission (the table just goes back to the
-- pre-019 shape; no data is lost since there are no rows).
--
-- Applied via MCP on 2026-05-28; verified with a synthetic dispatcher-shape
-- insert that landed cleanly post-migration.

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS attempt_type  TEXT,
  ADD COLUMN IF NOT EXISTS http_status   INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Defensive: backfill any pre-existing rows in non-prod environments. Prod
-- has 0 rows so this is a no-op there.
UPDATE public.payment_attempts
   SET attempt_type = 'stk_push'
 WHERE attempt_type IS NULL;

-- Match 019's NOT NULL constraint on attempt_type.
ALTER TABLE public.payment_attempts
  ALTER COLUMN attempt_type SET NOT NULL;

-- Audit log entry for the migration itself (matches the 019 pattern).
INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '030_payment_attempts_column_drift',
  jsonb_build_object(
    'description',
    'Added attempt_type/http_status/error_message to payment_attempts so the dispatcher audit insert stops failing (column drift from a pre-019 hand-applied DDL where 019''s CREATE TABLE IF NOT EXISTS was a no-op).'
  )
);

-- Force a PostgREST schema reload so the new columns are visible immediately
-- (supabase usually triggers this on DDL, but belt+braces).
NOTIFY pgrst, 'reload schema';
