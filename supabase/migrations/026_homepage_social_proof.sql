-- 026_homepage_social_proof.sql
--
-- Homepage social-proof CMS — make customer reviews and press/creator
-- features admin-editable instead of hardcoded in the React components.
--
--   homepage_reviews  → the "In their words" review wall (CustomerProof)
--   press_features    → the "As featured" band (SocialProof)
--
-- Public reads are limited to published rows (RLS). Admins manage everything
-- via /admin/content/social-proof. The three placeholder reviews that used to
-- live in CustomerProof.tsx are seeded here so the section keeps its shape;
-- the owner edits/replaces them in the admin UI.
--
-- Additive. Idempotent.

CREATE TABLE IF NOT EXISTS homepage_reviews (
  id           BIGSERIAL PRIMARY KEY,
  quote        TEXT NOT NULL,
  author_name  TEXT NOT NULL,
  author_city  TEXT,
  position     INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_homepage_reviews_published
  ON homepage_reviews (is_published, position, created_at DESC);

CREATE TABLE IF NOT EXISTS press_features (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  url          TEXT,
  position     INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_press_features_published
  ON press_features (is_published, position, created_at DESC);

ALTER TABLE homepage_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_features  ENABLE ROW LEVEL SECURITY;

-- Public may read published rows only; admins manage everything.
DROP POLICY IF EXISTS homepage_reviews_public_read ON homepage_reviews;
CREATE POLICY homepage_reviews_public_read ON homepage_reviews
  FOR SELECT USING (is_published = TRUE);
DROP POLICY IF EXISTS homepage_reviews_admin_all ON homepage_reviews;
CREATE POLICY homepage_reviews_admin_all ON homepage_reviews
  FOR ALL USING (has_role('admin')) WITH CHECK (has_role('admin'));

DROP POLICY IF EXISTS press_features_public_read ON press_features;
CREATE POLICY press_features_public_read ON press_features
  FOR SELECT USING (is_published = TRUE);
DROP POLICY IF EXISTS press_features_admin_all ON press_features;
CREATE POLICY press_features_admin_all ON press_features
  FOR ALL USING (has_role('admin')) WITH CHECK (has_role('admin'));

-- Seed the three placeholder reviews (only if the table is empty).
INSERT INTO homepage_reviews (quote, author_name, author_city, position)
SELECT v.quote, v.author_name, v.author_city, v.position
FROM (VALUES
  ('I get asked what I''m wearing every single time. The dry-down is the part that stays with people.', 'A. M.', 'Nairobi', 1),
  ('Lasted from morning meetings through dinner. Wrapped, sealed, delivered the next day.', 'W. K.', 'Mombasa', 2),
  ('Subtle, but it lingers. Exactly the presence I wanted — nothing loud, just remembered.', 'L. A.', 'Kisumu', 3)
) AS v(quote, author_name, author_city, position)
WHERE NOT EXISTS (SELECT 1 FROM homepage_reviews);

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '026_homepage_social_proof',
  jsonb_build_object(
    'description',
    'Homepage social-proof CMS: homepage_reviews + press_features tables, RLS public-read-published / admin-all, seeded 3 placeholder reviews.'
  )
);

-- DOWN (manual):
--   DROP TABLE IF EXISTS homepage_reviews;
--   DROP TABLE IF EXISTS press_features;
