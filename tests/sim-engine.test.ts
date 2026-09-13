import { describe, expect, it } from "vitest";
import {
  attractiveness,
  newFirm,
  nextBrand,
  nextQuality,
  rivalDecisions,
  SEGMENTS,
  SIM,
  simulateRound,
  unitCost,
  type Decisions,
} from "@/lib/sim/engine";

const VALUE = SEGMENTS.find((s) => s.key === "value")!;
const PREMIUM = SEGMENTS.find((s) => s.key === "premium")!;

/** A steady, sensible opening: hold price, maintain both assets, grow a little. */
function steady(overrides: Partial<Decisions> = {}): Decisions {
  return {
    price: 1_200,
    marketing: 5_500_000,
    rnd: 3_000_000,
    capacityInvestment: 10_000_000,
    ...overrides,
  };
}

function playField(playerDecisions: Decisions) {
  const states = [newFirm("You"), newFirm("Meridian"), newFirm("Apex")];
  const decisions = [
    playerDecisions,
    rivalDecisions(states[1], 1, playerDecisions.price),
    rivalDecisions(states[2], 1, playerDecisions.price),
  ];
  return simulateRound(1, states, decisions);
}

describe("unit cost", () => {
  it("falls as cumulative volume grows, and never below the floor", () => {
    const start = unitCost(SIM.startingCumulativeVolume);
    const doubled = unitCost(SIM.startingCumulativeVolume * 2);
    expect(start).toBe(SIM.baseUnitCost);
    // A 90% learning curve: each doubling takes about a tenth out.
    expect(doubled).toBeGreaterThan(start * 0.85);
    expect(doubled).toBeLessThan(start * 0.95);
    expect(unitCost(500_000_000)).toBe(SIM.unitCostFloor);
  });
});

describe("attractiveness", () => {
  it("makes value buyers far more responsive to price than premium buyers", () => {
    const cheapToValue = attractiveness(VALUE, 900, 50, 50) / attractiveness(VALUE, 1_200, 50, 50);
    const cheapToPremium =
      attractiveness(PREMIUM, 900, 50, 50) / attractiveness(PREMIUM, 1_200, 50, 50);
    expect(cheapToValue).toBeGreaterThan(cheapToPremium * 1.5);
  });

  it("makes premium buyers far more responsive to quality than value buyers", () => {
    const betterToPremium =
      attractiveness(PREMIUM, 1_200, 70, 50) / attractiveness(PREMIUM, 1_200, 50, 50);
    const betterToValue =
      attractiveness(VALUE, 1_200, 70, 50) / attractiveness(VALUE, 1_200, 50, 50);
    expect(betterToPremium).toBeGreaterThan(betterToValue * 1.5);
  });
});

describe("brand and quality", () => {
  it("both decay when nothing is spent", () => {
    expect(nextQuality(50, 0)).toBeLessThan(50);
    expect(nextBrand(50, 0)).toBeLessThan(50);
  });

  it("decays brand faster than quality — awareness is rented, capability is owned", () => {
    expect(50 - nextBrand(50, 0)).toBeGreaterThan(50 - nextQuality(50, 0));
  });

  it("has diminishing returns on spend", () => {
    const first = nextQuality(50, 10_000_000) - nextQuality(50, 0);
    const second = nextQuality(50, 40_000_000) - nextQuality(50, 10_000_000);
    // Four times the spend must not buy anything like four times the gain.
    expect(second).toBeLessThan(first * 2);
  });
});

describe("simulateRound", () => {
  it("gives a lower price more share", () => {
    const dear = playField(steady({ price: 1_400 }));
    const cheap = playField(steady({ price: 1_000 }));
    expect(cheap.outcome.firms[0].share).toBeGreaterThan(dear.outcome.firms[0].share);
  });

  it("caps units sold at capacity and reports the rest as lost", () => {
    // Priced to draw far more demand than the starting line can make.
    const { outcome } = playField(steady({ price: 600, marketing: 60_000_000 }));
    const you = outcome.firms[0];
    expect(you.unitsSold).toBeLessThanOrEqual(SIM.startingCapacity);
    expect(you.lostSales).toBeGreaterThan(0);
    expect(you.demand).toBe(you.unitsSold + you.lostSales);
  });

  it("shares add up to 100 across the three firms", () => {
    const { outcome } = playField(steady());
    const total = outcome.firms.reduce((a, f) => a + f.share, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  it("punishes over-pricing hard enough that it is never the safe option", () => {
    // Calibration guard. At twice the market price the gross margin per unit is
    // enormous, and an earlier draft made that profitable — which would have
    // taught students that pricing high is free. Volume has to collapse far
    // enough to swallow the margin.
    const sane = playField(steady());
    const dear = playField(steady({ price: 2_400 }));
    expect(dear.outcome.firms[0].unitsSold).toBeLessThan(
      sane.outcome.firms[0].unitsSold * 0.35,
    );
    expect(dear.outcome.firms[0].profit).toBeLessThan(sane.outcome.firms[0].profit);
  });

  it("charges upkeep on capacity whether or not it is used", () => {
    const { outcome } = playField(steady({ price: 2_400 }));
    expect(outcome.firms[0].capacityUpkeep).toBe(
      SIM.startingCapacity * SIM.capacityUpkeepPerUnit,
    );
  });

  it("finances a shortfall as debt rather than failing outright", () => {
    const { outcome, next } = playField(
      steady({ price: 2_400, marketing: 40_000_000, rnd: 30_000_000, capacityInvestment: 40_000_000 }),
    );
    expect(outcome.firms[0].cash).toBe(0);
    expect(next[0].debt).toBeGreaterThan(0);
    expect(outcome.bankrupt).toBe(false);
  });

  it("makes capacity bought this round available only next round", () => {
    const states = [newFirm("You"), newFirm("Meridian"), newFirm("Apex")];
    const buy = steady({ capacityInvestment: 24_000_000 });
    const first = simulateRound(1, states, [
      buy,
      rivalDecisions(states[1], 1, buy.price),
      rivalDecisions(states[2], 1, buy.price),
    ]);
    expect(first.outcome.firms[0].capacity).toBe(SIM.startingCapacity);

    const second = simulateRound(2, first.next, [
      steady({ capacityInvestment: 0 }),
      rivalDecisions(first.next[1], 2, 1_200),
      rivalDecisions(first.next[2], 2, 1_200),
    ]);
    expect(second.outcome.firms[0].capacity).toBeGreaterThan(SIM.startingCapacity);
  });

  it("is deterministic — the same decisions always produce the same result", () => {
    const a = playField(steady());
    const b = playField(steady());
    expect(a.outcome).toEqual(b.outcome);
  });

  it("lets a sensible opening turn a profit", () => {
    // If a reasonable strategy loses money in round one the calibration is
    // wrong, and every student's first experience of the game is failure they
    // cannot diagnose.
    const { outcome } = playField(steady());
    expect(outcome.firms[0].profit).toBeGreaterThan(0);
  });
});
