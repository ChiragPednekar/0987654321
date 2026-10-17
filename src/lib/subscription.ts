import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Admin = SupabaseClient<Database>;

/**
 * Individual subscriptions (migration 20250101000069).
 *
 * A student whose college has not bought a campus licence can subscribe to
 * CaseCode Pro themselves. A subscription is a period: a row in
 * public.subscriptions with status 'active' and a current_period_end in the
 * future. When the period ends, access ends — nothing has to run to take it
 * away, because public.has_pro() and public.can_solve() read the period
 * directly.
 *
 * users.plan = 'pro' is NOT written by payments any more. It stays for Pro an
 * admin grants by hand with no end date; a payment used to set it and never
 * unset it, which sold Pro for ever.
 */

/** One paid period. */
export const SUBSCRIPTION_DAYS = 365;
/** A subscriber may renew once their period has this many days or fewer left. */
export const RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * When a new period ends. Renewing early adds to what is left rather than
 * throwing it away: a student who pays with 20 days to go gets 365 + 20.
 */
export function nextPeriodEnd(currentEnd: string | Date | null, days = SUBSCRIPTION_DAYS, now = new Date()): Date {
  const from = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
  return new Date(from.getTime() + days * DAY_MS);
}

/** Whether a subscriber with this period end may buy the next one yet. */
export function canRenew(endsAt: string | Date | null, now = new Date()): boolean {
  if (!endsAt) return true;
  return new Date(endsAt).getTime() - now.getTime() <= RENEWAL_WINDOW_DAYS * DAY_MS;
}

export interface ActiveSubscription {
  id: string;
  endsAt: string;
  source: "razorpay" | "manual";
}

/** The live subscription period that ends last, if any. */
export async function activeSubscription(admin: Admin, userId: string): Promise<ActiveSubscription | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("id, current_period_end, source")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.current_period_end) return null;
  return {
    id: data.id,
    endsAt: data.current_period_end,
    source: (data.source as ActiveSubscription["source"]) ?? "razorpay",
  };
}

export interface Access {
  /** Pro: the interviewer and the larger allowance. */
  pro: boolean;
  /** May practise at all. */
  canSolve: boolean;
  /** The live individual subscription, when that is where access comes from. */
  subscription: ActiveSubscription | null;
}

/**
 * Everything a page needs to say where an account stands. Read from the same
 * database functions every gated route uses, so a page can never show "Pro"
 * while the route behind it says no.
 */
export async function getAccess(admin: Admin, userId: string): Promise<Access> {
  const [pro, solve, subscription] = await Promise.all([
    admin.rpc("has_pro", { p_user: userId }),
    admin.rpc("can_solve", { p_user: userId }),
    activeSubscription(admin, userId),
  ]);
  return {
    pro: !pro.error && pro.data === true,
    canSolve: !solve.error && solve.data === true,
    subscription,
  };
}

/**
 * Turns a checkout row into a live period once its payment is verified.
 *
 * Called by /api/billing/verify (the browser's handshake) and by the webhook
 * (the backstop) — usually both, for the same payment. Only the first call
 * that finds the row not yet active wins: the update is conditional on the
 * status, so a payment can never be credited twice. The period starts from the
 * end of any other live period, so renewing early loses nothing.
 */
export async function activatePaidPeriod(
  admin: Admin,
  { subscriptionId, userId, paymentId }: { subscriptionId: string; userId: string; paymentId: string | null },
): Promise<{ activated: boolean; endsAt: string | null }> {
  const current = await activeSubscription(admin, userId);
  const endsAt = nextPeriodEnd(current && current.id !== subscriptionId ? current.endsAt : null).toISOString();

  const { data } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      razorpay_payment_id: paymentId,
      current_period_end: endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)
    .neq("status", "active")
    .select("id");

  if ((data ?? []).length > 0) return { activated: true, endsAt };

  // Already activated by the other caller: report the period it stored.
  const { data: row } = await admin
    .from("subscriptions")
    .select("current_period_end")
    .eq("id", subscriptionId)
    .maybeSingle();
  return { activated: false, endsAt: row?.current_period_end ?? null };
}
