import { describe, expect, it } from "vitest";
import {
  canRenew,
  nextPeriodEnd,
  nextPeriodStart,
  planForDays,
  purchaseBlock,
  renewalWindowDays,
  type Access,
  type ActiveSubscription,
} from "@/lib/subscription";
import { PLANS, PLAN_ORDER, TOPUPS, TOPUP_ORDER, perMonth, rupees } from "@/lib/pricing";
import { attemptState, linkedInAddUrl, overallPercentage, SUBMIT_GRACE_SECONDS } from "@/lib/certificates";

const DAY = 86_400_000;
const NOW = new Date("2026-10-17T06:00:00Z");
const days = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

describe("plan periods", () => {
  it("starts now when nothing is running", () => {
    expect(nextPeriodStart(null, NOW)).toEqual(NOW);
    expect(days(nextPeriodEnd(null, 30, NOW), NOW)).toBe(30);
  });

  it("queues a renewal behind the running period, losing no days", () => {
    const left20 = new Date(NOW.getTime() + 20 * DAY);
    expect(nextPeriodStart(left20, NOW)).toEqual(left20);
    expect(days(nextPeriodEnd(left20, 90, NOW), NOW)).toBe(110);
  });

  it("ignores a period that has already ended", () => {
    const ended = new Date(NOW.getTime() - 3 * DAY);
    expect(days(nextPeriodEnd(ended, 365, NOW), NOW)).toBe(365);
  });

  it("maps a manual grant to the closest plan's allowance", () => {
    expect(planForDays(7)).toBe("monthly");
    expect(planForDays(30)).toBe("monthly");
    expect(planForDays(60)).toBe("season");
    expect(planForDays(365)).toBe("annual");
  });
});

const sub = (planCode: ActiveSubscription["planCode"], daysLeft: number): ActiveSubscription => ({
  id: "s",
  planCode,
  source: "demo",
  startsAt: new Date(NOW.getTime() - DAY).toISOString(),
  endsAt: new Date(NOW.getTime() + daysLeft * DAY).toISOString(),
});

describe("renewal window", () => {
  it("depends on the plan", () => {
    expect(renewalWindowDays(sub("monthly", 1))).toBe(PLANS.monthly.renewalWindowDays);
    expect(canRenew(sub("monthly", 4), NOW)).toBe(true);
    expect(canRenew(sub("monthly", 20), NOW)).toBe(false);
    expect(canRenew(sub("annual", 25), NOW)).toBe(true);
    expect(canRenew(sub("annual", 200), NOW)).toBe(false);
  });
});

describe("purchaseBlock", () => {
  const access = (over: Partial<Access>): Access => ({ pro: false, canSolve: false, subscription: null, queued: null, ...over });

  it("lets an account with no access buy", () => {
    expect(purchaseBlock(access({}), NOW)).toBeNull();
  });

  it("lets a college-licensed student without Pro buy", () => {
    expect(purchaseBlock(access({ canSolve: true }), NOW)).toBeNull();
  });

  it("refuses Pro that does not come from a subscription", () => {
    expect(purchaseBlock(access({ pro: true, canSolve: true }), NOW)).toMatch(/already has/);
  });

  it("refuses a subscriber until the renewal window, then allows it", () => {
    expect(purchaseBlock(access({ pro: true, subscription: sub("season", 60) }), NOW)).toMatch(/renew in the last 14 days/);
    expect(purchaseBlock(access({ pro: true, subscription: sub("season", 10) }), NOW)).toBeNull();
  });

  it("allows only one queued period", () => {
    const queued = { ...sub("monthly", 40), startsAt: new Date(NOW.getTime() + 10 * DAY).toISOString() };
    expect(purchaseBlock(access({ pro: true, subscription: sub("monthly", 2), queued }), NOW)).toMatch(/already lined up/);
  });
});

/**
 * The prices are a promise to the business, not just numbers on a page: every
 * plan and pack must stay profitable for a student who uses all of it, at the
 * model rates that apply from 1 Jan 2027 (twice today's).
 */
describe("pricing stays profitable at the 2027 model rates", () => {
  const GRADING_2027 = 1.44; // ₹, worst case
  const INTERVIEW_2027 = 4.32;
  const kept = (paise: number) => paise / 100 / 1.18 - (paise / 100) * 0.02; // GST-inclusive, ~2% gateway

  it.each(PLAN_ORDER)("the %s plan makes money at full use", (code) => {
    const plan = PLANS[code];
    const cost = plan.gradings * GRADING_2027 + plan.interviews * INTERVIEW_2027;
    expect(kept(plan.pricePaise)).toBeGreaterThan(cost * 1.3);
  });

  it.each(TOPUP_ORDER)("the %s top-up makes money", (code) => {
    const pack = TOPUPS[code];
    const cost = pack.gradings * GRADING_2027 + pack.interviews * INTERVIEW_2027;
    expect(kept(pack.pricePaise)).toBeGreaterThan(cost * 1.3);
  });

  it("prices the season pass above a month and below three", () => {
    expect(PLANS.season.pricePaise).toBeGreaterThan(PLANS.monthly.pricePaise);
    expect(PLANS.season.pricePaise).toBeLessThan(PLANS.monthly.pricePaise * 3);
  });

  it("makes longer plans cheaper per month", () => {
    const daily = (c: keyof typeof PLANS) => PLANS[c].pricePaise / PLANS[c].days;
    expect(daily("season")).toBeLessThan(daily("monthly"));
    expect(daily("annual")).toBeLessThan(daily("season"));
  });

  it("formats rupees the Indian way", () => {
    expect(rupees(249_900)).toBe("₹2,499");
    expect(perMonth(PLANS.monthly)).toBe("₹299");
  });
});

describe("certificate attempts", () => {
  const base = { status: "in_progress" as const, submitted_at: null };

  it("knows when the time ran out without a submission", () => {
    const deadline = new Date(NOW.getTime() - (SUBMIT_GRACE_SECONDS + 5) * 1000).toISOString();
    expect(attemptState({ ...base, deadline_at: deadline }, NOW)).toBe("expired");
  });

  it("still accepts a submission inside the grace period", () => {
    const deadline = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(attemptState({ ...base, deadline_at: deadline }, NOW)).toBe("in_progress");
  });

  it("treats a submitted but unmarked attempt as grading", () => {
    expect(attemptState({ ...base, deadline_at: null, submitted_at: NOW.toISOString() }, NOW)).toBe("grading");
  });

  it("weights the overall score by each case's marks", () => {
    expect(overallPercentage([{ total: 30, max: 40 }, { total: 30, max: 60 }])).toBe(60);
    expect(overallPercentage([])).toBe(0);
  });

  it("builds a pre-filled LinkedIn add-certification link", () => {
    const url = new URL(
      linkedInAddUrl({ title: "Finance", issuedAt: "2026-10-17T00:00:00Z", url: "https://x.test/certificate/CC-AAAAA-BBBBB", code: "CC-AAAAA-BBBBB" }),
    );
    expect(url.hostname).toBe("www.linkedin.com");
    expect(url.searchParams.get("organizationName")).toBe("CaseCode");
    expect(url.searchParams.get("certId")).toBe("CC-AAAAA-BBBBB");
    expect(url.searchParams.get("issueMonth")).toBe("10");
  });
});
