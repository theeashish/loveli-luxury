-- =============================================================================
-- Supabase environment shim for in-process Postgres (pglite) integration tests.
-- =============================================================================
-- Supabase provides a set of roles, an `auth` schema, and JWT helper functions
-- that the production migrations assume already exist. pglite is a bare
-- Postgres, so we recreate the minimum surface the migrations + RPCs touch.
--
-- This is TEST INFRASTRUCTURE ONLY. It is never shipped or applied to prod.
-- The goal: load the EXACT production migrations unmodified and exercise the
-- real money RPCs (write_commission_ledger, mark_order_paid, etc.).
-- =============================================================================

-- Extensions the schema needs (also created idempotently by migration 001).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Roles Supabase ships. Migrations GRANT/REVOKE against these.
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticator NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE supabase_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The `auth` schema + a minimal users table (profiles.id FKs to auth.users.id).
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT,
  raw_user_meta_data JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auth.uid() / auth.role() / auth.jwt() read request-scoped GUCs the test sets
-- via set_auth(uuid, role). `true` = missing_ok so an unset GUC returns NULL.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.email', true), '')
$$;

-- Supabase Storage surface referenced by catalog image policies (migration
-- 002). Minimal stubs so the bucket INSERT + RLS policies apply.
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  public      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id   TEXT REFERENCES storage.buckets(id),
  name        TEXT,
  owner       UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
