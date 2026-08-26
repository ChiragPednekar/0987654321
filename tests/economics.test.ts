import { describe, expect, it } from "vitest";
import { MODEL_RATES, PLATFORM_INFRA_INR_PER_YEAR, QUOTA } from "@/lib/constants";
import { grossMargin, priceUsage, worstCaseCost } from "@/lib/economics";

/**
 * The arithmetic behind every commercial number in the admin area.
 *
 * These are the calculations a contract gets signed against, so they are tested
 * as functions of their inputs rather than asserted against whatever the
 * dashboard happens to render.
 */

// Imported from the module the dashboard uses, not reimplemented. These used
// to be local copies "so the test does not need server-only" — which meant the
// tested formula and the rendered formula were two pieces of code that merely
// happened to agree. lib/economics is deliberately free of server-only for
// exactly this reason.

describe("AI pricing", () => {
  it("prices a measured worst-case grading call", () => {
    // 5,271 input + 1,126 output, measured against gemini-3.6-flash.
    const cost = priceUsage(5_271, 1_126);
    expect(cost).toBeCloseTo(0.719, 2);
  });

  it("charges output more than input for the same token count", () => {
    expect(priceUsage(0, 1_000)).toBeGreaterThan(priceUsage(1_000, 0));
  });

  it("costs nothing for no usage", () => {
    expect(priceUsage(0, 0)).toBe(0);
  });

  it("scales linearly", () => {
    expect(priceUsage(2_000, 2_000)).toBeCloseTo(priceUsage(1_000, 1_000) * 2, 10);
  });
});

describe("gross margin", () => {
  it("computes margin on a healthy contract", () => {
    expect(grossMargin(1_000_000, 167_000)).toBeCloseTo(0.833, 3);
  });

  it("goes negative when cost exceeds revenue", () => {
    expect(grossMargin(500, 743)).toBeLessThan(0);
  });

  it("returns null for zero revenue rather than dividing by zero", () => {
    expect(grossMargin(0, 5_000)).toBeNull();
  });

  it("returns null for negative revenue", () => {
    expect(grossMargin(-1, 100)).toBeNull();
  });

  it("is exactly 100% when a contract costs nothing to serve", () => {
    expect(grossMargin(400_000, 0)).toBe(1);
  });

  it("flags a contract below the 30% threshold", () => {
    const below = grossMargin(200_000, 167_000)!;
    const above = grossMargin(500_000, 167_000)!;
    expect(below).toBeLessThan(0.3);
    expect(above).toBeGreaterThan(0.3);
  });
});

describe("worst-case contract cost", () => {
  const GRADING = 0.719;
  const INTERVIEW = 2.16;

  it("matches the figure the licence page shows for 1,000 seats", () => {
    // 1,000 seats x (300 gradings + 60 interviews)
    const cost = worstCaseCost(1_000, 300, 60, GRADING, INTERVIEW);
    expect(Math.round(cost)).toBe(345_300);
  });

  it("leaves a healthy floor against a 10 lakh contract", () => {
    const cost = worstCaseCost(1_000, 300, 60, GRADING, INTERVIEW);
    expect(grossMargin(1_000_000, cost)!).toBeGreaterThan(0.6);
  });

  it("is underwater at the default allowance if a seat is priced at Rs 200", () => {
    const perSeat =
      QUOTA.pro.gradings * GRADING + QUOTA.pro.interviews * INTERVIEW;
    expect(grossMargin(200, perSeat)!).toBeLessThan(0);
  });

  it("costs nothing when no seats are licensed", () => {
    expect(worstCaseCost(0, 300, 60, GRADING, INTERVIEW)).toBe(0);
  });
});

describe("fair-use quota", () => {
  it("bounds a Pro student's annual model spend", () => {
    const perStudent =
      QUOTA.pro.gradings * 0.719 + QUOTA.pro.interviews * 2.16;
    // The ceiling the pricing conversation was built on.
    expect(perStudent).toBeLessThan(300);
  });

  it("gives free users no interviews", () => {
    expect(QUOTA.free.interviews).toBe(0);
  });

  it("gives Pro strictly more than free", () => {
    expect(QUOTA.pro.gradings).toBeGreaterThan(QUOTA.free.gradings);
  });

  it("measures over a rolling year", () => {
    expect(QUOTA.windowDays).toBe(365);
  });
});

describe("platform infrastructure", () => {
  it("is a real cost, not zero, so margin is not flattered", () => {
    expect(PLATFORM_INFRA_INR_PER_YEAR).toBeGreaterThan(0);
  });

  it("is negligible per seat at scale but not per seat at ten", () => {
    expect(PLATFORM_INFRA_INR_PER_YEAR / 1_000).toBeLessThan(100);
    expect(PLATFORM_INFRA_INR_PER_YEAR / 10).toBeGreaterThan(1_000);
  });
});
