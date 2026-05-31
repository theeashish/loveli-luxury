-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — INCOME DISCLOSURE STATEMENT (IDS) SEED
-- =============================================================================
-- Migration:   042_income_disclosure_statement.sql
-- Date:        30 May 2026
-- Purpose:     Seed the `partner_ids` site_content section so the public
--              /ids page renders with safe, owner-editable placeholder data
--              until real partner-earnings statistics exist.
--
-- Why IDS:     The masterplan flags "legal review of the comp plan" as a
--              launch blocker. An Income Disclosure Statement is what
--              regulators and serious customers expect from a partner program.
--              It is the OPPOSITE of an income claim — it discloses the
--              real distribution of partner earnings (median, % earning > 0,
--              % who recouped their starter cost) so a prospective partner
--              makes an informed decision.
--
-- Editable:    Per the existing CMS pattern (migrations 035 / 037 / 039), the
--              owner can edit every value at /admin/content/site/partner_ids.
--              All values fall back to the in-code defaults if the row is
--              missing or malformed (see src/lib/content/site.ts), so the
--              page always renders.
--
-- IMPORTANT:   The seed values below are PLACEHOLDERS marked "DATA PENDING"
--              and DELIBERATELY conservative. Replace with real verified
--              numbers before launch.
-- =============================================================================

INSERT INTO public.site_content (section_key, body) VALUES
  ('partner_ids', jsonb_build_object(
    'eyebrow',     'Income disclosure',
    'headline',    'What partners *actually* earn',
    'lead',        'We publish this because you deserve real numbers, not a sales pitch. The stats below describe the verified earnings distribution across active Loveli partners over the reporting period. They are not projections, promises, or testimonials.',
    'periodLabel', 'Reporting period — DATA PENDING',
    'methodology', 'An "active partner" is one who placed at least one verified retail sale in the 90 days before the period end. All amounts are gross commission earnings before taxes and personal expenses. Refunded and clawed-back commissions are excluded. The same numbers are visible in your partner dashboard under Earnings.',
    'stats', jsonb_build_array(
      jsonb_build_object(
        'label',  'Median monthly earnings',
        'value',  'KES 0',
        'sub',    'Active partners (half earn less, half earn more) — DATA PENDING'
      ),
      jsonb_build_object(
        'label',  'Active partners earning more than zero',
        'value',  '0%',
        'sub',    'Of all active partners in the period — DATA PENDING'
      ),
      jsonb_build_object(
        'label',  'Partners who recouped their starter cost',
        'value',  '0%',
        'sub',    'Cumulative earnings >= onboarding cost — DATA PENDING'
      ),
      jsonb_build_object(
        'label',  'Top 5% monthly earnings',
        'value',  'KES 0',
        'sub',    'The 95th-percentile active partner — DATA PENDING'
      )
    ),
    'rules', jsonb_build_array(
      'Commissions only fire on confirmed retail sales. Recruiting a partner pays nothing.',
      'A partner''s own starter purchase is not commissionable.',
      'Refunded orders trigger a clawback against the same partners who earned on them.',
      'Maintenance: a partner must place verified retail sales each month to remain active.',
      'No income is guaranteed. Earnings depend entirely on retail performance.'
    ),
    'footnote', 'Loveli Luxury Scents is committed to transparent compensation. If you ever see a recruitment-only pitch in our name, that pitch is not from us. Report it: concierge@loveliluxuryscents.com.'
  ));

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '042_income_disclosure_statement',
  jsonb_build_object(
    'description',
    'Seeded partner_ids CMS section with placeholder Income Disclosure Statement values. Replace with real verified numbers before launch.'
  )
);

-- =============================================================================
-- END OF MIGRATION 042
-- =============================================================================
