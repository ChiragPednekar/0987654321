import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { evaluateSubmission } from "@/lib/ai/evaluate";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/constants";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  answer: z.string().trim().min(MIN_ANSWER_CHARS).max(MAX_ANSWER_CHARS),
});

/**
 * Submits or replaces the team's entry.
 *
 * Note what is NOT here: no proctoring signals, no integrity check, no
 * attempt stamping. A case competition is a take-home team effort — splitting
 * the work and pasting each other's sections into one document is the
 * exercise. Running the individual-submission integrity checks over it would
 * flag every well-organised team, which is precisely backwards.
 *
 * Any member may submit and the entry is replaced, so a team iterates on one
 * document rather than racing to be the one whose version counts.
 * `submitted_by` records who sent the version that stands.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid submission")
        : "Invalid submission";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: comp } = await admin
    .from("competitions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!comp || !comp.is_published) {
    return NextResponse.json({ error: "Competition not found." }, { status: 404 });
  }

  const now = new Date();
  if (new Date(comp.opens_at) > now) {
    return NextResponse.json({ error: "This competition has not opened." }, { status: 409 });
  }
  if (new Date(comp.closes_at) <= now) {
    return NextResponse.json({ error: "The deadline has passed." }, { status: 409 });
  }

  const { data: membership } = await admin
    .from("competition_members")
    .select("team_id")
    .eq("competition_id", comp.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "Join or create a team before submitting." },
      { status: 403 },
    );
  }

  const { count } = await admin
    .from("competition_members")
    .select("user_id", { count: "exact", head: true })
    .eq("team_id", membership.team_id);

  if ((count ?? 0) < comp.min_team_size) {
    return NextResponse.json(
      {
        error: `Your team needs at least ${comp.min_team_size} members to submit. You have ${count ?? 0}.`,
      },
      { status: 409 },
    );
  }

  /**
   * Graded on submission rather than in a batch after the deadline.
   *
   * A batch job would be one more thing to run, and one more way for a
   * competition to sit unjudged because a cron did not fire. The ranking is
   * still embargoed — competition_leaderboard() will not return anything until
   * results_at — so grading early leaks nothing.
   */
  try {
    const result = await evaluateSubmission(
      {
        title: comp.title,
        domain: "strategy",
        difficulty: "hard",
        scenario: comp.brief,
        instructions: comp.instructions,
        supporting_data: {},
        expected_framework: comp.expected_framework,
        model_answer: null,
      },
      { criteria: comp.criteria, descriptors: comp.descriptors, max_score: comp.max_score },
      body.answer,
    );

    void recordUsage(admin, {
      userId: user.id,
      operation: "grading",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      totalTokens: result.tokensUsed,
    });

    const { error } = await admin.from("competition_entries").upsert(
      {
        team_id: membership.team_id,
        competition_id: comp.id,
        answer: body.answer,
        submitted_by: user.id,
        submitted_at: now.toISOString(),
        breakdown: result.breakdown,
        total_score: result.totalScore,
        max_score: result.maxScore,
        feedback: { ...result.feedback },
        graded_at: now.toISOString(),
      },
      { onConflict: "team_id" },
    );

    if (error) {
      console.error("[competition] entry upsert failed", error.message);
      return NextResponse.json({ error: "Could not save the entry." }, { status: 500 });
    }

    // The score is deliberately not returned. Teams would otherwise resubmit
    // against their own mark until they had reverse-engineered the rubric,
    // which is a different exercise from the one being run.
    return NextResponse.json({ ok: true, submitted_at: now.toISOString() });
  } catch (err) {
    console.error("[competition] grading failed", err);
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy. Wait about ${wait} seconds and submit again — nothing was lost.`
            : "The AI is busy. Wait a moment and submit again — nothing was lost.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Could not judge the entry. Try submitting again." },
      { status: 500 },
    );
  }
}
