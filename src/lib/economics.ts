import { MODEL_RATES, PLATFORM_INFRA_INR_PER_YEAR, QUOTA } from "@/lib/constants";
import { CONVERSATION_LIMITS } from "@/lib/conversation-limits";

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
 * Worst-case graded answer: a full 20,000-character answer is about 6,500
 * input tokens; the grade about 1,500 output, plus up to ~512 of thinking
 * (gradingThinkingBudget in src/lib/ai/providers.ts), which is billed as
 * output. The earlier figure (5,271 + 1,126) left thinking out, and measured
 * production calls carried 450–3,600 thinking tokens each.
 */
export const GRADING_COST_INR = priceUsage(6_500, 1_500 + 512);

/**
 * Tokens for a whole conversation. Each turn resends everything so far, so
 * input grows with the square of the length:
 *   turn t sends  system + (t − 1) × (message + reply) + message.
 */
export function sessionTokens(turns: number, systemTokens: number, messageTokens: number, replyTokens: number) {
  let input = 0;
  for (let t = 1; t <= turns; t++) input += systemTokens + (t - 1) * (messageTokens + replyTokens) + messageTokens;
  return { input, output: turns * replyTokens };
}

/**
 * Worst-case "interview": the costliest conversation the limits allow — the
 * case interviewer at its turn limit, every message at the character limit
 * (about 4 characters a token), every reply at its 700-token cap, over a
 * ~3,000-token case brief. Replies are not allowed to think. A negotiation or
 * sales meeting at its limits costs a little less. The earlier figure — three
 * graded answers — underestimated this tenfold.
 */
const WORST_SESSION = sessionTokens(
  CONVERSATION_LIMITS.caseChat.maxTurns,
  3_000,
  CONVERSATION_LIMITS.caseChat.maxMessageChars / 4,
  700,
);
export const INTERVIEW_COST_INR = priceUsage(WORST_SESSION.input, WORST_SESSION.output);

/**
 * Typical costs, for pricing the longer plans: nobody uses a season or a year
 * of weekly limits with every interview at its maximum length. A graded answer
 * averages ~4,200 input and ~1,000 output tokens in production, plus a little
 * thinking; a practice interview runs about 12 exchanges of short messages.
 */
export const TYPICAL_GRADING_COST_INR = priceUsage(4_200, 1_000 + 300);
const TYPICAL_SESSION = sessionTokens(12, 3_000, 120, 300);
export const TYPICAL_INTERVIEW_COST_INR = priceUsage(TYPICAL_SESSION.input, TYPICAL_SESSION.output);

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
