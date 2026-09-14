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

/**
 * The activities that are proctored. Mirrors the `integrity_activity` enum.
 */
export type IntegrityActivity =
  | "case"
  | "contest"
  | "objective"
  | "daily_quiz"
  | "sql"
  | "excel"
  | "interview"
  | "negotiation"
  | "simulation"
  | "competition"
  | "group_discussion"
  | "sales";

/**
 * Stamps the server's clock for an activity that is not a case.
 *
 * Same contract as `solve_attempts`: the client keeps reporting elapsed time
 * because it drives its own timer, and that number decides nothing. Upsert
 * rather than insert so re-opening a page mid-attempt does not reset the clock
 * a student has already spent.
 */
export async function startActivityAttempt(
  admin: Admin,
  userId: string,
  activity: IntegrityActivity,
  activityRef: string,
): Promise<void> {
  const { error } = await admin
    .from("activity_attempts")
    .upsert(
      { user_id: userId, activity, activity_ref: activityRef },
      { onConflict: "user_id,activity,activity_ref", ignoreDuplicates: true },
    );
  if (error) {
    // Best effort, exactly as the case path is: a missing stamp makes
    // assessIntegrity skip the speed check, which is the lenient outcome.
    console.error("[integrity] could not stamp attempt", error.message);
  }
}

/** The activity counterpart of consumeAttemptElapsed. */
export async function consumeActivityElapsed(
  admin: Admin,
  userId: string,
  activity: IntegrityActivity,
  activityRef: string,
): Promise<number | null> {
  const { data } = await admin
    .from("activity_attempts")
    .select("started_at")
    .eq("user_id", userId)
    .eq("activity", activity)
    .eq("activity_ref", activityRef)
    .maybeSingle();

  await admin
    .from("activity_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("activity", activity)
    .eq("activity_ref", activityRef);

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

interface RecordActivityArgs {
  userId: string;
  activity: IntegrityActivity;
  /** The row a human can go and look at: a session, an attempt, an entry. */
  activityRef: string;
  signals: ProctorSignals;
  /**
   * How much the student actually produced. For prose this is the answer
   * length; for a quiz or a workbench there is no prose, and passing 0 is what
   * tells assessIntegrity not to run the checks that need it.
   */
  answerChars?: number;
  elapsedSeconds?: number | null;
  /**
   * Only ever supplied where a model read prose. There is nothing stylometric
   * in a formula or in option C, and inventing a number for those would be the
   * false-positive problem with none of the evidence.
   */
  aiLikelihood?: number | null;
  /**
   * For surfaces where the work is REPLACED rather than added to — a
   * competition entry is upserted, so resubmitting supersedes the previous
   * version.
   *
   * Without this, a team iterating three times would give whoever pressed
   * submit three separate strikes for one piece of behaviour, because signals
   * are cumulative across a page session and each submission carries the whole
   * sitting's counters. Earlier verdicts about the same subject are marked
   * superseded rather than deleted: the row stays readable, as 000035 intends,
   * but stops counting towards a suspension for work that no longer exists.
   */
  supersedePrevious?: boolean;
}

/**
 * The non-case counterpart of recordIntegrity.
 *
 * Deliberately the same function shape, writing to the same table and reading
 * the same strike count, because the consequence ladder has to be one ladder.
 * A student who switches tabs through an aptitude paper and again through a
 * SQL exercise has done the same thing twice, and the account should know it.
 */
export async function recordActivityIntegrity(
  admin: Admin,
  args: RecordActivityArgs,
): Promise<IntegrityOutcome> {
  const verdict = assessIntegrity({
    signals: args.signals,
    answerChars: args.answerChars ?? 0,
    elapsedSeconds: args.elapsedSeconds ?? null,
    aiLikelihood: args.aiLikelihood ?? null,
  });

  if (args.supersedePrevious) {
    await admin
      .from("submission_integrity")
      .update({
        cleared_at: new Date().toISOString(),
        cleared_note: "Superseded by a later version of the same work.",
      })
      .eq("user_id", args.userId)
      .eq("activity", args.activity)
      .eq("activity_ref", args.activityRef)
      .is("cleared_at", null);
  }

  const { error } = await admin.from("submission_integrity").insert({
    user_id: args.userId,
    activity: args.activity,
    activity_ref: args.activityRef,
    signals: { ...args.signals },
    flags: verdict.flags.map((f) => f.code),
    score: verdict.score,
    penalty_pct: verdict.penaltyPct,
    severity: verdict.severity,
    ai_likelihood: args.aiLikelihood ?? null,
    server_elapsed_seconds: args.elapsedSeconds ?? null,
  });

  if (error) {
    // Fails open, for the reason given on recordIntegrity: a verdict we could
    // not record establishes nothing, so it must cost nothing.
    console.error("[integrity] could not record activity", error.message);
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
          ? "This attempt was flagged for review. Work must be done in the page, without help from another tab."
          : null,
    };
  }

  const { data: strikeCount } = await admin.rpc("integrity_strikes", {
    p_user: args.userId,
  });
  const strikes = strikeCount ?? 1;
  const blocked = strikes >= STRIKES_BEFORE_BLOCK;

  if (blocked) {
    await admin
      .from("users")
      .update({
        deactivated_at: new Date().toISOString(),
        deactivated_reason: `Suspended automatically after ${strikes} flagged attempts.`,
      })
      .eq("id", args.userId)
      .is("deactivated_at", null);
  }

  void admin.from("notifications").insert({
    user_id: args.userId,
    type: "integrity_warning",
    title: blocked ? "Account suspended" : "Attempt flagged",
    body: strikeWarning(strikes) ?? "",
    href: "/settings/integrity",
  });

  return { verdict, strikes, blocked, warning: strikeWarning(strikes) };
}
