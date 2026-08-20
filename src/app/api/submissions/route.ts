import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSubmission } from "@/lib/ai/evaluate";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS, RATE_LIMIT } from "@/lib/constants";
import type { RubricRow } from "@/lib/types/database";

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

  // ---- load the case and its rubric ---------------------------------------
  const admin = createAdminClient();

  const { data: caseData, error: caseError } = await admin
    .from("cases")
    .select(
      "id, title, domain, difficulty, scenario, instructions, supporting_data, expected_framework, model_answer, is_published",
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

    // Scores are written with the service role: there is deliberately no RLS
    // policy that would let a user insert their own score.
    const { error: scoreError } = await admin.from("scores").insert({
      submission_id: submission.id,
      user_id: user.id,
      case_id: body.case_id,
      breakdown: result.breakdown,
      total_score: result.totalScore,
      max_score: result.maxScore,
      feedback: result.feedback,
      model: result.model,
      tokens_used: result.tokensUsed,
    });

    if (scoreError) throw new Error(scoreError.message);

    await admin
      .from("submissions")
      .update({ status: "evaluated" })
      .eq("id", submission.id);

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
      total_score: result.totalScore,
      max_score: result.maxScore,
      percentage: Math.round(result.percentage * 100) / 100,
      breakdown: result.breakdown,
      feedback: result.feedback,
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
