/**
 * Unit tests for the pure tier-evaluation decision function.
 *
 * Pure logic; no Supabase / network. Covers the lattice of
 * (current_tier × qualification metrics × flags) → decision.
 *
 * If the brand brief changes the qualification rules (e.g. retention
 * threshold shifts from 0.6 to 0.7), the seed in migration 023 changes
 * and these tests need updating to track. Snapshot the brief decision
 * here so the regression is caught at the next test run.
 */

import { describe, expect, it } from 'vitest'
import { evaluatePartnerTier } from '../../src/lib/partners/tier-evaluator'
import type {
  PartnerFlags,
  PartnerQualification,
  PartnerTier,
  QualificationRules,
} from '../../src/lib/partners/types'

// ---------------------------------------------------------------------
// Fixture builders — keep tests readable
// ---------------------------------------------------------------------

function makeTier(
  position: number,
  rules: QualificationRules = {},
  overrides: Partial<PartnerTier> = {},
): PartnerTier {
  return {
    id: position,
    tier_position: position,
    tier_code: `tier_${position}`,
    display_name: `Tier ${position}`,
    direct_rate_basis_points: 1000,
    override_rate_basis_points: 0,
    can_refer_tier_max: 0,
    qualification_rules: rules,
    effective_from: new Date(0).toISOString(),
    effective_until: null,
    created_at: new Date(0).toISOString(),
    ...overrides,
  }
}

function makeQual(overrides: Partial<PartnerQualification> = {}): PartnerQualification {
  return {
    distributor_id: 1,
    verified_revenue_90d_minor: 0n,
    unique_buyers_90d: 0,
    paid_orders_90d: 0,
    retention_score_90d: 0,
    computed_at: new Date().toISOString(),
    ...overrides,
  }
}

const noFlags: PartnerFlags = {
  verified_content_creator: false,
  verified_customer: false,
}

// The four-tier ladder as seeded by migration 023. Tests reach for this
// fixture so the brand brief stays the source of truth.
const BRAND_LADDER: PartnerTier[] = [
  makeTier(1, {
    requires_any: ['verified_content_creator', 'verified_customer'],
  }, {
    tier_code: 'concierge_partner',
    display_name: 'Concierge Partner',
    direct_rate_basis_points: 1000,
  }),
  makeTier(2, {
    min_90d_retail_minor: 9000000,
    min_retention_score: 0.6,
  }, {
    tier_code: 'brand_associate',
    display_name: 'Brand Associate',
    direct_rate_basis_points: 1500,
    override_rate_basis_points: 300,
    can_refer_tier_max: 1,
  }),
  makeTier(3, {
    min_90d_retail_minor: 30000000,
    min_unique_buyers_90d: 10,
    min_90d_post_count: 12,
  }, {
    tier_code: 'regional_curator',
    display_name: 'Regional Curator',
    direct_rate_basis_points: 2000,
    can_refer_tier_max: 2,
  }),
  makeTier(4, {
    min_90d_retail_minor: 60000000,
    quarterly_review_required: true,
    brand_compliance_required: true,
  }, {
    tier_code: 'prestige_partner',
    display_name: 'Prestige Partner',
    direct_rate_basis_points: 2000,
    can_refer_tier_max: 4,
  }),
]

// ---------------------------------------------------------------------
// No tier yet — entry into Concierge Partner
// ---------------------------------------------------------------------

describe('evaluatePartnerTier — unassigned partner', () => {
  it('advances to tier 1 when partner is a verified customer', () => {
    const out = evaluatePartnerTier(null, null,
      { verified_customer: true, verified_content_creator: false },
      BRAND_LADDER,
    )
    expect(out).toEqual({
      type: 'advance',
      toTierPosition: 1,
      reason: 'Eligible for Concierge Partner.',
    })
  })

  it('advances to tier 1 when partner is a verified content creator', () => {
    const out = evaluatePartnerTier(null, null,
      { verified_customer: false, verified_content_creator: true },
      BRAND_LADDER,
    )
    expect(out.type).toBe('advance')
    if (out.type === 'advance') expect(out.toTierPosition).toBe(1)
  })

  it('holds (no advance) when neither flag is set', () => {
    const out = evaluatePartnerTier(null, null, noFlags, BRAND_LADDER)
    expect(out.type).toBe('hold')
  })

  it('holds with a clear reason when no ladder is configured', () => {
    const out = evaluatePartnerTier(null, null, noFlags, [])
    expect(out).toEqual({
      type: 'hold',
      reason: 'No tier ladder configured.',
    })
  })
})

// ---------------------------------------------------------------------
// Tier 1 → Tier 2 advancement
// ---------------------------------------------------------------------

describe('evaluatePartnerTier — Concierge Partner (tier 1)', () => {
  const tier1 = BRAND_LADDER[0]!
  const flags: PartnerFlags = {
    verified_customer: true,
    verified_content_creator: false,
  }

  it('holds when metrics are below tier 2 threshold', () => {
    const qual = makeQual({
      verified_revenue_90d_minor: 8000000n, // Kes 80k < 90k
      retention_score_90d: 0.7,
    })
    const out = evaluatePartnerTier(tier1, qual, flags, BRAND_LADDER)
    expect(out.type).toBe('hold')
    if (out.type === 'hold') {
      expect(out.reason).toContain('Concierge Partner')
    }
  })

  it('holds when revenue meets but retention is below 0.6', () => {
    const qual = makeQual({
      verified_revenue_90d_minor: 9500000n, // ≥ 90k
      retention_score_90d: 0.5, // < 0.6
    })
    const out = evaluatePartnerTier(tier1, qual, flags, BRAND_LADDER)
    expect(out.type).toBe('hold')
  })

  it('advances to tier 2 when both revenue and retention exceed thresholds', () => {
    const qual = makeQual({
      verified_revenue_90d_minor: 9500000n, // ≥ 90k
      retention_score_90d: 0.7, // ≥ 0.6
    })
    const out = evaluatePartnerTier(tier1, qual, flags, BRAND_LADDER)
    expect(out).toEqual({
      type: 'advance',
      toTierPosition: 2,
      reason: 'Exceeds Brand Associate qualification.',
    })
  })

  it('warns when tier 1 partner drops below entry requirements', () => {
    const out = evaluatePartnerTier(tier1, null, noFlags, BRAND_LADDER)
    // No flags satisfy requires_any → tier 1 itself unmet → downgrade_warn
    // but no lower tier, so warn-only.
    expect(out.type).toBe('downgrade_warn')
  })
})

// ---------------------------------------------------------------------
// Tier 2 → Tier 3 advancement
// ---------------------------------------------------------------------

describe('evaluatePartnerTier — Brand Associate (tier 2)', () => {
  const tier2 = BRAND_LADDER[1]!
  const flags: PartnerFlags = {
    verified_customer: true,
    verified_content_creator: true,
  }

  it('holds when metrics keep tier 2 happy but tier 3 unmet', () => {
    const qual = makeQual({
      verified_revenue_90d_minor: 15000000n, // ≥ 90k, < 300k
      retention_score_90d: 0.7,
      unique_buyers_90d: 5, // < 10 needed for tier 3
    })
    const out = evaluatePartnerTier(tier2, qual, flags, BRAND_LADDER)
    expect(out.type).toBe('hold')
  })

  it('does NOT advance to tier 3 when posts < 12 even with high revenue + buyers', () => {
    const qual = makeQual({
      verified_revenue_90d_minor: 50000000n, // ≥ 300k
      retention_score_90d: 0.7,
      unique_buyers_90d: 20,
    })
    // min_90d_post_count is 12 but the qualification view doesn't carry
    // post counts (Phase 2a) — so post-count rule fails by default.
    const out = evaluatePartnerTier(tier2, qual, flags, BRAND_LADDER)
    expect(out.type).toBe('hold')
  })

  it('downgrades to warn when below tier 2 retail revenue', () => {
    const qual = makeQual({
      verified_revenue_90d_minor: 5000000n, // < 90k
      retention_score_90d: 0.8,
    })
    const out = evaluatePartnerTier(tier2, qual, flags, BRAND_LADDER)
    expect(out.type).toBe('downgrade_warn')
    if (out.type === 'downgrade_warn') {
      expect(out.reason).toContain('Brand Associate')
    }
  })
})

// ---------------------------------------------------------------------
// Tier 3 — Prestige requires admin batch
// ---------------------------------------------------------------------

describe('evaluatePartnerTier — Regional Curator (tier 3)', () => {
  const tier3 = BRAND_LADDER[2]!

  it('never auto-advances into Prestige even with stratospheric metrics', () => {
    // Prestige requires quarterly_review_required + brand_compliance_required
    // which are admin-batch flags Phase 2a does not yet wire up.
    const qual = makeQual({
      verified_revenue_90d_minor: 99999999n,
      unique_buyers_90d: 1000,
    })
    const out = evaluatePartnerTier(tier3, qual,
      { verified_customer: true, verified_content_creator: true },
      BRAND_LADDER,
    )
    // Tier 3 itself fails because we don't carry post counts. So expect
    // downgrade_warn — admin still has the manual lever.
    expect(['hold', 'downgrade_warn']).toContain(out.type)
  })
})

// ---------------------------------------------------------------------
// Sanity / boundary
// ---------------------------------------------------------------------

describe('evaluatePartnerTier — boundary cases', () => {
  it('treats missing qualification as zero metrics', () => {
    const out = evaluatePartnerTier(BRAND_LADDER[0]!, null,
      { verified_customer: true, verified_content_creator: false },
      BRAND_LADDER,
    )
    // Tier 1 flag-only rules pass; tier 2 needs revenue → can't advance.
    expect(out.type).toBe('hold')
  })

  it('honours the ladder ordering — unsorted input is sorted internally', () => {
    const shuffled = [BRAND_LADDER[3]!, BRAND_LADDER[1]!, BRAND_LADDER[2]!, BRAND_LADDER[0]!]
    const out = evaluatePartnerTier(null, null,
      { verified_customer: true, verified_content_creator: false },
      shuffled,
    )
    expect(out.type).toBe('advance')
    if (out.type === 'advance') expect(out.toTierPosition).toBe(1)
  })
})
