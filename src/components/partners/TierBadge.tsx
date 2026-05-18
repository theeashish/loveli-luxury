/**
 * TierBadge — small display element rendering the partner tier name with
 * the brand's accent treatment. Used everywhere we currently show the
 * 8-rank emoji/name (dashboard header, distributor card, admin detail).
 *
 * Schema is untouched in Phase 1 — pass `rankPosition` (1..8) and the
 * component maps it through `partnerTierForRank` to one of the four
 * customer-facing tiers. Or pass a resolved `tier` to skip the mapping.
 */

import { partnerTierForRank, type PartnerTier } from '@/lib/partners/tiers'

interface TierBadgeProps {
  /** Internal `config_ranks.position` value (1..8). Maps through the
   *  Phase-1 bridge to a partner tier. */
  rankPosition?: number | null
  /** Pre-resolved tier — bypasses the rank-position mapping. */
  tier?: PartnerTier
  /** Display variant. */
  variant?: 'pill' | 'card' | 'inline'
}

export function TierBadge({
  rankPosition,
  tier,
  variant = 'pill',
}: TierBadgeProps) {
  const resolved = tier ?? partnerTierForRank(rankPosition)

  if (variant === 'card') {
    return (
      <div className="rounded-lg border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Your tier
        </p>
        <h2 className="mt-1 font-serif text-2xl italic tracking-tight">
          {resolved.displayName}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          {resolved.tagline}
        </p>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <span className="font-medium text-[hsl(var(--primary))]">
        {resolved.displayName}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--primary))]">
      {resolved.displayName}
    </span>
  )
}
