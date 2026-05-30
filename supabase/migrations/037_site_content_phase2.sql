-- 037_site_content_phase2.sql
--
-- Extends the site_content CMS with two more sections:
--   home_philosophy — the "Presence before words" homepage block
--   footer          — footer brand intro + tagline + copyright + closing line
--                     (link structure stays in code since it's structural and
--                     ties to real routes; only the editable copy is here)
--
-- Schemas live in src/lib/content/site.ts; getSection() falls back to in-code
-- defaults if a row is missing or malformed.
--
-- Applied via MCP on 2026-05-28.

INSERT INTO public.site_content (section_key, body) VALUES
  ('home_philosophy', jsonb_build_object(
    'eyebrow',  'The philosophy',
    'headline', 'Presence before words. *Remembered long after you leave.*',
    'body',     'We compose for the dry-down: the hours after the first impression, when a fragrance stops being something you wear and becomes part of how you''re remembered. Eau de Parfum strength, blended in small batches, balanced to last.',
    'quote',    'A scent should arrive a moment before you do, and stay a moment after.'
  )),
  ('footer', jsonb_build_object(
    'brandName',     'Loveli Luxury Scents',
    'tagline',       'The home of modern African luxury fragrance culture. Sourced with discipline, sealed with care, delivered with intention.',
    'copyrightName', 'Loveli Luxury International',
    'closingLine',   'Blended in Nairobi · Shipped with intention'
  ))
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '037_site_content_phase2',
  jsonb_build_object(
    'description',
    'Site content CMS Phase 2 (partial): seeded home_philosophy + footer rows. Partner landing, policies x3, and find-your-scent quiz deferred to a follow-up pass.'
  )
);
