import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { compareResults, runQuery } from "@/lib/sql/runner";
import { signalsSchema } from "@/lib/integrity-request";
import {
  consumeActivityElapsed,
  recordActivityIntegrity,
} from "@/lib/proctoring";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  signals: signalsSchema,
  slug: z.string().trim().min(1).max(120),
  query: z.string().trim().min(1).max(8_000),
});

/**
 * Marks a query.
 *
 * Four executions, not two: the reference solution and the student's query are
 * each run against both fixtures. Running the solution rather than storing an
 * expected result means the answer can never drift out of step with the data —
 * changing a seed row cannot silently make every stored answer wrong.
 *
 * The hidden fixture is what makes the mark mean anything. A query that passes
 * the visible data and fails the hidden one has almost certainly hardcoded the
 * answer, and the response says so rather than reporting a vague mismatch.
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
    return NextResponse.json({ error: "Write a query first." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: exercise } = await admin
    .from("sql_exercises")
    .select("id, setup_sql, hidden_setup_sql, solution_sql, order_matters")
    .eq("slug", body.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: "Exercise not found." }, { status: 404 });

  /**
   * Integrity is assessed once, on the attempt that solves the exercise.
   *
   * The signals are cumulative for the whole sitting, so a student iterating
   * honestly towards a working query sends a steadily worse-looking payload
   * each time; recording a verdict per attempt would let one sitting produce
   * three separate strikes for one piece of behaviour. A wrong query has
   * nothing to penalise either — it already scored nothing.
   *
   * No aiLikelihood and no answerChars: a query is not prose. What this
   * catches is a query that was never typed. A query that was typed but not
   * understood is the hidden dataset's job, not this one's.
   */
  let integrityWarning: string | null = null;

  const record = async (correct: boolean, failedOn: string | null) => {
    const { data: attempt } = await admin
      .from("sql_attempts")
      .insert({
        user_id: user.id,
        exercise_id: exercise.id,
        query: body.query,
        correct,
        failed_on: failedOn as "visible" | "hidden" | "error" | null,
      })
      .select("id")
      .maybeSingle();

    if (correct && attempt?.id) {
      // Stamped by /api/sql/open when the gate was passed, so the time
      // taken cannot be reported by the client that is being assessed.
      const elapsedSeconds = await consumeActivityElapsed(
        admin,
        user.id,
        "sql",
        exercise.id,
      );
      const integrity = await recordActivityIntegrity(admin, {
        userId: user.id,
        activity: "sql",
        elapsedSeconds,
        activityRef: attempt.id,
        signals: body.signals,
      });
      integrityWarning = integrity.warning;
    }
  };

  const mine = await runQuery(exercise.setup_sql, body.query);
  if (!mine.ok || !mine.result) {
    await record(false, "error");
    return NextResponse.json({ correct: false, error: mine.error, stage: "error" });
  }

  const expected = await runQuery(exercise.setup_sql, exercise.solution_sql);
  if (!expected.ok || !expected.result) {
    // The reference solution itself is broken. Never the student's fault, and
    // never recorded as their failed attempt.
    console.error("[sql] reference solution failed", exercise.id, expected.error);
    return NextResponse.json(
      { error: "This exercise is misconfigured. It has been logged." },
      { status: 500 },
    );
  }

  const onVisible = compareResults(expected.result, mine.result, exercise.order_matters);
  if (!onVisible.correct) {
    await record(false, "visible");
    return NextResponse.json({
      correct: false,
      stage: "visible",
      reason: onVisible.reason,
      result: mine.result,
    });
  }

  // Right on the data they can see. Now the one that decides it.
  const mineHidden = await runQuery(exercise.hidden_setup_sql, body.query);
  const expectedHidden = await runQuery(exercise.hidden_setup_sql, exercise.solution_sql);

  if (!expectedHidden.ok || !expectedHidden.result) {
    console.error("[sql] reference solution failed on hidden data", exercise.id);
    return NextResponse.json(
      { error: "This exercise is misconfigured. It has been logged." },
      { status: 500 },
    );
  }

  if (!mineHidden.ok || !mineHidden.result) {
    await record(false, "hidden");
    return NextResponse.json({
      correct: false,
      stage: "hidden",
      reason:
        "Your query gives the right answer for the rows you can see, but fails on a second dataset with the same schema. That usually means it depends on these particular rows.",
    });
  }

  const onHidden = compareResults(
    expectedHidden.result,
    mineHidden.result,
    exercise.order_matters,
  );

  if (!onHidden.correct) {
    await record(false, "hidden");
    return NextResponse.json({
      correct: false,
      stage: "hidden",
      reason:
        "Right on the rows you can see, wrong on a second dataset with the same schema. A query that only works on this data is not a query — check whether you have written any values in by hand.",
    });
  }

  await record(true, null);
  return NextResponse.json({
    correct: true,
    result: mine.result,
    integrity_warning: integrityWarning,
  });
}
