import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  assessIntegrity,
  STRIKES_BEFORE_BLOCK,
  strikeWarning,
  type IntegrityVerdict,
  type ProctorSignals,
} from "@/lib/integrity";

type Admin = SupabaseClient<Database>;

/**
 * Reads the server's own clock for this attempt and clears it.
 *
 * Returns null when no attempt was ever stamped — a draft restored from before
 * this feature shipped, or a page that never reached /api/attempts/start. Null
 * is carried all the way into `assessIntegrity`, which skips the speed check
 * rather than treating an unknown elapsed time as an instant one.
 */
export async function consumeAttemptElapsed(
  admin: Admin,
  userId: string,
  caseId: string,
): Promise<number | null> {
  const { data } = await admin
    .from("solve_attempts")
    .select("started_at")
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .maybeSingle();

  // Cleared whether or not it was found, so the next attempt starts a fresh
  // clock instead of inheriting this one's head start.
  await admin
    .from("solve_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("case_id", caseId);

  if (!data?.started_at) return null;

  const seconds = Math.round(
    (Date.now() - new Date(data.started_at).getTime()) / 1000,
  );
  return seconds >= 0 ? seconds : null;
}

export interface IntegrityOutcome {
  verdict: IntegrityVerdict;
  /** Uncleared severe findings on this account, including this one. */
  strikes: number;
  /** True when this submission closed the account. */
  blocked: boolean;
  /** What to show the student, or null when there is nothing to say. */
  warning: string | null;
}

interface RecordArgs {
  userId: string;
  caseId: string;
  submissionId: string;
  signals: ProctorSignals;
  answerChars: number;
  elapsedSeconds: number | null;
  aiLikelihood: number | null;
}

/**
 * Scores one submission for integrity, stores the evidence, and applies the
 * consequence ladder.
 *
 * The ladder is deliberately slow. A first severe finding costs marks and says
 * so; a second repeats it as a final warning; only a third closes the account,
 * and even then reversibly — `deactivated_at` is the same reversible switch an
 * admin already had, not a deletion, so the student's work survives an appeal.
 *
 * Closing an account is enforced through `users.deactivated_at` rather than any
 * new mechanism, because `can_solve()` already refuses a deactivated account
 * (20250101000032) and `quota_status()` already zeroes its allowance
 * (20250101000026). Adding a second gate would be one more place to forget.
 */
export async function recordIntegrity(
  admin: Admin,
  args: RecordArgs,
): Promise<IntegrityOutcome> {
  const verdict = assessIntegrity({
    signals: args.signals,
    answerChars: args.answerChars,
    elapsedSeconds: args.elapsedSeconds,
    aiLikelihood: args.aiLikelihood,
  });

  const { error } = await admin.from("submission_integrity").insert({
    submission_id: args.submissionId,
    user_id: args.userId,
    case_id: args.caseId,
    signals: { ...args.signals },
    flags: verdict.flags.map((f) => f.code),
    score: verdict.score,
    penalty_pct: verdict.penaltyPct,
    severity: verdict.severity,
    ai_likelihood: args.aiLikelihood,
    server_elapsed_seconds: args.elapsedSeconds,
  });

  if (error) {
    /**
     * Fails OPEN, unlike the entitlement check.
     *
     * If the evidence cannot be stored, the honest position is that nothing was
     * established, so no mark is reduced and no strike is counted. The opposite
     * — penalising on a verdict we failed to record — would leave a student
     * marked down with nothing to appeal against.
     */
    console.error("[integrity] could not record", error.message);
    return {
      verdict: { ...verdict, penaltyPct: 0, severity: "clean" },
      strikes: 0,
      blocked: false,
      warning: null,
    };
  }

  if (verdict.severity !== "severe") {
    return {
      verdict,
      strikes: 0,
      blocked: false,
      warning:
        verdict.severity === "suspect"
          ? "This submission was flagged for review and your mark was reduced. Answers must be written in the editor."
          : null,
    };
  }

  const { data: strikeCount } = await admin.rpc("integrity_strikes", {
    p_user: args.userId,
  });
  const strikes = strikeCount ?? 1;
  const blocked = strikes >= STRIKES_BEFORE_BLOCK;

  if (blocked) {
    // Only ever sets the switch — never clears it. Reinstating an account is a
    // human decision made in the admin console.
    await admin
      .from("users")
      .update({
        deactivated_at: new Date().toISOString(),
        deactivated_reason: `Suspended automatically after ${strikes} flagged submissions.`,
      })
      .eq("id", args.userId)
      .is("deactivated_at", null);
  }

  // Written with the service role so it cannot be forged or dismissed away,
  // and not awaited into the failure path: a notification that does not send
  // must never cost someone their grade.
  void admin.from("notifications").insert({
    user_id: args.userId,
    type: "integrity_warning",
    title: blocked ? "Account suspended" : "Submission flagged",
    body: strikeWarning(strikes) ?? "",
    href: "/settings/integrity",
  });

  return { verdict, strikes, blocked, warning: strikeWarning(strikes) };
}
