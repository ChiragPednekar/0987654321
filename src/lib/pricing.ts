/**
 * What CaseCode sells to an individual, and the arithmetic behind each price.
 *
 * Shared by the server (which charges these amounts and enforces these
 * limits) and the pages (which show them), so a price can never be shown as
 * one number and charged as another.
 *
 * HOW USE IS LIMITED (changed 2026-10-23, at the owner's request): like
 * Claude's limits, by time rather than by a pot for the whole plan —
 *   - every 5 hours: up to 10 graded answers and 2 mock interviews, and
 *   - every 7 days (rolling): up to 20 graded answers and 3 mock interviews.
 * The weekly limit is what makes the price possible. Windows alone would allow
 * ~48 interviews a day, and an interview is a whole AI conversation.
 *
 * UNIT COSTS at Gemini's 2027 rates (src/lib/economics.ts, measured):
 *   typical: answer ₹1.41, interview ₹10.98
 *   worst:   answer ₹2.19, interview ₹28.51 (15-turn case chat at the limits)
 * What we keep from a price: it is GST-inclusive (÷1.18), less ~2% gateway fee.
 *
 *   plan     price    weeks   typical full use   worst full use   kept     margin (typ / worst)
 *   monthly  ₹699     4.3     ₹262               ₹554             ₹580     55% / 4%
 *   season   ₹1,799   12.9    ₹786               ₹1,663           ₹1,494   47% / −11%
 *   annual   ₹6,499   52.1    ₹3,186             ₹6,742           ₹5,397   41% / −25%
 *
 * "Full use" means every weekly limit used, every week. The worst column also
 * assumes every interview is a maximal 15-turn case chat at the message limit
 * — over a whole season or year that is not a real student. Monthly never
 * loses money even then; the longer plans are priced on typical heavy use.
 */

export type PlanCode = "monthly" | "season" | "annual";

export interface Plan {
  code: PlanCode;
  name: string;
  /** Short line under the name. */
  tagline: string;
  pricePaise: number;
  days: number;
  /** Graded answers in any rolling 7 days. */
  weeklyGradings: number;
  /** Mock interviews (any AI conversation) in any rolling 7 days. */
  weeklyInterviews: number;
  /** A subscriber may buy the next period once this many days or fewer are left. */
  renewalWindowDays: number;
}

/** The rolling period the weekly limits are counted over. */
export const WEEK_DAYS = 7;

export const PLANS: Record<PlanCode, Plan> = {
  monthly: {
    code: "monthly",
    name: "Monthly",
    tagline: "Month to month, for a steady routine.",
    pricePaise: 69_900,
    days: 30,
    weeklyGradings: 20,
    weeklyInterviews: 3,
    renewalWindowDays: 5,
  },
  season: {
    code: "season",
    name: "Placement Season Pass",
    tagline: "Three months, timed for placement season.",
    pricePaise: 179_900,
    days: 90,
    weeklyGradings: 20,
    weeklyInterviews: 3,
    renewalWindowDays: 14,
  },
  annual: {
    code: "annual",
    name: "Annual",
    tagline: "One purchase for year-round practice.",
    pricePaise: 649_900,
    days: 365,
    weeklyGradings: 20,
    weeklyInterviews: 3,
    renewalWindowDays: 30,
  },
};

export const PLAN_ORDER: PlanCode[] = ["monthly", "season", "annual"];

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && value in PLANS;
}

/**
 * The 5-hour limit, like Claude's: a window opens with the first use and
 * resets five hours later. It paces a sitting; the weekly limit on the plan
 * bounds the week. Top-up credits keep working past both.
 */
export const USAGE_WINDOW = {
  hours: 5,
  gradings: 10,
  interviews: 2,
} as const;

export type TopupCode = "answers_25" | "interviews_5" | "combo";

export interface Topup {
  code: TopupCode;
  name: string;
  pricePaise: number;
  gradings: number;
  interviews: number;
}

/**
 * Top-up packs. Each is profitable at the 2027 rates, at worst-case use:
 *   answers_25    ₹99   worst ₹55   kept ₹82    33%
 *   interviews_5  ₹249  worst ₹143  kept ₹207   31%
 *   combo         ₹399  worst ₹259  kept ₹331   22%
 */
export const TOPUPS: Record<TopupCode, Topup> = {
  answers_25: { code: "answers_25", name: "25 graded answers", pricePaise: 9_900, gradings: 25, interviews: 0 },
  interviews_5: { code: "interviews_5", name: "5 mock interviews", pricePaise: 24_900, gradings: 0, interviews: 5 },
  combo: { code: "combo", name: "Practice pack: 40 answers + 6 interviews", pricePaise: 39_900, gradings: 40, interviews: 6 },
};

export const TOPUP_ORDER: TopupCode[] = ["answers_25", "interviews_5", "combo"];

/** Top-up credits last a year from purchase. */
export const TOPUP_VALID_DAYS = 365;

export function isTopupCode(value: unknown): value is TopupCode {
  return typeof value === "string" && value in TOPUPS;
}

/** A formatted rupee amount from paise. */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** What one month of a plan works out to, for comparing plans. */
export function perMonth(plan: Plan): string {
  return rupees(Math.round((plan.pricePaise / plan.days) * 30));
}
