import { describe, expect, it } from "vitest";
import { priceUsage, splitTotal } from "@/lib/usage";
import { buildQuotaStatus, openWindow, quotaDenial, type QuotaFacts, type QuotaStatus } from "@/lib/quota";
import { PLANS, USAGE_WINDOW } from "@/lib/pricing";
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
    viaInstitution: false,
    plan: null,
    periodEndsAt: null,
    window: { hours: 5, gradingLimit: 8, interviewLimit: 3, gradingsUsed: 0, interviewsUsed: 0, resetsAt: null },
    topups: { gradings: 0, interviews: 0 },
    planLeft: { gradings: 0, interviews: QUOTA.pro.interviews },
    exempt: false,
  };

  it("sends a campus student to the person who can actually raise it", () => {
    // A licensed student cannot buy their way past this and cannot wait a year
    // through placement season. Only the placement cell can change it.
    const denial = quotaDenial("gradings", { ...base, viaInstitution: true });
    expect(denial.error).toContain("placement cell");
    expect(denial.error).not.toContain("Pro raises this");
  });

  it("tells a retail Pro user the window rolls", () => {
    const denial = quotaDenial("gradings", base);
    expect(denial.error).toContain(String(QUOTA.windowDays));
    expect(denial.error).not.toContain("placement cell");
  });

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
    expect(denial.error).toMatch(/Upgrade to CaseCode Pro/);
  });

  it("does not offer a Pro upgrade to a closed account", () => {
    // A grading limit of zero cannot be a tier — every free account gets graded
    // answers — so it only happens when the account is closed. Telling that
    // person to buy Pro for mock interviews, which is what this used to say,
    // is both wrong and unactionable.
    const closed: QuotaStatus = {
      ...base,
      isPro: false,
      gradingLimit: 0,
      gradingsUsed: 2,
      gradingsLeft: 0,
    };
    const denial = quotaDenial("gradings", closed);
    expect(denial.error).not.toMatch(/Pro/);
    expect(denial.error).toMatch(/not currently able to submit/i);
    expect(denial.quota.upgrade).toBe(false);
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
  const NOW = new Date("2026-10-17T12:00:00Z");
  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
  const facts = (over: Partial<QuotaFacts> = {}): QuotaFacts => ({
    row: { is_pro: true, grading_limit: 250, interview_limit: 50, gradings_used: 0, interviews_used: 0 },
    viaInstitution: false,
    subscription: null,
    uses: [],
    debits: [],
    credits: { gradings: 0, interviews: 0 },
    exempt: false,
    ...over,
  });

  it("applies the free tier when the licence does not grant Pro", () => {
    const status = buildQuotaStatus(
      facts({ row: { is_pro: false, grading_limit: 250, interview_limit: 50, gradings_used: 3, interviews_used: 0 } }),
      NOW,
    );
    // The RPC still reports the Pro-shaped defaults; the caller is responsible
    // for not handing them to a free user.
    expect(status.isPro).toBe(false);
    expect(status.gradingLimit).toBe(QUOTA.free.gradings);
    expect(status.interviewLimit).toBe(QUOTA.free.interviews);
    expect(status.gradingsLeft).toBe(Math.min(QUOTA.free.gradings - 3, USAGE_WINDOW.gradings));
  });

  it("honours a per-licence override for a campus Pro user", () => {
    const status = buildQuotaStatus(
      facts({ row: { is_pro: true, grading_limit: 900, interview_limit: 120, gradings_used: 10, interviews_used: 2 } }),
      NOW,
    );
    expect(status.gradingLimit).toBe(900);
    expect(status.interviewLimit).toBe(120);
    expect(status.gradingsUsed).toBe(10);
  });

  it("never reports a negative remainder", () => {
    const status = buildQuotaStatus(
      facts({ row: { is_pro: true, grading_limit: 250, interview_limit: 50, gradings_used: 400, interviews_used: 99 } }),
      NOW,
    );
    expect(status.gradingsLeft).toBe(0);
    expect(status.interviewsLeft).toBe(0);
  });

  it("refuses a deactivated account instead of falling back to the free tier", () => {
    // quota_status() returns 0/0 for a deactivated account; a tier fallback
    // once overwrote it and the account kept 60 graded answers a year.
    const status = buildQuotaStatus(
      facts({
        row: { is_pro: false, grading_limit: 0, interview_limit: 0, gradings_used: 12, interviews_used: 0 },
        credits: { gradings: 25, interviews: 10 },
      }),
      NOW,
    );
    expect(status.gradingLimit).toBe(0);
    expect(status.gradingsLeft).toBe(0);
    expect(status.interviewsLeft).toBe(0);
  });

  it("treats a missing row as a free user at zero usage rather than failing", () => {
    const status = buildQuotaStatus(facts({ row: null }), NOW);
    expect(status.isPro).toBe(false);
    expect(status.gradingsUsed).toBe(0);
    expect(status.gradingsLeft).toBe(Math.min(QUOTA.free.gradings, USAGE_WINDOW.gradings));
  });

  it("uses the plan's allowance from the period start for a subscriber", () => {
    const status = buildQuotaStatus(
      facts({
        subscription: { planCode: "monthly", startsAt: hoursAgo(24 * 10), endsAt: hoursAgo(-24 * 20) },
        // One use before the period began does not count against it.
        uses: [
          { kind: "gradings", at: hoursAgo(24 * 11) },
          { kind: "gradings", at: hoursAgo(24 * 5) },
          { kind: "interviews", at: hoursAgo(24 * 4) },
        ],
      }),
      NOW,
    );
    expect(status.plan).toBe("monthly");
    expect(status.gradingLimit).toBe(PLANS.monthly.gradings);
    expect(status.gradingsUsed).toBe(1);
    expect(status.interviewsUsed).toBe(1);
    expect(status.periodEndsAt).toBe(hoursAgo(-24 * 20));
  });

  it("stops at the 5-hour limit even with allowance left, and says when it resets", () => {
    const uses = Array.from({ length: USAGE_WINDOW.gradings }, (_, i) => ({
      kind: "gradings" as const,
      at: hoursAgo(4 - i * 0.1),
    }));
    const status = buildQuotaStatus(
      facts({ subscription: { planCode: "annual", startsAt: hoursAgo(100), endsAt: hoursAgo(-1000) }, uses }),
      NOW,
    );
    expect(status.gradingLimit - status.gradingsUsed).toBeGreaterThan(0);
    expect(status.gradingsLeft).toBe(0);
    expect(status.window.resetsAt).toBe(new Date(new Date(hoursAgo(4)).getTime() + 5 * 3_600_000).toISOString());
    const denial = quotaDenial("gradings", status);
    expect(denial.error).toMatch(/5-hour window/);
    expect(denial.quota.window_resets_at).toBe(status.window.resetsAt);
  });

  it("lets top-up credits carry on past the 5-hour limit", () => {
    const uses = Array.from({ length: USAGE_WINDOW.gradings }, () => ({ kind: "gradings" as const, at: hoursAgo(1) }));
    const status = buildQuotaStatus(facts({ uses, credits: { gradings: 25, interviews: 0 } }), NOW);
    expect(status.planLeft.gradings).toBe(0);
    expect(status.gradingsLeft).toBe(25);
  });

  it("does not count a use a top-up paid for against the plan or the window", () => {
    const uses = Array.from({ length: USAGE_WINDOW.gradings + 2 }, () => ({ kind: "gradings" as const, at: hoursAgo(1) }));
    const debits = [
      { kind: "gradings" as const, at: hoursAgo(1) },
      { kind: "gradings" as const, at: hoursAgo(1) },
    ];
    const status = buildQuotaStatus(
      facts({ subscription: { planCode: "monthly", startsAt: hoursAgo(48), endsAt: hoursAgo(-600) }, uses, debits }),
      NOW,
    );
    expect(status.gradingsUsed).toBe(USAGE_WINDOW.gradings);
    expect(status.window.gradingsUsed).toBe(USAGE_WINDOW.gradings);
  });

  it("does not meter admins against the window", () => {
    const uses = Array.from({ length: 20 }, () => ({ kind: "gradings" as const, at: hoursAgo(1) }));
    const status = buildQuotaStatus(facts({ uses, exempt: true }), NOW);
    expect(status.gradingsLeft).toBeGreaterThan(0);
  });
});

describe("the 5-hour window", () => {
  const NOW = new Date("2026-10-17T12:00:00Z");
  const at = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

  it("is closed when nothing was used in the last five hours", () => {
    expect(openWindow([at(6), at(7)], NOW)).toBeNull();
    expect(openWindow([], NOW)).toBeNull();
  });

  it("opens with the first use and resets five hours later", () => {
    const w = openWindow([at(3), at(2), at(1)], NOW);
    expect(w?.start.toISOString()).toBe(at(3));
    expect(w?.resetsAt.toISOString()).toBe(at(-2));
  });

  it("starts a fresh window with the first use after the last one closed", () => {
    // Window 1 opened 9h ago and closed 4h ago; a use 2h ago opened window 2.
    const w = openWindow([at(9), at(8), at(2), at(1)], NOW);
    expect(w?.start.toISOString()).toBe(at(2));
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
