import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { QUOTA } from "@/lib/constants";
import { isPlanCode, PLANS, USAGE_WINDOW, type PlanCode } from "@/lib/pricing";
import type { Database } from "@/lib/types/database";

/**
 * How much AI an account may use right now.
 *
 * Three limits, checked together:
 *
 *   1. The ALLOWANCE. For an individual subscriber, the plan's allowance for
 *      the current period (src/lib/pricing.ts). For a campus licence or a
 *      hand-granted Pro, the annual fair-use quota (QUOTA, with any per-licence
 *      override) over a rolling 365 days, as before.
 *   2. The 5-HOUR WINDOW, like Claude's: a window opens with the first use and
 *      resets five hours later. It stops one sitting from spending a month's
 *      allowance in an afternoon.
 *   3. TOP-UP CREDITS, bought in packs. When the allowance or the window is
 *      used up, a credit pays for the use instead, so a student can keep going
 *      past both.
 *
 * Lives here rather than inline in each route so grading and interviews cannot
 * drift into disagreeing about what a user is allowed. The arithmetic is the
 * pure buildQuotaStatus(), tested without a database.
 */

export type QuotaKind = "gradings" | "interviews";

export interface UsageWindow {
  hours: number;
  gradingLimit: number;
  interviewLimit: number;
  gradingsUsed: number;
  interviewsUsed: number;
  /** When the open window resets; null when no window is open. */
  resetsAt: string | null;
}

export interface QuotaStatus {
  isPro: boolean;
  /** The allowance for the period (or the rolling year). */
  gradingLimit: number;
  interviewLimit: number;
  gradingsUsed: number;
  interviewsUsed: number;
  /** Everything usable right now: plan (period AND window) plus top-ups. */
  gradingsLeft: number;
  interviewsLeft: number;
  /** True when the allowance comes from a campus licence rather than a retail plan. */
  viaInstitution: boolean;
  /** The individual plan this allowance belongs to, if any. */
  plan: PlanCode | null;
  /** When the period's allowance renews (the plan's end); null for a rolling year. */
  periodEndsAt: string | null;
  window: UsageWindow;
  topups: { gradings: number; interviews: number };
  /** What the plan alone would still allow now, before top-ups. */
  planLeft: { gradings: number; interviews: number };
  /** Admins and complimentary accounts (074) are not metered at all. */
  exempt: boolean;
}

type Admin = SupabaseClient<Database>;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

interface UsageMoment {
  kind: QuotaKind;
  at: string;
}

export interface QuotaFacts {
  /** The quota_status() row: Pro, the campus/default allowance, rolling-year use. */
  row: {
    is_pro?: boolean | null;
    grading_limit?: number | null;
    interview_limit?: number | null;
    gradings_used?: number | string | null;
    interviews_used?: number | string | null;
  } | null;
  viaInstitution: boolean;
  /** The live, started individual period. */
  subscription: { planCode: PlanCode; startsAt: string; endsAt: string } | null;
  /** AI uses since at least the period start (subscriber) or the last 24 hours. */
  uses: UsageMoment[];
  /** Top-up credits spent, over at least the same range and the rolling year. */
  debits: UsageMoment[];
  /** Unspent credits on unexpired packs. */
  credits: { gradings: number; interviews: number };
  exempt: boolean;
}

/**
 * The open 5-hour window, from the times of recent uses: a window starts at a
 * use made after the previous window closed, and lasts `hours`.
 */
export function openWindow(times: string[], now: Date, hours = USAGE_WINDOW.hours): { start: Date; resetsAt: Date } | null {
  const sorted = times.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  let start: number | null = null;
  for (const t of sorted) {
    if (t > now.getTime()) break;
    if (start === null || t >= start + hours * HOUR_MS) start = t;
  }
  if (start === null || now.getTime() >= start + hours * HOUR_MS) return null;
  return { start: new Date(start), resetsAt: new Date(start + hours * HOUR_MS) };
}

function countSince(moments: UsageMoment[], kind: QuotaKind, since: Date | null): number {
  return moments.filter((m) => m.kind === kind && (since === null || new Date(m.at) >= since)).length;
}

export function buildQuotaStatus(facts: QuotaFacts, now = new Date()): QuotaStatus {
  const { row, subscription } = facts;
  const isPro = Boolean(row?.is_pro);

  /**
   * A limit of zero from the database is a refusal, not a missing value.
   *
   * quota_status() returns 0/0 for a deactivated account (20250101000026). A
   * tier fallback used to overwrite that — a deactivated user is not Pro, so
   * the free-tier constant applied and they kept 60 graded answers a year.
   * Only an explicit 0/0 is treated this way; null still means "use the
   * tier default".
   */
  const blocked = row?.grading_limit === 0 && row?.interview_limit === 0;

  // ---- 1. the allowance ---------------------------------------------------
  let gradingLimit: number;
  let interviewLimit: number;
  let gradingsUsed: number;
  let interviewsUsed: number;
  let periodEndsAt: string | null = null;

  if (subscription) {
    const plan = PLANS[subscription.planCode];
    const since = new Date(subscription.startsAt);
    gradingLimit = plan.gradings;
    interviewLimit = plan.interviews;
    // A use a top-up paid for is not the plan's.
    gradingsUsed = Math.max(0, countSince(facts.uses, "gradings", since) - countSince(facts.debits, "gradings", since));
    interviewsUsed = Math.max(0, countSince(facts.uses, "interviews", since) - countSince(facts.debits, "interviews", since));
    periodEndsAt = subscription.endsAt;
  } else {
    const yearAgo = new Date(now.getTime() - QUOTA.windowDays * DAY_MS);
    gradingLimit = isPro ? (row?.grading_limit ?? QUOTA.pro.gradings) : QUOTA.free.gradings;
    interviewLimit = isPro ? (row?.interview_limit ?? QUOTA.pro.interviews) : QUOTA.free.interviews;
    gradingsUsed = Math.max(0, Number(row?.gradings_used ?? 0) - countSince(facts.debits, "gradings", yearAgo));
    interviewsUsed = Math.max(0, Number(row?.interviews_used ?? 0) - countSince(facts.debits, "interviews", yearAgo));
  }

  if (blocked) {
    gradingLimit = 0;
    interviewLimit = 0;
  }

  // ---- 2. the 5-hour window -----------------------------------------------
  const open = openWindow(facts.uses.map((u) => u.at), now);
  const windowSince = open?.start ?? null;
  const window: UsageWindow = {
    hours: USAGE_WINDOW.hours,
    gradingLimit: USAGE_WINDOW.gradings,
    interviewLimit: USAGE_WINDOW.interviews,
    gradingsUsed: open
      ? Math.max(0, countSince(facts.uses, "gradings", windowSince) - countSince(facts.debits, "gradings", windowSince))
      : 0,
    interviewsUsed: open
      ? Math.max(0, countSince(facts.uses, "interviews", windowSince) - countSince(facts.debits, "interviews", windowSince))
      : 0,
    resetsAt: open ? open.resetsAt.toISOString() : null,
  };

  // ---- 3. what is usable now ----------------------------------------------
  const periodLeft = facts.exempt
    ? { gradings: Infinity, interviews: Infinity }
    : {
        gradings: Math.max(0, gradingLimit - gradingsUsed),
        interviews: Math.max(0, interviewLimit - interviewsUsed),
      };
  const windowLeft = facts.exempt
    ? { gradings: Infinity, interviews: Infinity }
    : {
        gradings: Math.max(0, window.gradingLimit - window.gradingsUsed),
        interviews: Math.max(0, window.interviewLimit - window.interviewsUsed),
      };
  const planLeft = {
    gradings: blocked ? 0 : Math.min(periodLeft.gradings, windowLeft.gradings),
    interviews: blocked ? 0 : Math.min(periodLeft.interviews, windowLeft.interviews),
  };
  const topups = blocked ? { gradings: 0, interviews: 0 } : facts.credits;

  return {
    isPro,
    gradingLimit,
    interviewLimit,
    gradingsUsed,
    interviewsUsed,
    gradingsLeft: planLeft.gradings + topups.gradings,
    interviewsLeft: planLeft.interviews + topups.interviews,
    viaInstitution: facts.viaInstitution,
    plan: subscription?.planCode ?? null,
    periodEndsAt,
    window,
    topups,
    planLeft,
    exempt: facts.exempt,
  };
}

export async function getQuotaStatus(admin: Admin, userId: string): Promise<QuotaStatus> {
  const now = new Date();
  const nowIso = now.toISOString();

  const [quotaRow, seats, subRows, profile, creditRows, comp] = await Promise.all([
    admin.rpc("quota_status", {
      p_user: userId,
      p_window_days: QUOTA.windowDays,
      // Defaults are passed in rather than duplicated in SQL: constants.ts holds
      // the cost arithmetic, and two copies of that number would drift.
      p_default_gradings: QUOTA.pro.gradings,
      p_default_interviews: QUOTA.pro.interviews,
    }),
    admin
      .from("institution_members")
      .select("institution_id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("subscriptions")
      .select("plan_code, period_start, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("current_period_end", nowIso)
      .order("current_period_end", { ascending: false }),
    admin.from("users").select("role").eq("id", userId).maybeSingle(),
    admin
      .from("usage_credits")
      .select("kind, amount, used")
      .eq("user_id", userId)
      .gt("expires_at", nowIso),
    admin.rpc("is_complimentary", { p_user: userId }),
  ]);

  const row = Array.isArray(quotaRow.data) ? quotaRow.data[0] : quotaRow.data;

  // The live period that has started; a renewal queued behind it does not
  // count yet.
  const live = (subRows.data ?? []).find(
    (s) => s.current_period_end && (!s.period_start || new Date(s.period_start) <= now),
  );
  const subscription = live?.current_period_end
    ? {
        planCode: isPlanCode(live.plan_code) ? live.plan_code : ("annual" as PlanCode),
        startsAt:
          live.period_start ??
          new Date(new Date(live.current_period_end).getTime() - PLANS.annual.days * DAY_MS).toISOString(),
        endsAt: live.current_period_end,
      }
    : null;

  const since = new Date(
    Math.min(now.getTime() - DAY_MS, subscription ? new Date(subscription.startsAt).getTime() : Infinity),
  ).toISOString();
  const debitSince = new Date(Math.min(new Date(since).getTime(), now.getTime() - QUOTA.windowDays * DAY_MS)).toISOString();

  const [uses, debits] = await Promise.all([
    admin.rpc("ai_usage_since", { p_user: userId, p_since: since }),
    admin
      .from("usage_credit_debits")
      .select("kind, created_at")
      .eq("user_id", userId)
      .gte("created_at", debitSince),
  ]);

  const credits = { gradings: 0, interviews: 0 };
  for (const c of creditRows.data ?? []) {
    credits[c.kind as QuotaKind] += Math.max(0, c.amount - c.used);
  }

  return buildQuotaStatus(
    {
      row: row ?? null,
      viaInstitution: (seats.count ?? 0) > 0,
      subscription,
      uses: ((uses.data ?? []) as UsageMoment[]).map((u) => ({ kind: u.kind, at: u.at })),
      debits: (debits.data ?? []).map((d) => ({ kind: d.kind as QuotaKind, at: d.created_at })),
      credits,
      exempt: profile.data?.role === "admin" || comp.data === true,
    },
    now,
  );
}

/**
 * Pays for one use that is about to happen. Call it after every other check
 * has passed and right before the model call (or the session it opens).
 *
 * When the plan still covers the use, nothing is recorded: the use itself is
 * what counts against the allowance. When it does not, one top-up credit is
 * spent, atomically — false means there was none to spend (another tab got
 * the last one), and the route must refuse.
 */
export async function chargeQuota(
  admin: Admin,
  userId: string,
  kind: QuotaKind,
  status: QuotaStatus,
): Promise<boolean> {
  if (status.exempt || status.planLeft[kind] > 0) return true;
  const { data, error } = await admin.rpc("consume_usage_credit", { p_user: userId, p_kind: kind });
  return !error && data === true;
}

export interface QuotaDenial {
  error: string;
  quota: {
    used: number;
    limit: number;
    window_days: number;
    upgrade: boolean;
    /** Set when the 5-hour window is what ran out. */
    window_resets_at: string | null;
    /** Whether buying a top-up would let this account continue. */
    topup: boolean;
  };
}

function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

/**
 * The 402 body for an exhausted allowance.
 *
 * Deliberately states the actual numbers and what to do next. "You have used
 * 8 of 8 graded answers in this 5-hour window; it resets at 6:40 pm" is
 * something a student can act on; a bare "limit reached" generates a support
 * ticket.
 */
export function quotaDenial(kind: QuotaKind, status: QuotaStatus): QuotaDenial {
  const used = kind === "gradings" ? status.gradingsUsed : status.interviewsUsed;
  const limit = kind === "gradings" ? status.gradingLimit : status.interviewLimit;
  const noun = kind === "gradings" ? "graded answers" : "mock interviews";

  /**
   * A grading limit of zero cannot be a tier: every account gets graded
   * answers. It only happens when the account has been closed, and telling
   * someone in that position to buy Pro is both wrong and useless.
   */
  const closed = kind === "gradings" && limit === 0;

  const windowUsed = kind === "gradings" ? status.window.gradingsUsed : status.window.interviewsUsed;
  const windowLimit = kind === "gradings" ? status.window.gradingLimit : status.window.interviewLimit;
  const windowHit = !status.exempt && limit > used && windowUsed >= windowLimit && status.window.resetsAt;

  const topupHint = " Or buy a top-up pack to keep going now.";

  let message: string;
  if (closed) {
    message = "This account is not currently able to submit answers. If you think that is a mistake, contact your administrator.";
  } else if (limit === 0) {
    message = "Mock interviews are part of CaseCode Pro.";
  } else if (windowHit) {
    message =
      `You have used ${windowLimit} of ${windowLimit} ${noun} in this ${status.window.hours}-hour window. ` +
      `It resets at ${timeOfDay(status.window.resetsAt as string)}.` +
      topupHint;
  } else if (status.plan) {
    message =
      `You have used all ${limit} ${noun} in your ${PLANS[status.plan].name} plan (${used} of ${limit}). ` +
      `It renews with your next period.` +
      topupHint;
  } else {
    message =
      `You have used all ${limit} ${noun} for the year (${used} of ${limit}). ` +
      (status.viaInstitution
        ? "Your college sets this allowance — ask your placement cell to raise it, or buy a top-up pack to keep going now."
        : status.isPro
          ? `Your allowance frees up as older attempts pass the ${QUOTA.windowDays}-day window.${topupHint}`
          : "Upgrade to CaseCode Pro for a larger allowance.");
  }

  return {
    error: message,
    quota: {
      used,
      limit,
      window_days: QUOTA.windowDays,
      // Nothing to upgrade to when the account itself is closed.
      upgrade: !closed && !status.isPro,
      window_resets_at: windowHit ? status.window.resetsAt : null,
      topup: !closed && limit > 0,
    },
  };
}
