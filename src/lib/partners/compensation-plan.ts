/** Shared display data for the attachment-approved Loveli compensation plan. */

export type CompensationRank = {
  position: 1 | 2 | 3 | 4 | 5
  name: string
  personalBottles: number
  activeDirects: number
  activeCustomers: number | null
  groupTargetKes: number
  commissionLevels: string
  rankBonusKes: number
  rankBonusMonths: number
  lifestyleBonusKes: number | null
  lifestyleBonusTiming: string | null
  prestige: 'standard' | 'gold' | 'platinum' | 'crown'
}

export const LOVELI_COMPENSATION = {
  registrationFeeKes: 100,
  activation: {
    bottles: 5,
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
    { position: 1, name: 'Ambassador', personalBottles: 5, activeDirects: 5, activeCustomers: null, groupTargetKes: 100000, commissionLevels: 'Level 1', rankBonusKes: 5000, rankBonusMonths: 2, lifestyleBonusKes: null, lifestyleBonusTiming: null, prestige: 'standard' },
    { position: 2, name: 'Executive', personalBottles: 20, activeDirects: 10, activeCustomers: null, groupTargetKes: 300000, commissionLevels: 'Levels 1-2', rankBonusKes: 15000, rankBonusMonths: 3, lifestyleBonusKes: 5000, lifestyleBonusTiming: 'Paid when the monthly target is met', prestige: 'standard' },
    { position: 3, name: 'Gold Director', personalBottles: 30, activeDirects: 20, activeCustomers: null, groupTargetKes: 750000, commissionLevels: 'Levels 1-3', rankBonusKes: 40000, rankBonusMonths: 3, lifestyleBonusKes: 20000, lifestyleBonusTiming: 'Paid when the monthly target is met', prestige: 'gold' },
    { position: 4, name: 'Platinum Director', personalBottles: 40, activeDirects: 50, activeCustomers: null, groupTargetKes: 2500000, commissionLevels: 'Levels 1-4', rankBonusKes: 120000, rankBonusMonths: 2, lifestyleBonusKes: 100000, lifestyleBonusTiming: 'Paid when the monthly target is met', prestige: 'platinum' },
    { position: 5, name: 'Crown President', personalBottles: 60, activeDirects: 120, activeCustomers: 200, groupTargetKes: 7500000, commissionLevels: 'Levels 1-5', rankBonusKes: 300000, rankBonusMonths: 3, lifestyleBonusKes: 250000, lifestyleBonusTiming: 'Paid when the monthly target is met', prestige: 'crown' },
  ] satisfies readonly CompensationRank[],
  maintenance: {
    ambassador: "Ambassadors may maintain at any time during the month and still receive that month's full commission, subject to meeting all applicable qualification requirements.",
    executiveAndAboveGrace: "Executive and above ranks have a maintenance grace period from the 1st to the 7th of every month. Partners who complete maintenance during this grace period will still receive their full month's commission, subject to all other requirements.",
    afterGrace: 'For maintenance completed between the 8th and 31st, commissions will be unlocked from the date maintenance is completed.',
  },
  terms: [
    'Changes can be made without prior notice.',
    'All earnings are paid on the 15th of the following month.',
    'All earnings are calculated based on our current products.',
    'Accounts should be maintained monthly to receive monthly earnings.',
    'All commissions are calculated based on Point Value (PV).',
  ],
  incomeDisclaimer: 'Income and bonuses are performance-based and are not guaranteed. Results vary based on individual sales, customer demand, activity, leadership and qualification.',
  retailDisclaimer: 'Suggested retail pricing should be followed in accordance with company policies and applicable Kenyan laws.',
} as const

export type LoveliCompensation = typeof LOVELI_COMPENSATION
/** Versioned bridge: engine ranks remain authoritative for qualification, rank-up bonuses, salary, and ledger calculations. */
export type MarketingRankBridge = {
  marketingPosition: CompensationRank["position"]
  marketingName: CompensationRank["name"]
  engineRankPositions: readonly number[]
  maxCommissionLevel: 1 | 2 | 3 | 4 | 5
}

export const MARKETING_RANK_BRIDGE = [
  { marketingPosition: 1, marketingName: "Ambassador", engineRankPositions: [1], maxCommissionLevel: 1 },
  { marketingPosition: 2, marketingName: "Executive", engineRankPositions: [2, 3], maxCommissionLevel: 2 },
  { marketingPosition: 3, marketingName: "Gold Director", engineRankPositions: [4, 5], maxCommissionLevel: 3 },
  { marketingPosition: 4, marketingName: "Platinum Director", engineRankPositions: [6, 7], maxCommissionLevel: 4 },
  { marketingPosition: 5, marketingName: "Crown President", engineRankPositions: [8], maxCommissionLevel: 5 },
] as const satisfies readonly MarketingRankBridge[]

export function marketingBandForEngineRank(engineRankPosition: number) {
  return MARKETING_RANK_BRIDGE.find((band) => band.engineRankPositions.some((position) => position === engineRankPosition)) ?? null
}

export function marketingCommissionLevelForEngineRank(engineRankPosition: number) {
  return marketingBandForEngineRank(engineRankPosition)?.maxCommissionLevel ?? null
}

export function marketingRankBridgeIsComplete() {
  const positions = MARKETING_RANK_BRIDGE.flatMap((band) => band.engineRankPositions)
  return positions.length === 8 && new Set(positions).size === 8 && positions.every((position) => position >= 1 && position <= 8)
}