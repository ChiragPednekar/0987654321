import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { istDate } from "@/lib/current-affairs/questions";
import { loadReview } from "@/lib/current-affairs/review";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  quiz_id: z.string().uuid(),
  answers: z.array(z.number().int().min(-1).max(3)).min(1).max(10),
});

/**
 * Records one attempt at a daily quiz and returns the answer key.
 *
 * One attempt per quiz, enforced by the table's unique key: submitting again
 * after reading the explanations would not be a score. A repeat returns the
 * original attempt's review rather than an error, so a double-click or a second
 * tab shows the same result instead of a failure.
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

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const today = istDate();
  const { data: quiz } = await admin
    .from("ca_quizzes")
    .select("id, quiz_date")
    .eq("id", body.quiz_id)
    .lte("quiz_date", today)
    .maybeSingle();
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });

  const { count } = await admin
    .from("ca_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quiz.id);
  if (body.answers.length !== count) {
    return NextResponse.json({ error: "Answer every question, or skip it explicitly." }, { status: 400 });
  }

  const { error } = await admin.from("ca_attempts").insert({
    user_id: user.id,
    quiz_id: quiz.id,
    answers: body.answers,
    on_the_day: quiz.quiz_date === today,
  });

  let answers = body.answers;
  let repeat = false;
  if (error) {
    if (error.code !== "23505") {
      console.error("[daily-quiz] could not record attempt", error);
      return NextResponse.json({ error: "Could not save your answers." }, { status: 500 });
    }
    // Already answered: the first attempt is the one that stands.
    const { data: first } = await admin
      .from("ca_attempts")
      .select("answers")
      .eq("user_id", user.id)
      .eq("quiz_id", quiz.id)
      .single();
    answers = first?.answers ?? body.answers;
    repeat = true;
  }

  const review = await loadReview(admin, quiz.id, answers);
  return NextResponse.json({ review, repeat });
}
