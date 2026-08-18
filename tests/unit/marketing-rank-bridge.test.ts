import { describe, expect, it } from "vitest"
import {
  LOVELI_COMPENSATION,
  MARKETING_RANK_BRIDGE,
  marketingBandForEngineRank,
  marketingCommissionLevelForEngineRank,
  marketingRankBridgeIsComplete,
} from "@/lib/partners/compensation-plan"

describe("marketing rank bridge", () => {
  it("covers each of the eight engine positions exactly once", () => {
    expect(marketingRankBridgeIsComplete()).toBe(true)
    expect(MARKETING_RANK_BRIDGE.flatMap((band) => band.engineRankPositions)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("uses the approved five-band grouping", () => {
    expect(MARKETING_RANK_BRIDGE.map((band) => [band.marketingName, band.engineRankPositions])).toEqual([
      ["Ambassador", [1]],
      ["Executive", [2, 3]],
      ["Gold Director", [4, 5]],
      ["Platinum Director", [6, 7]],
      ["Crown President", [8]],
    ])
  })

  it("keeps marketing commission depth aligned to the five public levels", () => {
    expect(MARKETING_RANK_BRIDGE.map((band) => band.maxCommissionLevel)).toEqual([1, 2, 3, 4, 5])
    expect(LOVELI_COMPENSATION.commissionLevels.map((level) => level.level)).toEqual([1, 2, 3, 4, 5])
    expect(LOVELI_COMPENSATION.commissionLevels.map((level) => level.percentage)).toEqual([20, 11, 6, 2, 1])
  })

  it("resolves engine positions and rejects unknown positions", () => {
    expect(marketingBandForEngineRank(1)?.marketingName).toBe("Ambassador")
    expect(marketingBandForEngineRank(7)?.marketingName).toBe("Platinum Director")
    expect(marketingCommissionLevelForEngineRank(8)).toBe(5)
    expect(marketingBandForEngineRank(9)).toBeNull()
    expect(marketingCommissionLevelForEngineRank(0)).toBeNull()
  })
})