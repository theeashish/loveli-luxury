/** Shared display data for the pasted Loveli compensation plan. */

export type CompensationRank = {
  position: 1 | 2 | 3 | 4 | 5
  name: string
  personalBottles: number
  activeDirects: number
  groupTargetKes: number
  commissionLevels: string
  rankBonusKes: number
  rankBonusMonths: number
  lifestyleBonusKes: number | null
  lifestyleBonusTiming: string | null
  prestige: 'standard' | 'gold' | 'platinum' | 'crown'
}

export const LOVELI_COMPENSATION = {
  registrationFeeKes: 900,
  product: {
    sizeMl: 50,
    iboPriceKes: 1000,
    suggestedRetailKes: 2500,
    retailProfitKes: 1500,
    pv: 500,
  },
  commissionLevels: [
    { level: 1, percentage: 20 },
    { level: 2, percentage: 11 },
    { level: 3, percentage: 6 },
    { level: 4, percentage: 2 },
    { level: 5, percentage: 1 },
  ],
  ranks: [
    { position: 1, name: 'Ambassador', personalBottles: 5, activeDirects: 5, groupTargetKes: 100000, commissionLevels: 'Level 1', rankBonusKes: 5000, rankBonusMonths: 1, lifestyleBonusKes: null, lifestyleBonusTiming: null, prestige: 'standard' },
    { position: 2, name: 'Active', personalBottles: 20, activeDirects: 30, groupTargetKes: 300000, commissionLevels: 'Levels 1-2', rankBonusKes: 15000, rankBonusMonths: 2, lifestyleBonusKes: 5000, lifestyleBonusTiming: 'Paid on the 25th when the monthly target is met', prestige: 'standard' },
    { position: 3, name: 'Gold Director', personalBottles: 40, activeDirects: 40, groupTargetKes: 850000, commissionLevels: 'Levels 1-3', rankBonusKes: 40000, rankBonusMonths: 3, lifestyleBonusKes: 20000, lifestyleBonusTiming: 'Paid on the 25th when the monthly target is met', prestige: 'gold' },
    { position: 4, name: 'Platinum Director', personalBottles: 60, activeDirects: 60, groupTargetKes: 2500000, commissionLevels: 'Levels 1-4', rankBonusKes: 120000, rankBonusMonths: 3, lifestyleBonusKes: 100000, lifestyleBonusTiming: 'Paid on the 25th when the monthly target is met', prestige: 'platinum' },
    { position: 5, name: 'Crown President', personalBottles: 100, activeDirects: 120, groupTargetKes: 8500000, commissionLevels: 'Levels 1-5', rankBonusKes: 300000, rankBonusMonths: 3, lifestyleBonusKes: 250000, lifestyleBonusTiming: 'Paid on the 25th when the monthly target is met', prestige: 'crown' },
  ] satisfies readonly CompensationRank[],
  maintenance: {
    earlyWindow: 'Maintenance completed from Day 1 to Day 10 gives normal commission eligibility from the beginning of the month.',
    afterWindow: 'Maintenance completed after Day 10 leaves the account active, but commission eligibility starts on the date maintenance is completed. No retroactive commissions are created.',
  },
  terms: [
    'A qualifying month requires the personal-purchase, Active Direct and group-volume requirements for the rank.',
    'Personal purchases do not count toward group volume.',
    'A distributor does not earn commission on their own purchases.',
    'Missing a month does not reset accumulated qualifying months; it simply adds no qualifying month.',
    'Commissions are calculated from PV, not from retail price, partner price, registration fees or company profit.',
    'Rank-up bonuses are paid with commissions on the 15th after the required qualifying months are verified.',
    'Luxury lifestyle bonuses are paid on the 25th when the applicable monthly requirements are met.',
  ],
  incomeDisclaimer: 'Income and bonuses are performance-based and are not guaranteed. Results vary based on individual sales, customer demand, activity, leadership and qualification.',
  retailDisclaimer: 'Suggested retail pricing should be followed in accordance with company policies and applicable Kenyan laws.',
} as const

export type LoveliCompensation = typeof LOVELI_COMPENSATION

export type MarketingRankBridge = {
  marketingPosition: CompensationRank['position']
  marketingName: CompensationRank['name']
  engineRankPositions: readonly number[]
  maxCommissionLevel: 1 | 2 | 3 | 4 | 5
}

export const MARKETING_RANK_BRIDGE = [
  { marketingPosition: 1, marketingName: 'Ambassador', engineRankPositions: [1], maxCommissionLevel: 1 },
  { marketingPosition: 2, marketingName: 'Active', engineRankPositions: [2], maxCommissionLevel: 2 },
  { marketingPosition: 3, marketingName: 'Gold Director', engineRankPositions: [3], maxCommissionLevel: 3 },
  { marketingPosition: 4, marketingName: 'Platinum Director', engineRankPositions: [4], maxCommissionLevel: 4 },
  { marketingPosition: 5, marketingName: 'Crown President', engineRankPositions: [5], maxCommissionLevel: 5 },
] as const satisfies readonly MarketingRankBridge[]

export function marketingBandForEngineRank(engineRankPosition: number) {
  return MARKETING_RANK_BRIDGE.find((band) => band.engineRankPositions.some((position) => position === engineRankPosition)) ?? null
}

export function marketingCommissionLevelForEngineRank(engineRankPosition: number) {
  return marketingBandForEngineRank(engineRankPosition)?.maxCommissionLevel ?? null
}

export function marketingRankBridgeIsComplete() {
  const positions = MARKETING_RANK_BRIDGE.flatMap((band) => band.engineRankPositions)
  return positions.length === 5 && new Set(positions).size === 5 && positions.every((position) => position >= 1 && position <= 5)
}
