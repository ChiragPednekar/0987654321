import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSubmission } from "@/lib/ai/evaluate";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS, RATE_LIMIT } from "@/lib/constants";
import { getQuotaStatus, quotaDenial } from "@/lib/quota";
import { recordUsage } from "@/lib/usage";
import type { RubricRow } from "@/lib/types/database";
import { wantsAssignmentNotices } from "@/lib/notify";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { consumeAttemptElapsed, recordIntegrity } from "@/lib/proctoring";
import { EMPTY_SIGNALS } from "@/lib/integrity";

// Model evaluation regularly takes 15-40s; the default function timeout is not
// enough. (Vercel: requires Pro for >60s.)
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  contest_id: z.string().uuid().optional().nullable(),
  answer: z.string().min(MIN_ANSWER_CHARS).max(MAX_ANSWER_CHARS),
  // Present when the sectioned editor was used; {} for free text. Kept
  // alongside `answer` rather than instead of it, so grading is unchanged.
  answer_sections: z
    .object({
      framework: z.string().max(MAX_ANSWER_CHARS).optional(),
      analysis: z.string().max(MAX_ANSWER_CHARS).optional(),
      recommendation: z.string().max(MAX_ANSWER_CHARS).optional(),
    })
    .default({}),
  time_spent_seconds: z.number().int().min(0).max(86_400).default(0),
  /**
   * How the answer was written, from the editor. Untrusted by construction —
   * it crosses the network from a page the student controls — so every field
   * is bounded here and the verdict built from it in src/lib/integrity.ts is
   * treated as corroboration, never proof. Defaulted rather than required, so
   * an older client or a restored draft still submits and is simply not
   * assessed on behaviour.
   */
  signals: z
    .object({
      keystrokes: z.number().int().min(0).max(1_000_000).default(0),
      pasteCount: z.number().int().min(0).max(10_000).default(0),
      pastedChars: z.number().int().min(0).max(1_000_000).default(0),
      largestPaste: z.number().int().min(0).max(1_000_000).default(0),
      blurCount: z.number().int().min(0).max(10_000).default(0),
      blurMs: z.number().int().min(0).max(86_400_000).default(0),
      fullscreenExits: z.number().int().min(0).max(10_000).default(0),
      proctored: z.boolean().default(false),
    })
    .default(EMPTY_SIGNALS),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // ---- rate limit ---------------------------------------------------------
  // Counted in the database rather than in memory, so it holds across the many
  // serverless instances this route runs on.
  const since = new Date(Date.now() - RATE_LIMIT.windowMs).toISOString();
  const { count: recentCount } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= RATE_LIMIT.maxEvaluations) {
    return NextResponse.json(
      { error: "Too many submissions. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();

  // Licensing gate. Browsing a case is open to anyone; practising against it is
  // the product being sold. Checked server-side because the client gate is a
  // courtesy, not a control — see src/lib/entitlement.ts.
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  // ---- annual fair-use quota ----------------------------------------------
  // RATE_LIMIT above stops a burst; this bounds the year. Without it a single
  // account can run up unbounded model spend behind a fixed-price licence.
  const quota = await getQuotaStatus(admin, user.id);
  if (quota.gradingsLeft <= 0) {
    return NextResponse.json(quotaDenial("gradings", quota), { status: 402 });
  }

  // ---- load the case and its rubric ---------------------------------------

  const { data: caseData, error: caseError } = await admin
    .from("cases")
    .select(
      "id, slug, title, domain, difficulty, scenario, instructions, supporting_data, expected_framework, model_answer, is_published",
    )
    .eq("id", body.case_id)
    .maybeSingle();

  if (caseError || !caseData || !caseData.is_published) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const { data: rubric } = await admin
    .from("rubrics")
    .select("criteria, descriptors, max_score")
    .eq("case_id", body.case_id)
    .maybeSingle<Pick<RubricRow, "criteria" | "descriptors" | "max_score">>();

  if (!rubric) {
    return NextResponse.json(
      { error: "This case has no rubric and cannot be graded yet." },
      { status: 409 },
    );
  }

  // ---- contest window check ------------------------------------------------
  if (body.contest_id) {
    const { data: contest } = await admin
      .from("contests")
      .select("id, starts_at, ends_at, case_id")
      .eq("id", body.contest_id)
      .maybeSingle();

    const now = Date.now();
    const open =
      contest &&
      contest.case_id === body.case_id &&
      now >= new Date(contest.starts_at).getTime() &&
      now <= new Date(contest.ends_at).getTime();

    if (!open) {
      return NextResponse.json(
        { error: "This contest is not accepting submissions." },
        { status: 409 },
      );
    }

    // An entry must already exist, otherwise there is no server-stamped start
    // time to score the speed bonus against.
    const { data: entry } = await admin
      .from("contest_submissions")
      .select("submitted_at")
      .eq("contest_id", body.contest_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json(
        { error: "Start the contest timer before submitting." },
        { status: 409 },
      );
    }

    if (entry.submitted_at) {
      return NextResponse.json(
        { error: "You have already submitted an entry for this contest." },
        { status: 409 },
      );
    }
  }

  /**
   * ---- identical resubmission ---------------------------------------------
   *
   * Grading the same text twice produces the same grade and bills twice for
   * it. The common cause is not gaming — it is a double-click, or a student
   * hitting submit again because the first attempt seemed slow, which is
   * exactly when a 20-second model call is most likely to be interrupted.
   *
   * Bounded to a short window and to the same case and user, so a genuine
   * second attempt weeks later is still graded fresh. Contest entries are
   * excluded: they have their own one-entry rule above, and a contest score
   * should never be inherited from an earlier practice run.
   */
  if (!body.contest_id) {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: recent } = await admin
      .from("submissions")
      .select("id, answer, scores(total_score, max_score, percentage, breakdown, feedback)")
      .eq("user_id", user.id)
      .eq("case_id", body.case_id)
      .eq("status", "evaluated")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.answer === body.answer) {
      const score = Array.isArray(recent.scores) ? recent.scores[0] : recent.scores;
      if (score) {
        return NextResponse.json({
          submission_id: recent.id,
          total_score: score.total_score,
          max_score: score.max_score,
          percentage: score.percentage,
          breakdown: score.breakdown,
          feedback: score.feedback,
          hint_penalty_pct: 0,
          reused: true,
        });
      }
    }
  }

  // ---- record the attempt --------------------------------------------------
  // Inserted through the user's own client so RLS confirms they may write it.
  const { data: submission, error: insertError } = await supabase
    .from("submissions")
    .insert({
      user_id: user.id,
      case_id: body.case_id,
      contest_id: body.contest_id ?? null,
      answer: body.answer,
      answer_sections: body.answer_sections,
      status: "evaluating",
      time_spent_seconds: body.time_spent_seconds,
    })
    .select("id, attempt_number")
    .single();

  if (insertError || !submission) {
    return NextResponse.json(
      { error: "Could not save your submission." },
      { status: 500 },
    );
  }

  // ---- evaluate ------------------------------------------------------------
  try {
    const result = await evaluateSubmission(caseData, rubric, body.answer);

    // Apply the hint penalty. Read from hint_reveals rather than trusting the
    // client, and clamp the total deduction so a stack of hints can never push
    // a score below zero.
    const { data: reveals } = await admin
      .from("hint_reveals")
      .select("hint_id, case_hints(penalty_pct)")
      .eq("user_id", user.id)
      .eq("case_id", body.case_id);

    const penaltyPct = Math.min(
      50,
      (reveals ?? []).reduce((sum, row) => {
        const hint = Array.isArray(row.case_hints)
          ? row.case_hints[0]
          : row.case_hints;
        return sum + (hint?.penalty_pct ?? 0);
      }, 0),
    );

    /**
     * ---- integrity ---------------------------------------------------------
     *
     * Assessed after grading, never before: the rubric marks must be decided on
     * the answer's merits alone, so that a student who is wrongly flagged still
     * has a correct underlying score to appeal back to.
     *
     * `elapsedSeconds` comes from the server's own stamp rather than from
     * `body.time_spent_seconds`, which the client supplies and a cheat would
     * set first. Null when no attempt was stamped, and carried through as null
     * so the speed check is skipped rather than assumed.
     */
    const elapsedSeconds = await consumeAttemptElapsed(
      admin,
      user.id,
      body.case_id,
    );

    const integrity = await recordIntegrity(admin, {
      userId: user.id,
      caseId: body.case_id,
      submissionId: submission.id,
      signals: body.signals,
      answerChars: body.answer.length,
      elapsedSeconds,
      aiLikelihood: result.aiLikelihood,
    });

    // Applied in sequence rather than summed, so neither deduction can ever
    // drive the total negative and each stays independently explainable: this
    // is what hints cost you, and this is what the flag cost you.
    const afterHints =
      penaltyPct > 0
        ? Math.round(result.totalScore * (1 - penaltyPct / 100))
        : result.totalScore;

    const totalScore = Math.max(
      0,
      integrity.verdict.penaltyPct > 0
        ? Math.round(afterHints * (1 - integrity.verdict.penaltyPct / 100))
        : afterHints,
    );

    // Scores are written with the service role: there is deliberately no RLS
    // policy that would let a user insert their own score.
    // Per-operation AI accounting for the owner's cost view. Fire-and-forget
    // by design — a metrics row must never fail a graded submission.
    void recordUsage(admin, {
      userId: user.id,
      operation: "grading",
      model: result.model,
      // Real numbers from the provider. These were zeros, which sent every
      // grading down the 80/20 estimate path — so the admin dashboard has been
      // calling an assumption "measured".
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      totalTokens: result.tokensUsed,
    });

    const { error: scoreError } = await admin.from("scores").insert({
      submission_id: submission.id,
      user_id: user.id,
      case_id: body.case_id,
      breakdown: result.breakdown,
      total_score: totalScore,
      max_score: result.maxScore,
      feedback: {
        ...result.feedback,
        hint_penalty_pct: penaltyPct,
        // Embedded alongside the hint penalty it sits next to, so the score
        // panel can explain the deduction without a second round trip. The
        // full evidence lives in submission_integrity, which the student may
        // also read for their own work.
        integrity: {
          severity: integrity.verdict.severity,
          penalty_pct: integrity.verdict.penaltyPct,
          flags: integrity.verdict.flags
            .filter((f) => f.points > 0 || !f.behavioural)
            .map((f) => f.label),
        },
      },
      model: result.model,
      tokens_used: result.tokensUsed,
    });

    if (scoreError) throw new Error(scoreError.message);

    await admin
      .from("submissions")
      .update({ status: "evaluated" })
      .eq("id", submission.id);

    // Notify. Written with the service role so a user cannot forge one, and
    // deliberately not awaited into the failure path: a notification that does
    // not send must never cost someone their grade.
    const pct =
      result.maxScore > 0 ? Math.round((totalScore / result.maxScore) * 100) : 0;
    void wantsAssignmentNotices(admin, user.id).then((wanted) => {
      if (!wanted) return;
      return admin
      .from("notifications")
      .insert({
        user_id: user.id,
        type: "grade_ready",
        title: `Graded — ${totalScore}/${result.maxScore} (${pct}%)`,
        body: caseData.title,
        href: `/cases/${caseData.slug}?submission=${submission.id}#review`,
      })
      .then(({ error }) => {
        if (error) console.error("notification insert failed", error.message);
      });
    });

    /**
     * Put the new score on the leaderboard now.
     *
     * The boards are materialised into `leaderboards` by refresh_leaderboards()
     * on a nightly cron, so until it ran, a student who had just been graded
     * saw their points on the dashboard (computed live) and zero on the
     * leaderboard (read from the table). Tested end to end: solving a case
     * scored 63/80, the dashboard said 63 points, and the leaderboard listed
     * the same account at 0 with no indication anything was pending.
     *
     * That gap is not bounded by the cron interval either — the schedule lives
     * in a GitHub workflow that fails closed without CRON_SECRET, so on a
     * deployment where that secret is missing the boards never update at all.
     * A leaderboard that silently stops counting is worse than a slow one, and
     * the product should not depend on a secret being present to be correct.
     *
     * Fire-and-forget, like the notification above: a board rebuild must never
     * cost someone their grade. The cron stays as the backstop that catches
     * decay from deletions and expiring weekly windows.
     *
     * Note for later: this rebuilds all three boards per graded submission,
     * which is nothing at today's volume and will not stay that way. When
     * grading traffic makes it hurt, move to an incremental update of the
     * single affected row rather than putting the delay back.
     */
    void admin.rpc("refresh_leaderboards").then(({ error }) => {
      if (error) console.error("leaderboard refresh failed", error.message);
    });

    // Link the contest entry, if this was a contest run.
    if (body.contest_id) {
      // The speed bonus is money, so the elapsed time must not come from the
      // client — `time_spent_seconds` is a self-reported number and a
      // contestant could send 0 to claim the maximum bonus. Derive it from the
      // server-stamped `started_at` instead.
      const { data: entry } = await admin
        .from("contest_submissions")
        .select("started_at")
        .eq("contest_id", body.contest_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (entry) {
        const submittedAt = new Date();
        const durationSeconds = Math.max(
          0,
          Math.round(
            (submittedAt.getTime() - new Date(entry.started_at).getTime()) / 1000,
          ),
        );

        await admin
          .from("contest_submissions")
          .update({
            submission_id: submission.id,
            submitted_at: submittedAt.toISOString(),
            duration_seconds: durationSeconds,
          })
          .eq("contest_id", body.contest_id)
          .eq("user_id", user.id);
      }
    }

    return NextResponse.json({
      submission_id: submission.id,
      total_score: totalScore,
      max_score: result.maxScore,
      percentage: pct,
      hint_penalty_pct: penaltyPct,
      breakdown: result.breakdown,
      feedback: result.feedback,
      integrity: {
        severity: integrity.verdict.severity,
        penalty_pct: integrity.verdict.penaltyPct,
        flags: integrity.verdict.flags.map((f) => f.label),
        warning: integrity.warning,
        blocked: integrity.blocked,
      },
    });
  } catch (error) {
    // Mark the attempt failed rather than leaving it stuck on "evaluating".
    await admin
      .from("submissions")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      })
      .eq("id", submission.id);

    console.error("[evaluate] failed", error);

    return NextResponse.json(
      {
        error:
          "Evaluation failed. Your answer is saved — retry from your attempts list.",
        submission_id: submission.id,
      },
      { status: 502 },
    );
  }
}
