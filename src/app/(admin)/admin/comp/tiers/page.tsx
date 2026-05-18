/**
 * /admin/comp/tiers
 *
 * Phase 2a — read + edit page for the 4-tier partner ladder. Lists each
 * active tier (effective_until IS NULL), shows display name + tier_code,
 * lets superadmins tune the direct/override rates and qualification
 * thresholds. Versioned writes via partner_tiers.effective_from/_until.
 *
 * The compensation engine does NOT read this table yet (v1_rank still
 * runs). Phase 2b's engine v2 will. Until then this is configuration
 * staging: tune the numbers ahead of cutover.
 */

import { AdminPageHeader } from '@/components/admin/forms'
import { loadActivePartnerTiers } from '@/lib/partners/qualification'
import { TierRulesForm } from './TierRulesForm'

export const metadata = { title: 'Partner tiers', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function PartnerTiersAdminPage() {
  const tiers = await loadActivePartnerTiers()

  return (
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        eyebrow="Comp plan"
        title="Partner tiers"
        subtitle="The 4-tier ladder customers see. Direct and override rates determine commission split; the qualification rules below decide who advances. The compensation engine doesn't read these values yet — tune them, then Phase 2b flips the engine flag."
      />

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong className="font-semibold">Staging mode.</strong> Edits here
        affect future engine-v2 calculations only. Current commissions still
        compute on the rank-based engine until Phase 2b ships.
      </div>

      <div className="space-y-6">
        {tiers.map((tier) => (
          <article
            key={tier.id}
            className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Tier {tier.tier_position}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                  {tier.display_name}
                </h2>
                <p className="mt-1 text-xs font-mono text-neutral-500">
                  {tier.tier_code}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Direct / Override
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
                  {(tier.direct_rate_basis_points / 100).toFixed(1)}%
                  <span className="ml-2 text-base text-neutral-500">
                    +
                    {(tier.override_rate_basis_points / 100).toFixed(1)}%
                  </span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Can refer up to tier {tier.can_refer_tier_max || '—'}
                </p>
              </div>
            </div>

            <TierRulesForm tier={tier} />
          </article>
        ))}
      </div>
    </div>
  )
}
