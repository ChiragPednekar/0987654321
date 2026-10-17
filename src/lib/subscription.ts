import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { isPlanCode, PLANS, type PlanCode } from "@/lib/pricing";

type Admin = SupabaseClient<Database>;

/**
 * Individual subscriptions (migrations 069 and 071).
 *
 * A student whose college has not bought a campus licence can buy CaseCode Pro
 * themselves: a monthly plan, a placement season pass or a year
 * (src/lib/pricing.ts). Each purchase is a period — a row in
 * public.subscriptions with status 'active', a period_start and a
 * current_period_end. When the period ends, access ends: nothing has to run to
 * take it away, because has_pro() and can_solve() read the period directly.
 *
 * A period bought while another is running starts when that one ends, so the
 * plan in force is the live period that has already started.
 *
 * users.plan = 'pro' is NOT written by payments. It stays for Pro an admin
 * grants by hand with no end date; a payment used to set it and never unset
 * it, which sold Pro for ever.
 */

const DAY_MS = 86_400_000;

/** Renewal window for a period with no plan (an old row, or an admin grant). */
const DEFAULT_RENEWAL_WINDOW_DAYS = 30;

/**
 * When a new period ends. Renewing early adds to what is left rather than
 * throwing it away: a student who pays with 20 days to go gets the new period
 * plus those 20 days.
 */
export function nextPeriodEnd(currentEnd: string | Date | null, days: number, now = new Date()): Date {
  return new Date(nextPeriodStart(currentEnd, now).getTime() + days * DAY_MS);
}

/** When a new period starts: now, or when the running one ends. */
export function nextPeriodStart(currentEnd: string | Date | null, now = new Date()): Date {
  return currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
}

/** The plan a manual grant of this many days is closest to, for its allowance. */
export function planForDays(days: number): PlanCode {
  if (days <= 31) return "monthly";
  if (days <= 92) return "season";
  return "annual";
}

export interface ActiveSubscription {
  id: string;
  startsAt: string;
  endsAt: string;
  planCode: PlanCode;
  source: "razorpay" | "manual" | "demo";
}

function toSubscription(row: {
  id: string;
  current_period_end: string | null;
  period_start: string | null;
  plan_code: string | null;
  source: string;
}): ActiveSubscription | null {
  if (!row.current_period_end) return null;
  const planCode = isPlanCode(row.plan_code) ? row.plan_code : "annual";
  return {
    id: row.id,
    endsAt: row.current_period_end,
    startsAt: row.period_start ?? new Date(new Date(row.current_period_end).getTime() - PLANS[planCode].days * DAY_MS).toISOString(),
    planCode,
    source: (row.source as ActiveSubscription["source"]) ?? "razorpay",
  };
}

/** Every live period, including one queued to start when the current one ends. */
async function livePeriods(admin: Admin, userId: string): Promise<ActiveSubscription[]> {
  const { data } = await admin
    .from("subscriptions")
    .select("id, current_period_end, period_start, plan_code, source")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: true });
  return (data ?? []).map(toSubscription).filter((s): s is ActiveSubscription => s !== null);
}

/** The period in force now: live and already started. */
export async function activeSubscription(admin: Admin, userId: string): Promise<ActiveSubscription | null> {
  const now = Date.now();
  const started = (await livePeriods(admin, userId)).filter((s) => new Date(s.startsAt).getTime() <= now);
  return started.at(-1) ?? null;
}

export interface Access {
  /** Pro: the interviewer and the larger allowance. */
  pro: boolean;
  /** May practise at all. */
  canSolve: boolean;
  /** The live individual subscription, when that is where access comes from. */
  subscription: ActiveSubscription | null;
  /** A period already bought to start when the current one ends. */
  queued: ActiveSubscription | null;
}

/**
 * Everything a page needs to say where an account stands. Read from the same
 * database functions every gated route uses, so a page can never show "Pro"
 * while the route behind it says no.
 */
export async function getAccess(admin: Admin, userId: string): Promise<Access> {
  const [pro, solve, periods] = await Promise.all([
    admin.rpc("has_pro", { p_user: userId }),
    admin.rpc("can_solve", { p_user: userId }),
    livePeriods(admin, userId),
  ]);
  const now = Date.now();
  const started = periods.filter((s) => new Date(s.startsAt).getTime() <= now);
  const queued = periods.filter((s) => new Date(s.startsAt).getTime() > now);
  return {
    pro: !pro.error && pro.data === true,
    canSolve: !solve.error && solve.data === true,
    subscription: started.at(-1) ?? null,
    queued: queued.at(-1) ?? null,
  };
}

export function renewalWindowDays(sub: Pick<ActiveSubscription, "planCode"> | null): number {
  return sub ? PLANS[sub.planCode].renewalWindowDays : DEFAULT_RENEWAL_WINDOW_DAYS;
}

/** Whether a subscriber with this period may buy the next one yet. */
export function canRenew(sub: Pick<ActiveSubscription, "endsAt" | "planCode"> | null, now = new Date()): boolean {
  if (!sub) return true;
  return new Date(sub.endsAt).getTime() - now.getTime() <= renewalWindowDays(sub) * DAY_MS;
}

function longDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Why this account may not buy a plan right now, or null if it may.
 *
 * Pro from somewhere other than a subscription — a campus licence that grants
 * it, Pro granted by hand, an admin — needs no payment. A subscriber may buy
 * the next period in the last days of the current one (the window depends on
 * the plan), and the new period starts when the current one ends. One queued
 * period at a time.
 */
export function purchaseBlock(access: Access, now = new Date()): string | null {
  if (access.pro && !access.subscription) return "Your account already has CaseCode Pro.";
  if (access.queued) {
    return `Your next ${PLANS[access.queued.planCode].name} period is already lined up from ${longDay(access.queued.startsAt)}.`;
  }
  if (access.subscription && !canRenew(access.subscription, now)) {
    return `Your ${PLANS[access.subscription.planCode].name} plan runs until ${longDay(access.subscription.endsAt)}. You can renew in the last ${renewalWindowDays(access.subscription)} days.`;
  }
  return null;
}

/**
 * Opens a plan period once its payment is confirmed (src/lib/billing/purchases.ts).
 *
 * Idempotency lives one level up, on the purchase row: only the first caller
 * that moves a purchase to 'paid' gets here. The period starts when any live
 * period ends, so renewing early loses nothing.
 */
export async function activatePlanPeriod(
  admin: Admin,
  args: {
    userId: string;
    planCode: PlanCode;
    purchaseId: string | null;
    source: "razorpay" | "demo";
    paymentId: string | null;
  },
): Promise<{ id: string; startsAt: string; endsAt: string } | null> {
  const periods = await livePeriods(admin, args.userId);
  const latestEnd = periods.at(-1)?.endsAt ?? null;
  const start = nextPeriodStart(latestEnd);
  const end = new Date(start.getTime() + PLANS[args.planCode].days * DAY_MS);

  const { data, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: args.userId,
      plan: "pro",
      status: "active",
      source: args.source,
      plan_code: args.planCode,
      period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      purchase_id: args.purchaseId,
      razorpay_payment_id: args.paymentId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[subscription] could not open period", error?.message);
    return null;
  }
  return { id: data.id, startsAt: start.toISOString(), endsAt: end.toISOString() };
}
