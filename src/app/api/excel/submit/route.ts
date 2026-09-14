import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { markFormula, type Grid } from "@/lib/excel/runner";
import { signalsSchema } from "@/lib/integrity-request";
import { recordActivityIntegrity } from "@/lib/proctoring";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  signals: signalsSchema,
  slug: z.string().trim().min(1).max(120),
  formula: z.string().trim().min(1).max(1_000),
});

/**
 * Marks a formula against both grids.
 *
 * The hidden grid is what makes the mark mean anything. A formula that is right
 * on the visible grid and wrong on the hidden one has almost certainly typed the
 * answer in, and the response says so rather than reporting a vague mismatch.
 * See markFormula in src/lib/excel/runner.ts.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Write a formula first." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: exercise } = await admin
    .from("excel_exercises")
    .select("id, grid, hidden_grid, solution_formula, tolerance")
    .eq("slug", body.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: "Exercise not found." }, { status: 404 });

  const verdict = markFormula(
    {
      grid: exercise.grid as Grid,
      hidden_grid: exercise.hidden_grid as Grid,
      solution_formula: exercise.solution_formula,
      tolerance: exercise.tolerance,
    },
    body.formula,
  );

  if (!verdict.correct && verdict.stage === "misconfigured") {
    // The reference formula itself is broken. Never recorded as their attempt.
    console.error("[excel] reference formula failed", exercise.id, verdict.detail);
    return NextResponse.json(
      { error: "This exercise is misconfigured. It has been logged." },
      { status: 500 },
    );
  }

  const { data: attempt } = await admin
    .from("excel_attempts")
    .insert({
      user_id: user.id,
      exercise_id: exercise.id,
      formula: body.formula,
      correct: verdict.correct,
      failed_on: verdict.correct ? null : verdict.stage,
    })
    .select("id")
    .maybeSingle();

  /**
   * Assessed once, on the attempt that solves the exercise — not on every
   * submission.
   *
   * The signals are cumulative for the whole sitting, so a student iterating
   * honestly towards a working formula would send a steadily worse-looking
   * payload each time, and recording a verdict per attempt would let one
   * sitting produce three separate strikes for one piece of behaviour. A wrong
   * formula also has nothing to penalise: it already scored nothing.
   *
   * No aiLikelihood and no answerChars: a formula is not prose. The cheat this
   * catches is a formula that was never typed, and the hidden second grid
   * catches the one that was typed but not worked out.
   */
  let warning: string | null = null;
  if (verdict.correct && attempt?.id) {
    const integrity = await recordActivityIntegrity(admin, {
      userId: user.id,
      activity: "excel",
      activityRef: attempt.id,
      signals: body.signals,
    });
    warning = integrity.warning;
  }

  return NextResponse.json({ ...verdict, integrity_warning: warning });
}
