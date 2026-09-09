import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Admin = SupabaseClient<Database>;

/**
 * May this account practise, or only browse?
 *
 * The library is the shop window: anyone may read a case, follow a learning
 * path and look at the leaderboard, because that is what convinces a placement
 * cell to buy. Submitting an answer, running a drill, building a model or
 * talking to the interviewer are the licensed product.
 *
 * Entitlement lives in public.can_solve() (20250101000032) rather than here, so
 * one definition governs every route and there is no second copy to drift. It
 * covers three cases: an elevated role grant, a named individual, or membership
 * of an institution with a live licence.
 *
 * Called with the service-role client — can_solve() takes a user id as an
 * argument, so EXECUTE is deliberately withheld from anon and authenticated.
 */
export async function canSolve(admin: Admin, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("can_solve", { p_user: userId });

  if (error) {
    /**
     * Fails CLOSED, unlike the notification preference lookup.
     *
     * This is the paywall. If the check cannot be made, the safe answer is to
     * refuse rather than to hand out the licensed product to everyone the
     * moment the database hiccups — the opposite trade-off from a preference
     * read, where failing open costs somebody a notification.
     */
    console.error("[entitlement] can_solve failed", error.message);
    return false;
  }

  return data === true;
}

/** The 403 body every gated route returns, so the client can render one state. */
export const SOLVE_DENIAL = {
  error:
    "Solving is available to licensed accounts. Ask your college to activate CaseCode, or sign in with your college email address.",
  code: "not_entitled" as const,
};
