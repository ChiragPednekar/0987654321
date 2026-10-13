import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { OBJECTIVE_SET_SIZE, OBJECTIVE_TRACK_VALUES } from "@/lib/objective";
import { startActivityAttempt } from "@/lib/proctoring";
import { lockoutResponse } from "@/lib/exam-lockouts";

export const dynamic = "force-dynamic";

const trackSchema = z.object({
  track: z.enum(OBJECTIVE_TRACK_VALUES),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  count: z.number().int().min(1).max(OBJECTIVE_SET_SIZE.max).default(OBJECTIVE_SET_SIZE.default),
});

/** A quiz a teacher assigned: the paper is the teacher's picked questions. */
const assignmentSchema = z.object({ assignment_id: z.string().uuid() });

const bodySchema = z.union([assignmentSchema, trackSchema]);

/**
 * Begins one objective sitting.
 *
 * Deliberately NOT quota-checked. Every other practice route bills against the
 * annual grading allowance because every other route calls a model; this one
 * is marked by comparing integers and costs nothing to serve. Metering it
 * would price a thing that is free, and free unlimited aptitude practice is
 * the reason a placement cell renews.
 *
 * Entitlement still applies: browsing stays open, practising is the licensed
 * product, and that rule should not have an exception just because this
 * particular practice happens to be cheap.
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

  if ("assignment_id" in body) {
    return startAssignedQuiz(user.id, body.assignment_id);
  }

  // The test on this page may have been ended (camera or leaving the window).
  const locked = await lockoutResponse(user.id, `/practice/${body.track}`);
  if (locked) return locked;

  const admin = createAdminClient();

  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  // Selected with the service role and explicitly column-limited. Reading the
  // whole row here would work — service_role has every grant — and would then
  // put the answer key one careless `...question` spread away from the
  // response body. Naming the columns is the cheap way to make that mistake
  // impossible rather than merely unlikely.
  let query = admin
    .from("objective_questions")
    .select("id, track, topic, difficulty, context, stem, options")
    .eq("track", body.track)
    .eq("is_published", true);

  if (body.difficulty) query = query.eq("difficulty", body.difficulty);

  const { data: pool, error } = await query.limit(200);

  if (error) {
    console.error("[objective] pool query failed", error.message);
    return NextResponse.json({ error: "Could not load questions." }, { status: 500 });
  }

  if (!pool || pool.length === 0) {
    return NextResponse.json(
      { error: "No questions in this track yet." },
      { status: 404 },
    );
  }

  /**
   * What this student has already been given, most recent first.
   *
   * Without this, a random draw from a bank of ninety repeats a question
   * inside four sittings, and a repeat is worse than it sounds: the student
   * remembers the answer rather than the method, their accuracy chart drifts
   * upward for no reason, and the practice stops teaching. Bounded to the last
   * twenty sittings so a returning user eventually cycles back rather than
   * running out.
   */
  const { data: recent } = await admin
    .from("objective_sessions")
    .select("question_ids")
    .eq("user_id", user.id)
    .eq("track", body.track)
    .order("started_at", { ascending: false })
    .limit(20);

  const seen = new Set((recent ?? []).flatMap((s) => s.question_ids));

  /**
   * Shuffled in the application rather than with `order by random()`.
   *
   * The pool is small enough that the sort cost is irrelevant, and doing it
   * here keeps the picked order and the stored `question_ids` identical — the
   * student's paper is reproducible afterwards, which matters when they
   * dispute a mark.
   */
  const shuffle = <T,>(items: T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  // Unseen questions first, then the rest. Falling back rather than filtering
  // matters: a student who has worked through the whole track must still get a
  // set, not an empty one.
  const unseen = shuffle(pool.filter((q) => !seen.has(q.id)));
  const repeats = shuffle(pool.filter((q) => seen.has(q.id)));
  const picked = [...unseen, ...repeats].slice(
    0,
    Math.min(body.count, pool.length),
  );

  const { data: session, error: sessionError } = await admin
    .from("objective_sessions")
    .insert({
      user_id: user.id,
      track: body.track,
      difficulty: body.difficulty ?? null,
      question_ids: picked.map((q) => q.id),
      total: picked.length,
    })
    .select("id, started_at")
    .single();

  if (sessionError || !session) {
    console.error("[objective] session insert failed", sessionError?.message);
    return NextResponse.json({ error: "Could not start the set." }, { status: 500 });
  }

  /**
   * The clock that decides anything. The client reports its own elapsed time
   * because it drives the on-screen timer, and that copy is never read for a
   * verdict — same rule as solve_attempts on the case path.
   */
  await startActivityAttempt(admin, user.id, "objective", session.id);

  return NextResponse.json({
    session_id: session.id,
    started_at: session.started_at,
    questions: picked,
  });
}

/**
 * Starts a sitting of a quiz a teacher assigned.
 *
 * The paper is fixed — the teacher's picked questions, in their order — rather
 * than drawn from the track. Only a member of the batch may sit it (a teacher
 * of the batch may preview it), only once it is published and open, and not
 * again once the hand-in is final under the assignment's resubmission rules.
 * The session records the assignment, so submitting it attaches the score to
 * the assignment (trigger attach_quiz_to_assignment, 20250101000067).
 */
async function startAssignedQuiz(userId: string, assignmentId: string) {
  // The test on this page may have been ended (camera or leaving the window).
  const locked = await lockoutResponse(userId, `/practice/assigned/${assignmentId}`);
  if (locked) return locked;

  const admin = createAdminClient();

  const { data: assignment } = await admin
    .from("classroom_assignments")
    .select("id, classroom_id, kind, question_ids, is_published, starts_at, allow_resubmission, max_attempts")
    .eq("id", assignmentId)
    .maybeSingle();

  const { data: membership } = assignment
    ? await admin
        .from("classroom_members")
        .select("role")
        .eq("classroom_id", assignment.classroom_id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  // One answer for "no such quiz" and "not your batch": confirming that an
  // assignment exists is itself a small leak.
  if (!assignment || assignment.kind !== "aptitude" || !membership) {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }
  const isTeacher = membership.role === "teacher";

  if (!isTeacher) {
    if (!assignment.is_published) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }
    if (assignment.starts_at && new Date(assignment.starts_at) > new Date()) {
      return NextResponse.json({ error: "This quiz has not opened yet." }, { status: 409 });
    }
    if (!(await canSolve(admin, userId))) {
      return NextResponse.json(SOLVE_DENIAL, { status: 403 });
    }

    const { data: previous } = await admin
      .from("assignment_submissions")
      .select("attempt_number")
      .eq("assignment_id", assignmentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (
      previous &&
      (!assignment.allow_resubmission ||
        (assignment.max_attempts !== null && previous.attempt_number >= assignment.max_attempts))
    ) {
      return NextResponse.json(
        { error: "You have already submitted this quiz." },
        { status: 409 },
      );
    }
  }

  const ids = assignment.question_ids ?? [];
  const { data: rows, error } = await admin
    .from("objective_questions")
    .select("id, track, topic, difficulty, context, stem, options")
    .in("id", ids);

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ error: "This quiz has no questions." }, { status: 404 });
  }

  // In the teacher's order, not the database's.
  const byId = new Map(rows.map((q) => [q.id, q]));
  const paper = ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q));

  const { data: session, error: sessionError } = await admin
    .from("objective_sessions")
    .insert({
      user_id: userId,
      // A sitting belongs to one track; a mixed quiz is filed under its first.
      track: paper[0].track,
      difficulty: null,
      question_ids: paper.map((q) => q.id),
      total: paper.length,
      assignment_id: assignmentId,
    })
    .select("id, started_at")
    .single();

  if (sessionError || !session) {
    console.error("[objective] assigned session insert failed", sessionError?.message);
    return NextResponse.json({ error: "Could not start the quiz." }, { status: 500 });
  }

  await startActivityAttempt(admin, userId, "objective", session.id);

  return NextResponse.json({
    session_id: session.id,
    started_at: session.started_at,
    questions: paper,
  });
}
