import { MODEL_RATES, PLATFORM_INFRA_INR_PER_YEAR, QUOTA } from "@/lib/constants";

/**
 * The arithmetic behind every commercial number in the admin area.
 *
 * Deliberately free of `server-only` and of any database access: these are pure
 * functions of their inputs, so the same definition serves the dashboard and
 * the tests. tests/economics.test.ts previously kept its own copy of
 * `grossMargin` and `worstCaseCost` "so the test does not need server-only",
 * which meant the tested formula and the rendered formula were two different
 * pieces of code that happened to agree.
 */

/** Rupees, from the provider's published per-million rates. */
export function priceUsage(inputTokens: number, outputTokens: number): number {
  return (
    ((inputTokens / 1e6) * MODEL_RATES.inputPerMillionUsd +
      (outputTokens / 1e6) * MODEL_RATES.outputPerMillionUsd) *
    MODEL_RATES.usdInr
  );
}

/**
 * Measured unit costs, from the worst-case call in constants.ts: a full
 * 20,000-character answer at 5,271 input + 1,126 output tokens.
 */
export const GRADING_COST_INR = priceUsage(5_271, 1_126);
/** An interview runs about nine turns. */
export const INTERVIEW_COST_INR = GRADING_COST_INR * 3;

/**
 * Gross margin as a fraction, or null when there is no revenue to divide by.
 *
 * Null rather than 0 or -Infinity: a licence with no contract value recorded
 * has an *unknown* margin, and showing "0%" would read as a real, terrible
 * number rather than as missing data.
 */
export function grossMargin(revenue: number, cost: number): number | null {
  if (revenue <= 0) return null;
  return (revenue - cost) / revenue;
}

/**
 * What a contract would cost to serve if every licensed seat used its full
 * annual allowance.
 *
 * This is the number that decides whether a price is safe, rather than the
 * measured spend to date — which only says what has happened so far and is
 * always flattering early in a contract, when half the cohort has not signed
 * in yet.
 */
export function worstCaseCost(
  seats: number,
  gradings: number = QUOTA.pro.gradings,
  interviews: number = QUOTA.pro.interviews,
  gradingCost: number = GRADING_COST_INR,
  interviewCost: number = INTERVIEW_COST_INR,
): number {
  return seats * (gradings * gradingCost + interviews * interviewCost);
}

/** Margin under the worst case, with platform infrastructure included. */
export function worstCaseMargin(
  revenue: number,
  seats: number,
  gradings?: number,
  interviews?: number,
): number | null {
  return grossMargin(
    revenue,
    worstCaseCost(seats, gradings, interviews) + PLATFORM_INFRA_INR_PER_YEAR,
  );
}

/** Below this, a contract is flagged for review. */
export const MARGIN_FLOOR = 0.3;
