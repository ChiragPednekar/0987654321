import type { Domain } from "@/lib/types/database";
import type { PlacementAttempt, PlacementReview } from "./types";

export const TARGET_ROLES = ["Finance analyst", "Sales & marketing", "Business analyst", "Consulting", "Operations", "Human resources", "Product management"] as const;
export const COMMON_CRITERIA = { problem_framing: 20, analysis: 30, recommendation: 30, communication: 20 };
export const DEFENSE_CRITERIA = { clarity: 25, structure: 25, evidence: 25, handling_questions: 25 };
export const GD_SKILLS = ["contribution", "listening", "collaboration", "clarity"] as const;
export type GdSkill = (typeof GD_SKILLS)[number];
export const FOLLOW_UP = "Your main assumption turns out to be wrong and the available budget falls by 20%. What would you change, what evidence would you collect, and what would you tell the stakeholder?";
/** One baseline per student; a new version of the task gets a new key. */
export const DIAGNOSTIC_KEY = "baseline-v1";

const ROLE_DOMAIN: Record<string, Domain> = {
  "Finance analyst": "finance", "Sales & marketing": "marketing", "Business analyst": "strategy",
  "Consulting": "consulting", "Operations": "operations", "Human resources": "strategy",
  "Product management": "product_management",
};
/** The case domain that best practises a target role; finance when none is set. */
export function roleDomain(role: string | null | undefined): Domain {
  return ROLE_DOMAIN[role ?? ""] ?? "finance";
}

export const DIAGNOSTIC = {
  title: "A growing business with falling profits",
  scenario: "An Indian café chain sold 10,000 orders last month at an average price of ₹200. Variable cost was ₹120 per order and fixed costs were ₹5,00,000. This month it sold 12,000 orders at ₹190, variable cost rose to ₹130, and fixed costs stayed the same. Explain what happened to revenue and operating profit. Recommend one action, state your assumptions and describe the evidence you would collect before acting.",
  reference: "Previous revenue ₹20,00,000, contribution ₹8,00,000, profit ₹3,00,000. Current revenue ₹22,80,000, contribution ₹7,20,000, profit ₹2,20,000. Revenue grew 14% but profit fell about 26.7%. Lower unit contribution (₹80 to ₹60) outweighed volume growth. Investigate discounting, product mix and supplier costs. Test a targeted pricing or cost intervention while measuring volume response and customer retention; do not assume a price increase leaves demand unchanged.",
};

export function weekStart(now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function latestReviews(reviews: PlacementReview[]): Map<string, PlacementReview> {
  const result = new Map<string, PlacementReview>();
  for (const review of [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    if (!result.has(review.attempt_id)) result.set(review.attempt_id, review);
  }
  return result;
}
export function summarizeEvidence(attempts: PlacementAttempt[], reviews: PlacementReview[]) {
  const latest = latestReviews(reviews);
  const evaluated = attempts.filter((a) => a.status === "evaluated" && a.assessment_id && a.result);
  const reviewed = evaluated.filter((a) => latest.has(a.id));
  const gaps = reviewed.map((a) => Math.abs(latest.get(a.id)!.percentage - a.result!.percentage));
  return { evaluated: evaluated.length, reviewed: reviewed.length, pending: evaluated.length - reviewed.length,
    meanReviewDifference: gaps.length ? gaps.reduce((a,b) => a+b,0) / gaps.length : null };
}
export function scoreReview(criteria: Record<string, number>, scores: Record<string, number>): number {
  if (Object.keys(scores).length !== Object.keys(criteria).length) throw new Error("Score every criterion.");
  let earned = 0, maximum = 0;
  for (const [key, max] of Object.entries(criteria)) {
    const value = scores[key];
    if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`Score ${key.replaceAll("_", " ")} between 0 and ${max}.`);
    earned += value; maximum += max;
  }
  if (!maximum) throw new Error("The rubric has no points.");
  return Math.round(earned / maximum * 10000) / 100;
}

/** A student with no graded practice in this many days counts as lapsed. */
export const STALE_DAYS = 14;

type BatchScore = { user_id: string; percentage: number; evaluated_at: string };
export type BatchProgress = {
  id: string; name: string; students: number; active: number;
  recentAvg: number | null; earlierAvg: number | null; recentCount: number; earlierCount: number;
};

/**
 * Practice scores per batch, last 30 days against the 30 before. Different
 * students attempt different cases, so this says whether the batch is moving,
 * not that anyone measurably improved; the page says so. Fewer than five
 * graded answers in a window is reported as no figure rather than a noisy one.
 */
export function batchProgress(
  batches: { user_id: string; classroom_id: string; name: string }[],
  scores: BatchScore[],
  now: number,
  minSample = 5,
): BatchProgress[] {
  const day = 86_400_000;
  const groups = new Map<string, { name: string; members: Set<string> }>();
  for (const b of batches) {
    const group = groups.get(b.classroom_id) ?? { name: b.name, members: new Set<string>() };
    group.members.add(b.user_id);
    groups.set(b.classroom_id, group);
  }
  const avg = (rows: BatchScore[]) =>
    rows.length >= minSample ? rows.reduce((s, r) => s + Number(r.percentage), 0) / rows.length : null;
  return [...groups].map(([id, { name, members }]) => {
    const mine = scores.filter((s) => members.has(s.user_id));
    const age = (s: BatchScore) => now - new Date(s.evaluated_at).getTime();
    const recent = mine.filter((s) => age(s) <= 30 * day);
    const earlier = mine.filter((s) => age(s) > 30 * day && age(s) <= 60 * day);
    const active = new Set(mine.filter((s) => age(s) <= STALE_DAYS * day).map((s) => s.user_id)).size;
    return {
      id, name, students: members.size, active,
      recentAvg: avg(recent), earlierAvg: avg(earlier),
      recentCount: recent.length, earlierCount: earlier.length,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
