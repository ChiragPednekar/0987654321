import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ObjectiveResultRow } from "@/lib/objective";
import { signalsSchema } from "@/lib/integrity-request";
import {
  consumeActivityElapsed,
  recordActivityIntegrity,
} from "@/lib/proctoring";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  session_id: z.string().uuid(),
  /** {questionId: chosenIndex}. Omit a question entirely to skip it. */
  answers: z.record(z.string().uuid(), z.number().int().min(0).max(5)),
  seconds: z.number().int().min(0).max(86_400).default(0),
  signals: signalsSchema,
});

/**
 * Marks one sitting.
 *
 * This is the only place the answer key is ever read, and it is read with the
 * service role because `authenticated` has no grant on that column at all
 * (20250101000037). The key travels back to the student here and nowhere
 * else — after their answers are recorded, so the reveal cannot be used to
 * improve the score it is revealing.
 */
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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("objective_sessions")
    .select("id, user_id, question_ids, total, submitted_at")
    .eq("id", body.session_id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Sitting not found." }, { status: 404 });
  }

  // Ownership checked explicitly. The lookup runs as the service role, which
  // RLS does not constrain, so without this any signed-in account could mark
  // and read the answers to somebody else's sitting.
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your sitting." }, { status: 403 });
  }

  if (session.submitted_at) {
    return NextResponse.json(
      { error: "This set has already been submitted." },
      { status: 409 },
    );
  }

  const { data: questions, error } = await admin
    .from("objective_questions")
    .select("id, stem, options, correct_index, explanation, topic")
    .in("id", session.question_ids);

  if (error || !questions) {
    console.error("[objective] key lookup failed", error?.message);
    return NextResponse.json({ error: "Could not mark the set." }, { status: 500 });
  }

  const byId = new Map(questions.map((q) => [q.id, q]));

  /**
   * Iterated over `session.question_ids`, not over the submitted answers.
   *
   * The stored id list is what the student was actually given, so a payload
   * naming a question from someone else's set contributes nothing, and a
   * question the student never answered is counted as a skip rather than
   * silently dropped from the denominator.
   */
  const results: ObjectiveResultRow[] = [];
  let correct = 0;

  for (const id of session.question_ids) {
    const q = byId.get(id);
    if (!q) continue; // Deleted since the set was drawn.

    const chosen = Object.prototype.hasOwnProperty.call(body.answers, id)
      ? body.answers[id]
      : null;

    if (chosen !== null && chosen === q.correct_index) correct++;

    results.push({
      id: q.id,
      stem: q.stem,
      options: q.options,
      chosen,
      correct_index: q.correct_index,
      explanation: q.explanation,
      topic: q.topic,
    });
  }

  const { error: updateError } = await admin
    .from("objective_sessions")
    .update({
      answers: body.answers,
      correct_count: correct,
      seconds: body.seconds,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    // Guards the double-submit that the check above races with: two tabs
    // hitting submit together would both pass the read and both mark.
    .is("submitted_at", null);

  if (updateError) {
    console.error("[objective] session update failed", updateError.message);
    return NextResponse.json({ error: "Could not save your answers." }, { status: 500 });
  }

  /**
   * Integrity is assessed after the answers are safely stored, never before.
   *
   * A verdict that failed would otherwise be able to cost a student the sitting
   * they had already completed. The same ordering as the case path, and the
   * same ladder — a tab-switch here counts towards exactly the strike count a
   * pasted case answer does.
   *
   * `answerChars` is 0 and `aiLikelihood` is null on purpose. There is no prose
   * in a chosen option to measure or to read for style, so the checks that need
   * one must see an honest absence rather than a fabricated number. What is
   * left is the part that genuinely applies: how often the page was left, and
   * how that compares with the server's own clock.
   */
  const elapsedSeconds = await consumeActivityElapsed(
    admin,
    user.id,
    "objective",
    session.id,
  );

  const integrity = await recordActivityIntegrity(admin, {
    userId: user.id,
    activity: "objective",
    activityRef: session.id,
    signals: body.signals,
    elapsedSeconds,
  });

  return NextResponse.json({
    correct,
    total: session.total,
    seconds: body.seconds,
    results,
    integrity_warning: integrity.warning,
    blocked: integrity.blocked,
  });
}
