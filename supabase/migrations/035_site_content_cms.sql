-- 035_site_content_cms.sql
--
-- Editable site content CMS. One row per section_key; the body is a JSONB
-- blob shaped to match what the rendering component expects. The server-
-- side helper `getSection()` reads this with a fallback to in-code defaults
-- so a missing or malformed row never breaks the site.
--
-- Phase 1 sections (this migration seeds):
--   home_hero            — hero copy
--   home_trust_strip     — 4 trust pillars
--   home_story           — story section
--   home_faq             — FAQ items
--
-- Future sections (no schema change needed, just add a row):
--   home_philosophy, footer, partner_landing, policies_*
--
-- Highlight syntax: any string field can wrap a phrase in *single asterisks*
-- to render as italic + primary-color emphasis. E.g. "Things people *ask*."
--
-- Applied via MCP on 2026-05-28.

CREATE TABLE IF NOT EXISTS public.site_content (
  section_key  TEXT        PRIMARY KEY,
  body         JSONB       NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_content_public_read ON public.site_content;
CREATE POLICY site_content_public_read ON public.site_content
  FOR SELECT USING (true);

DROP POLICY IF EXISTS site_content_admin_write ON public.site_content;
CREATE POLICY site_content_admin_write ON public.site_content
  FOR ALL USING (
    public.has_role('admin'::user_role) OR public.has_role('superadmin'::user_role)
  );

CREATE OR REPLACE FUNCTION public.set_site_content_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_site_content_updated_at ON public.site_content;
CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_site_content_updated_at();

INSERT INTO public.site_content (section_key, body) VALUES
  ('home_hero', jsonb_build_object(
    'eyebrow',       'Where love meets luxury',
    'headline',      'The Scent of *Elegance*, Bottled.',
    'subhead',       'Eau de Parfum, blended in small batches in Nairobi. Each bottle a quiet love letter to those who choose to live beautifully.',
    'ctaLabel',      'Shop the collection',
    'ctaHref',       '/shop',
    'rotatingLabel', 'Now featuring'
  )),
  ('home_trust_strip', jsonb_build_object(
    'ariaLabel', 'Why shop with Loveli Luxury Scents',
    'pillars', jsonb_build_array(
      jsonb_build_object('icon','shield-check','label','Authenticity verified','sub','Every fragrance checked before dispatch','href','/policies/authenticity'),
      jsonb_build_object('icon','smartphone','label','M-Pesa secure checkout','sub','Pay by STK push, no card needed','href',null),
      jsonb_build_object('icon','message-circle','label','Concierge on WhatsApp','sub','Real help choosing your scent','href',null),
      jsonb_build_object('icon','truck','label','Nationwide delivery','sub','Nairobi 24–48h · countrywide','href','/policies/delivery')
    )
  )),
  ('home_story', jsonb_build_object(
    'eyebrow',  'Our story',
    'headline', 'Born in Nairobi. *Bottled* with intention. Sent into the world to be unforgettable.',
    'body',     'Loveli Luxury Scents began with a small idea: that fragrance should feel like a love letter, not a label. We blend in small batches, source carefully, and trust the long finish. Every bottle is hand-finished, signed, and sent.',
    'stats', jsonb_build_array(
      jsonb_build_object('k','Hand-blended','v','Small batches, never machine-rushed.'),
      jsonb_build_object('k','Long-wear',   'v','8–12 hours on skin. Eau de Parfum strength.'),
      jsonb_build_object('k','Made in Kenya','v','Designed and finished in Nairobi.')
    )
  )),
  ('home_faq', jsonb_build_object(
    'eyebrow',  'Quiet answers',
    'headline', 'Things people *ask*.',
    'items', jsonb_build_array(
      jsonb_build_object('q','How long does a Loveli Luxury fragrance last?','a','Eau de Parfum concentration. Expect 8–12 hours on skin and even longer on fabric, with a refined dry-down that softens through the day.'),
      jsonb_build_object('q','Is delivery available outside Nairobi?','a','Yes — we ship across Kenya and to neighbouring countries. Free delivery in Nairobi on orders above Kes 5,000.'),
      jsonb_build_object('q','Are these bottles refillable?','a','Each 30ml and 50ml bottle is designed to be cherished. A refill programme for our partners is on the way.'),
      jsonb_build_object('q','Can I join the partner program?','a','By invitation only. An existing partner shares their sponsor code; you activate with an onboarding kit and begin as an Ambassador, earning retail margin on every bottle you place. Five ranks (Ambassador, Executive, Gold Director, Platinum Director, Crown President) advance on verified retail performance, never on recruitment. See the partner program for the full structure.'),
      jsonb_build_object('q','Are your fragrances tested on animals?','a','Never. Our blends are vegan-friendly and cruelty-free, and we work only with suppliers who hold the same standard.')
    )
  ))
ON CONFLICT (section_key) DO NOTHING;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '035_site_content_cms',
  jsonb_build_object(
    'description',
    'Editable site content CMS — site_content table with public-read / admin-write RLS, plus seed rows for home_hero, home_trust_strip, home_story, home_faq. Components read via getSection() with code-default fallback so a missing or malformed row never breaks the site.'
  )
);

NOTIFY pgrst, 'reload schema';
