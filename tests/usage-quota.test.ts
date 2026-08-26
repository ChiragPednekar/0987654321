import { describe, expect, it } from "vitest";
import { priceUsage, splitTotal } from "@/lib/usage";
import { getQuotaStatus, quotaDenial, type QuotaStatus } from "@/lib/quota";
import { MODEL_RATES, QUOTA } from "@/lib/constants";

/**
 * AI cost accounting and the fair-use quota.
 *
 * Both are commercial controls rather than features: the quota is what makes a
 * fixed-price campus contract safe to sign, and the pricing is what the owner's
 * margin view rests on. Neither had a test.
 */

describe("usage pricing", () => {
  it("prices input and output at their separate published rates", () => {
    const cost = priceUsage(1_000_000, 0);
    expect(cost).toBeCloseTo(MODEL_RATES.inputPerMillionUsd * MODEL_RATES.usdInr, 6);

    const outputCost = priceUsage(0, 1_000_000);
    expect(outputCost).toBeCloseTo(
      MODEL_RATES.outputPerMillionUsd * MODEL_RATES.usdInr,
      6,
    );
  });

  it("charges output more than input for the same token count", () => {
    expect(priceUsage(0, 10_000)).toBeGreaterThan(priceUsage(10_000, 0));
  });

  it("costs nothing for no usage", () => {
    expect(priceUsage(0, 0)).toBe(0);
  });

  it("stays within the measured per-grading figure the quota is sized against", () => {
    // The worst-case grading call measured for constants.ts: 5,271 in, 1,126
    // out, quoted at roughly Rs 0.72. If a rate change ever breaks this, the
    // Rs 288/seat ceiling in QUOTA is wrong and the contract maths with it.
    const cost = priceUsage(5_271, 1_126);
    expect(cost).toBeGreaterThan(0.5);
    expect(cost).toBeLessThan(1.0);
  });
});

describe("splitting a provider-reported total", () => {
  it("apportions 80/20 input:output", () => {
    expect(splitTotal(1_000)).toEqual({ input: 800, output: 200 });
  });

  it("conserves the total it was given", () => {
    for (const total of [1, 7, 999, 6_397]) {
      const { input, output } = splitTotal(total);
      expect(input + output).toBe(total);
    }
  });
});

describe("quota denial messages", () => {
  const base: QuotaStatus = {
    isPro: true,
    gradingLimit: QUOTA.pro.gradings,
    interviewLimit: QUOTA.pro.interviews,
    gradingsUsed: QUOTA.pro.gradings,
    interviewsUsed: 0,
    gradingsLeft: 0,
    interviewsLeft: QUOTA.pro.interviews,
  };

  it("states the actual numbers so a student can act on it", () => {
    const denial = quotaDenial("gradings", base);
    expect(denial.error).toContain(String(QUOTA.pro.gradings));
    expect(denial.quota.used).toBe(QUOTA.pro.gradings);
    expect(denial.quota.limit).toBe(QUOTA.pro.gradings);
    expect(denial.quota.window_days).toBe(QUOTA.windowDays);
  });

  it("does not tell a Pro user to upgrade", () => {
    expect(quotaDenial("gradings", base).quota.upgrade).toBe(false);
  });

  it("offers the upgrade to a free user", () => {
    const free: QuotaStatus = {
      ...base,
      isPro: false,
      gradingLimit: QUOTA.free.gradings,
      gradingsUsed: QUOTA.free.gradings,
    };
    const denial = quotaDenial("gradings", free);
    expect(denial.quota.upgrade).toBe(true);
    expect(denial.error).toContain(String(QUOTA.pro.gradings));
  });

  it("says interviews are a Pro feature rather than 'you ran out'", () => {
    // A free user at a zero limit never had an allowance to exhaust, and
    // "you have used 0 of 0" would be a confusing way to sell an upgrade.
    const free: QuotaStatus = {
      ...base,
      isPro: false,
      interviewLimit: 0,
      interviewsUsed: 0,
      interviewsLeft: 0,
    };
    const denial = quotaDenial("interviews", free);
    expect(denial.error).toMatch(/part of CaseCode Pro/i);
    expect(denial.error).not.toMatch(/used all/i);
  });
});

describe("quota status", () => {
  /** Stands in for the supabase client: only `.rpc()` is reached. */
  function clientReturning(row: unknown) {
    return { rpc: async () => ({ data: row, error: null }) } as never;
  }

  it("applies the free tier when the licence does not grant Pro", async () => {
    const status = await getQuotaStatus(
      clientReturning([
        { is_pro: false, grading_limit: 250, interview_limit: 50, gradings_used: 3, interviews_used: 0 },
      ]),
      "user-1",
    );

    // The RPC still reports the Pro-shaped defaults; the caller is responsible
    // for not handing them to a free user.
    expect(status.isPro).toBe(false);
    expect(status.gradingLimit).toBe(QUOTA.free.gradings);
    expect(status.interviewLimit).toBe(QUOTA.free.interviews);
    expect(status.gradingsLeft).toBe(QUOTA.free.gradings - 3);
  });

  it("honours a per-licence override for a Pro user", async () => {
    const status = await getQuotaStatus(
      clientReturning([
        { is_pro: true, grading_limit: 900, interview_limit: 120, gradings_used: 10, interviews_used: 2 },
      ]),
      "user-1",
    );

    expect(status.gradingLimit).toBe(900);
    expect(status.interviewLimit).toBe(120);
    expect(status.gradingsLeft).toBe(890);
    expect(status.interviewsLeft).toBe(118);
  });

  it("never reports a negative remainder", async () => {
    const status = await getQuotaStatus(
      clientReturning([
        { is_pro: true, grading_limit: 250, interview_limit: 50, gradings_used: 400, interviews_used: 99 },
      ]),
      "user-1",
    );

    expect(status.gradingsLeft).toBe(0);
    expect(status.interviewsLeft).toBe(0);
  });

  it("treats a missing row as a free user at zero usage rather than failing", async () => {
    // Refusing to grade because a usage lookup came back empty would be the
    // wrong failure — a new account has no scores and no licence yet.
    const status = await getQuotaStatus(clientReturning(null), "user-1");

    expect(status.isPro).toBe(false);
    expect(status.gradingsUsed).toBe(0);
    expect(status.gradingsLeft).toBe(QUOTA.free.gradings);
  });
});

describe("the quota bounds annual spend", () => {
  it("caps a Pro seat at the figure the contract is priced against", () => {
    const gradingCost = priceUsage(5_271, 1_126);
    const interviewCost = gradingCost * 3; // ~9 turns, per constants.ts
    const worstCase =
      QUOTA.pro.gradings * gradingCost + QUOTA.pro.interviews * interviewCost;

    // constants.ts states a hard ceiling of about Rs 288 per user per year.
    expect(worstCase).toBeLessThan(350);
  });

  it("gives Pro strictly more than free on both limits", () => {
    expect(QUOTA.pro.gradings).toBeGreaterThan(QUOTA.free.gradings);
    expect(QUOTA.pro.interviews).toBeGreaterThan(QUOTA.free.interviews);
  });
});
