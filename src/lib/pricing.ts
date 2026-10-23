/**
 * What CaseCode sells to an individual, and the arithmetic behind each price.
 *
 * Shared by the server (which charges these amounts and enforces these
 * allowances) and the pages (which show them), so a price can never be shown
 * as one number and charged as another.
 *
 * WORST-CASE UNIT COSTS, from 1 Jan 2027 when Gemini's rates double
 * (src/lib/economics.ts — measured, thinking tokens included):
 *   graded answer ₹2.19, interview ₹28.51 — the costliest session there is,
 *   a 15-turn case interview at the message limit (src/lib/conversation-limits.ts).
 * A typical interview is nearer ₹11. What we keep from a price: it is
 * GST-inclusive (÷1.18), less ~2% gateway fee.
 *
 *   plan      price    allowance          worst full use   kept     margin
 *   monthly   ₹499     50 + 6 interviews    ₹281            ₹414     32%
 *   season    ₹1,299   120 + 16             ₹719            ₹1,079   33%
 *   annual    ₹4,999   400 + 60             ₹2,587          ₹4,152   38%
 *
 * Every plan stays profitable for a student who uses every answer and every
 * interview in the most expensive way possible. The earlier allowances (up to
 * 160 + 35 for ₹999) were priced on an interview costing three graded answers;
 * measured, a conversation costs ten to fifteen. One edge remains: a résumé
 * critique of 50 bullets is two model calls (₹5.41 worst) but one answer.
 */

export type PlanCode = "monthly" | "season" | "annual";

export interface Plan {
  code: PlanCode;
  name: string;
  /** Short line under the name. */
  tagline: string;
  pricePaise: number;
  days: number;
  gradings: number;
  interviews: number;
  /** A subscriber may buy the next period once this many days or fewer are left. */
  renewalWindowDays: number;
}

export const PLANS: Record<PlanCode, Plan> = {
  monthly: {
    code: "monthly",
    name: "Monthly",
    tagline: "Month to month, for a steady routine.",
    pricePaise: 49_900,
    days: 30,
    gradings: 50,
    interviews: 6,
    renewalWindowDays: 5,
  },
  season: {
    code: "season",
    name: "Placement Season Pass",
    tagline: "Three months, timed for placement season.",
    pricePaise: 129_900,
    days: 90,
    gradings: 120,
    interviews: 16,
    renewalWindowDays: 14,
  },
  annual: {
    code: "annual",
    name: "Annual",
    tagline: "One purchase for year-round practice.",
    pricePaise: 499_900,
    days: 365,
    gradings: 400,
    interviews: 60,
    renewalWindowDays: 30,
  },
};

export const PLAN_ORDER: PlanCode[] = ["monthly", "season", "annual"];

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && value in PLANS;
}

/**
 * The 5-hour limit, like Claude's: a window opens with the first use and
 * resets five hours later. It stops one sitting from burning through a
 * month's allowance (and the model budget) in an afternoon. Top-up credits
 * keep working past it.
 */
export const USAGE_WINDOW = {
  hours: 5,
  gradings: 8,
  interviews: 3,
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
