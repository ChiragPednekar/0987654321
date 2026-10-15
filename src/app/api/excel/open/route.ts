import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOpenExercise } from "@/lib/teacher-exercises";
import { startActivityAttempt } from "@/lib/proctoring";
import { lockoutResponse, recordLockout, lockMessage } from "@/lib/exam-lockouts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().min(1).max(120) });

/**
 * Hands over the grid, once the attempt is armed. See api/sql/open — the same
 * leak applied here and worse: the whole dataset travelled in the RSC payload
 * as a prop, so the answer could be worked out in a spreadsheet before Start
 * was ever pressed.
 *
 * hidden_grid and solution_formula have no grant to `authenticated`
 * (20250101000046) and so cannot be returned from here at all.
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // The test on this page may have been ended (camera or leaving the window).
  const locked = await lockoutResponse(user.id, `/excel/${body.slug}`);
  if (locked) return locked;

  const admin = createAdminClient();

  const { data: exercise } = await admin
    .from("excel_exercises")
    .select("id, prompt, grid, answer_label, hint, is_published, created_by")
    .eq("slug", body.slug)
    .maybeSingle();

  if (!exercise || !(await canOpenExercise(admin, "excel", exercise, user.id))) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  // Check for an abandoned in-progress attempt
  const { data: existingAttempt } = await admin
    .from("activity_attempts")
    .select("started_at")
    .eq("user_id", user.id)
    .eq("activity", "excel")
    .eq("activity_ref", exercise.id)
    .maybeSingle();

  if (existingAttempt?.started_at) {
    const elapsedSinceStart =
      (Date.now() - new Date(existingAttempt.started_at).getTime()) / 1000;
    if (elapsedSinceStart > 45) {
      await admin
        .from("activity_attempts")
        .delete()
        .eq("user_id", user.id)
        .eq("activity", "excel")
        .eq("activity_ref", exercise.id);

      const lock = await recordLockout(admin, {
        userId: user.id,
        path: `/excel/${body.slug}`,
        reason: "no_face",
        signals: {
          violation: "abandoned_test",
          message: "A test on this question was previously started and abandoned without submitting.",
          elapsedSinceStart,
        },
      });

      return NextResponse.json(
        {
          error: lock
            ? lockMessage(lock)
            : "Test was started and abandoned without submitting. Exercise is locked.",
          lock,
        },
        { status: 403 },
      );
    }
  }

  await startActivityAttempt(admin, user.id, "excel", exercise.id);

  return NextResponse.json({
    prompt: exercise.prompt,
    grid: exercise.grid,
    answer_label: exercise.answer_label,
    hint: exercise.hint,
  });
}
