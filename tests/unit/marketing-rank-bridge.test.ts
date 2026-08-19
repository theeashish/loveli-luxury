import { describe, expect, it } from "vitest"
import {
  LOVELI_COMPENSATION,
  MARKETING_RANK_BRIDGE,
  marketingBandForEngineRank,
  marketingCommissionLevelForEngineRank,
  marketingRankBridgeIsComplete,
} from "@/lib/partners/compensation-plan"

describe("marketing rank bridge", () => {
  it("covers each of the five active engine positions exactly once", () => {
    expect(marketingRankBridgeIsComplete()).toBe(true)
    expect(MARKETING_RANK_BRIDGE.flatMap((band) => band.engineRankPositions)).toEqual([1, 2, 3, 4, 5])
  })

  it("uses the approved five-band grouping", () => {
    expect(MARKETING_RANK_BRIDGE.map((band) => [band.marketingName, band.engineRankPositions])).toEqual([
      ["Ambassador", [1]],
      ["Active", [2]],
      ["Gold Director", [3]],
      ["Platinum Director", [4]],
      ["Crown President", [5]],
    ])
  })

  it("keeps marketing commission depth aligned to the five public levels", () => {
    expect(MARKETING_RANK_BRIDGE.map((band) => band.maxCommissionLevel)).toEqual([1, 2, 3, 4, 5])
    expect(LOVELI_COMPENSATION.commissionLevels.map((level) => level.level)).toEqual([1, 2, 3, 4, 5])
    expect(LOVELI_COMPENSATION.commissionLevels.map((level) => level.percentage)).toEqual([20, 11, 6, 2, 1])
  })

  it("resolves engine positions and rejects unknown positions", () => {
    expect(marketingBandForEngineRank(1)?.marketingName).toBe("Ambassador")
    expect(marketingBandForEngineRank(4)?.marketingName).toBe("Platinum Director")
    expect(marketingCommissionLevelForEngineRank(5)).toBe(5)
    expect(marketingBandForEngineRank(9)).toBeNull()
    expect(marketingCommissionLevelForEngineRank(0)).toBeNull()
  })
})