import 'server-only'

import { getSession } from '@/lib/auth/roles'
import { getCurrentDistributor } from '@/lib/distributors/current'

export type PricingTier = 'retail' | 'distributor' | 'wholesale'

export type PricingContext = {
  tier: PricingTier
  isActiveDistributor: boolean
  isApprovedWholesaler: boolean
}

/** Resolves pricing eligibility from the authenticated session and server-side role data. */
export async function getPricingContext(): Promise<PricingContext> {
  const session = await getSession()
  const roles = session?.roles as Set<string> | undefined
  const isApprovedWholesaler = Boolean(roles?.has('wholesale'))
  if (isApprovedWholesaler) {
    return { tier: 'wholesale', isActiveDistributor: false, isApprovedWholesaler: true }
  }
  if (!roles?.has('distributor')) {
    return { tier: 'retail', isActiveDistributor: false, isApprovedWholesaler: false }
  }
  const distributor = await getCurrentDistributor()
  const isActiveDistributor = Boolean(distributor?.isActive && distributor.starterPaidAt)
  return {
    tier: isActiveDistributor ? 'distributor' : 'retail',
    isActiveDistributor,
    isApprovedWholesaler: false,
  }
}

export function wholesalePriceMinor(retailPriceMinor: string | number): string {
  return ((BigInt(retailPriceMinor) * 75n) / 100n).toString()
}

export function priceForVariant(
  variant: { retailPriceMinor: string | number; distributorPriceMinor: string | number },
  context: PricingContext,
): string {
  if (context.tier === 'wholesale') return wholesalePriceMinor(variant.retailPriceMinor)
  return String(context.isActiveDistributor ? variant.distributorPriceMinor : variant.retailPriceMinor)
}
