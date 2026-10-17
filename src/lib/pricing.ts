/**
 * What CaseCode sells to an individual, and the arithmetic behind each price.
 *
 * Shared by the server (which charges these amounts and enforces these
 * allowances) and the pages (which show them), so a price can never be shown
 * as one number and charged as another.
 *
 * WORST-CASE UNIT COSTS, from 1 Jan 2027 when Gemini's rates double:
 *   graded answer ₹1.44, mock interview ₹4.32 (src/lib/economics.ts).
 * What we keep from a price: it is GST-inclusive (÷1.18), less ~2% gateway fee.
 *
 *   plan      price    allowance          full-use cost   kept    margin
 *   monthly   ₹299     50 + 10 interviews   ₹115           ₹247    ₹132
 *   season    ₹799     160 + 35             ₹382           ₹661    ₹280
 *   annual    ₹2,499   500 + 100            ₹1,152         ₹2,068  ₹916
 *
 * So every plan is profitable even for a student who uses every last answer,
 * which the old ₹499 / 250 + 50 plan was not.
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
    pricePaise: 29_900,
    days: 30,
    gradings: 50,
    interviews: 10,
    renewalWindowDays: 5,
  },
  season: {
    code: "season",
    name: "Placement Season Pass",
    tagline: "Three months, timed for placement season.",
    pricePaise: 79_900,
    days: 90,
    gradings: 160,
    interviews: 35,
    renewalWindowDays: 14,
  },
  annual: {
    code: "annual",
    name: "Annual",
    tagline: "The whole year, at the lowest monthly price.",
    pricePaise: 249_900,
    days: 365,
    gradings: 500,
    interviews: 100,
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

export type TopupCode = "answers_25" | "interviews_10" | "combo";

export interface Topup {
  code: TopupCode;
  name: string;
  pricePaise: number;
  gradings: number;
  interviews: number;
}

/**
 * Top-up packs. Each is profitable at the 2027 rates:
 *   answers_25    ₹99   cost ₹36   kept ₹82
 *   interviews_10 ₹149  cost ₹43   kept ₹123
 *   combo         ₹299  cost ₹137  kept ₹247
 */
export const TOPUPS: Record<TopupCode, Topup> = {
  answers_25: { code: "answers_25", name: "25 graded answers", pricePaise: 9_900, gradings: 25, interviews: 0 },
  interviews_10: { code: "interviews_10", name: "10 mock interviews", pricePaise: 14_900, gradings: 0, interviews: 10 },
  combo: { code: "combo", name: "Practice pack: 50 answers + 15 interviews", pricePaise: 29_900, gradings: 50, interviews: 15 },
};

export const TOPUP_ORDER: TopupCode[] = ["answers_25", "interviews_10", "combo"];

/** Top-up credits last a year from purchase. */
export const TOPUP_VALID_DAYS = 365;

export function isTopupCode(value: unknown): value is TopupCode {
  return typeof value === "string" && value in TOPUPS;
}

/** CaseCode's share of an expert mock interview, in basis points (25%). */
export const EXPERT_COMMISSION_BPS = 2500;
export const EXPERT_PRICE_RANGE_PAISE = { min: 100_000, max: 500_000 } as const;

/** Splits a session price into CaseCode's commission and the expert's payout. */
export function splitExpertPrice(pricePaise: number, commissionBps = EXPERT_COMMISSION_BPS) {
  const commission = Math.round((pricePaise * commissionBps) / 10_000);
  return { commissionPaise: commission, payoutPaise: pricePaise - commission };
}

/** "₹2,499" from paise. */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** What one month of a plan works out to, for comparing plans. */
export function perMonth(plan: Plan): string {
  return rupees(Math.round((plan.pricePaise / plan.days) * 30));
}
