import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTA } from "@/lib/constants";
import type { Database } from "@/lib/types/database";

/**
 * Annual fair-use quota (see QUOTA in constants for the cost arithmetic).
 *
 * Lives here rather than inline in each route so grading and interviews cannot
 * drift into disagreeing about what a user is allowed — the two limits share a
 * window, a tier lookup and an error shape.
 */

export interface QuotaStatus {
  isPro: boolean;
  gradingLimit: number;
  interviewLimit: number;
  gradingsUsed: number;
  interviewsUsed: number;
  gradingsLeft: number;
  interviewsLeft: number;
}

type Admin = SupabaseClient<Database>;

export async function getQuotaStatus(
  admin: Admin,
  userId: string,
): Promise<QuotaStatus> {
  const { data } = await admin.rpc("quota_status", {
    p_user: userId,
    p_window_days: QUOTA.windowDays,
    // Defaults are passed in rather than duplicated in SQL: constants.ts holds
    // the cost arithmetic, and two copies of that number would drift.
    p_default_gradings: QUOTA.pro.gradings,
    p_default_interviews: QUOTA.pro.interviews,
  });

  const row = Array.isArray(data) ? data[0] : data;

  // A missing row means the user has no scores and no licence yet — treat that
  // as a free tier at zero usage rather than failing the request. Refusing to
  // grade because a usage lookup came back empty would be the wrong failure.
  const isPro = Boolean(row?.is_pro);

  const gradingLimit = isPro
    ? (row?.grading_limit ?? QUOTA.pro.gradings)
    : QUOTA.free.gradings;
  const interviewLimit = isPro
    ? (row?.interview_limit ?? QUOTA.pro.interviews)
    : QUOTA.free.interviews;

  const gradingsUsed = Number(row?.gradings_used ?? 0);
  const interviewsUsed = Number(row?.interviews_used ?? 0);

  return {
    isPro,
    gradingLimit,
    interviewLimit,
    gradingsUsed,
    interviewsUsed,
    gradingsLeft: Math.max(0, gradingLimit - gradingsUsed),
    interviewsLeft: Math.max(0, interviewLimit - interviewsUsed),
  };
}

export interface QuotaDenial {
  error: string;
  quota: {
    used: number;
    limit: number;
    window_days: number;
    upgrade: boolean;
  };
}

/**
 * The 402 body for an exhausted quota.
 *
 * Deliberately states the actual numbers. "You have used 250 of 250 graded
 * answers" is something a student can act on and a placement officer can check;
 * a bare "limit reached" generates a support ticket.
 */
export function quotaDenial(
  kind: "gradings" | "interviews",
  status: QuotaStatus,
): QuotaDenial {
  const used = kind === "gradings" ? status.gradingsUsed : status.interviewsUsed;
  const limit = kind === "gradings" ? status.gradingLimit : status.interviewLimit;
  const noun = kind === "gradings" ? "graded answers" : "mock interviews";

  // A free user at a zero limit has not "run out" — they never had any.
  const message =
    limit === 0
      ? `Mock interviews are part of CaseCode Pro.`
      : `You have used all ${limit} ${noun} for the year (${used} of ${limit}). ` +
        (status.isPro
          ? `Your allowance frees up as older attempts pass the ${QUOTA.windowDays}-day window.`
          : `Pro raises this to ${QUOTA.pro.gradings} graded answers and ${QUOTA.pro.interviews} interviews.`);

  return {
    error: message,
    quota: {
      used,
      limit,
      window_days: QUOTA.windowDays,
      upgrade: !status.isPro,
    },
  };
}
