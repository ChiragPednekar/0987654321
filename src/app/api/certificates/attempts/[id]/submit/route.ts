import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSubmission, type EvaluationResult } from "@/lib/ai/evaluate";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";
import { signalsSchema } from "@/lib/integrity-request";
import { recordActivityIntegrity } from "@/lib/proctoring";
import { activeLockout } from "@/lib/exam-lockouts";
import { certificateCode } from "@/lib/billing/purchases";
import { attemptPath, overallPercentage, SUBMIT_GRACE_SECONDS } from "@/lib/certificates";
import type { RubricRow } from "@/lib/types/database";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  answers: z.record(z.string().uuid(), z.string().max(MAX_ANSWER_CHARS)),
  signals: signalsSchema,
});

/**
 * Submits a certificate exam and grades it.
 *
 * Answers are stored before grading, so if the model is busy the student can
 * press submit again and the SAME stored answers are graded — the clock is not
 * re-run and nothing can be changed after the first submit.
 *
 * Proctoring is what makes a certificate worth anything, so it is enforced
 * here, not just on the page: a sitting ended by the proctor (leaving the
 * window, the camera) voids the attempt, and a submission without proof that
 * proctoring ran is refused.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: attempt } = await admin.from("cert_attempts").select("*").eq("id", id).maybeSingle();
  if (!attempt || attempt.user_id !== user.id) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "This attempt is not open." }, { status: 409 });
  }

  const { data: exam } = await admin.from("cert_exams").select("*").eq("id", attempt.exam_id).single();
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  // ---- proctoring ---------------------------------------------------------
  const lock = await activeLockout(admin, user.id, attemptPath(id));
  if (lock.state) {
    await admin
      .from("cert_attempts")
      .update({ status: "voided", void_reason: "The exam was ended by proctoring (the window was left, or the camera stopped)." })
      .eq("id", id);
    return NextResponse.json({ error: "This exam was ended by proctoring, so the attempt is void." }, { status: 403 });
  }

  const firstSubmit = !attempt.submitted_at;

  if (firstSubmit) {
    const { signals } = body;
    const cameraOk =
      signals.cameraUnavailable ||
      (signals.cameraRequested &&
        (signals.cameraDenied || signals.detectorFailed || (signals.cameraGranted && signals.cameraSamples > 0)));
    if (!signals.proctored || !cameraOk) {
      return NextResponse.json({ error: "Submission rejected: proof of proctoring is required." }, { status: 403 });
    }

    const late = attempt.deadline_at
      ? Date.now() - new Date(attempt.deadline_at).getTime() > SUBMIT_GRACE_SECONDS * 1000
      : false;
    if (late) {
      await admin
        .from("cert_attempts")
        .update({ status: "voided", void_reason: "The time ran out before the exam was submitted." })
        .eq("id", id);
      return NextResponse.json({ error: "The time ran out before this was submitted." }, { status: 409 });
    }

    // Claim the submission, then store the answers exactly as sent.
    const { data: claimed } = await admin
      .from("cert_attempts")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", id)
      .is("submitted_at", null)
      .select("id");
    if (!claimed?.length) return NextResponse.json({ error: "Already submitted." }, { status: 409 });

    const rows = exam.case_ids.map((caseId: string) => ({
      attempt_id: id,
      case_id: caseId,
      answer: (body.answers[caseId] ?? "").trim(),
    }));
    await admin.from("cert_answers").upsert(rows, { onConflict: "attempt_id,case_id" });

    await recordActivityIntegrity(admin, {
      userId: user.id,
      activity: "certification",
      activityRef: id,
      signals: body.signals,
      answerChars: rows.reduce((s: number, r: { answer: string }) => s + r.answer.length, 0),
      elapsedSeconds: attempt.started_at ? Math.round((Date.now() - new Date(attempt.started_at).getTime()) / 1000) : null,
      supersedePrevious: true,
    });
  }

  // ---- grading (first submit, or a retry after the model was busy) --------
  const [{ data: answers }, { data: cases }, { data: rubrics }] = await Promise.all([
    admin.from("cert_answers").select("*").eq("attempt_id", id),
    admin
      .from("cases")
      .select("id, slug, title, domain, difficulty, scenario, instructions, supporting_data, expected_framework, model_answer")
      .in("id", exam.case_ids),
    admin.from("rubrics").select("case_id, criteria, descriptors, max_score").in("case_id", exam.case_ids),
  ]);

  try {
    const graded = await Promise.all(
      (answers ?? []).map(async (a) => {
        if (a.total_score !== null && a.max_score !== null) {
          return { caseId: a.case_id, total: Number(a.total_score), max: Number(a.max_score) };
        }
        const kase = (cases ?? []).find((c) => c.id === a.case_id);
        const rubric = (rubrics ?? []).find((r) => r.case_id === a.case_id) as
          | Pick<RubricRow, "criteria" | "descriptors" | "max_score">
          | undefined;
        if (!kase || !rubric) throw new Error(`case ${a.case_id} missing`);

        // An answer too short to grade scores zero without a model call.
        if (a.answer.length < MIN_ANSWER_CHARS) {
          await admin
            .from("cert_answers")
            .update({ total_score: 0, max_score: rubric.max_score, percentage: 0, breakdown: {}, feedback: { verdict: "No answer was given for this case.", strengths: [], weaknesses: [], improvements: [] } })
            .eq("attempt_id", id)
            .eq("case_id", a.case_id);
          return { caseId: a.case_id, total: 0, max: Number(rubric.max_score) };
        }

        const result: EvaluationResult = await evaluateSubmission(kase, rubric, a.answer);
        await recordUsage(admin, {
          feature: "certification",
          userId: user.id,
          operation: "grading",
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cachedTokens: result.cachedTokens,
          totalTokens: result.tokensUsed,
        });
        await admin
          .from("cert_answers")
          .update({
            total_score: result.totalScore,
            max_score: result.maxScore,
            percentage: result.percentage,
            breakdown: result.breakdown,
            feedback: { ...result.feedback },
          })
          .eq("attempt_id", id)
          .eq("case_id", a.case_id);
        return { caseId: a.case_id, total: result.totalScore, max: result.maxScore };
      }),
    );

    const percentage = overallPercentage(graded);
    const passed = percentage >= exam.pass_pct;
    const now = new Date().toISOString();
    await admin
      .from("cert_attempts")
      .update({
        status: "graded",
        graded_at: now,
        total_score: graded.reduce((s, g) => s + g.total, 0),
        max_score: graded.reduce((s, g) => s + g.max, 0),
        percentage,
        passed,
        certificate_code: passed ? certificateCode() : null,
      })
      .eq("id", id)
      .eq("status", "in_progress");

    return NextResponse.json({ ok: true, percentage, passed });
  } catch (err) {
    console.error("[certificates] grading failed", err);
    const busy = err instanceof RateLimitError;
    return NextResponse.json(
      {
        error: busy
          ? "Your answers are saved. The grader is busy — press submit again in a minute to have them marked."
          : "Your answers are saved, but grading failed. Press submit again to retry — nothing can be changed now.",
        code: "grading_retry",
      },
      { status: busy ? 429 : 500 },
    );
  }
}
