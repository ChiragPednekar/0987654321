import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { OBJECTIVE_SET_SIZE, OBJECTIVE_TRACK_VALUES } from "@/lib/objective";
import { startActivityAttempt } from "@/lib/proctoring";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  track: z.enum(OBJECTIVE_TRACK_VALUES),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  count: z.number().int().min(1).max(OBJECTIVE_SET_SIZE.max).default(OBJECTIVE_SET_SIZE.default),
});

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
