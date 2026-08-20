import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  duration_seconds: z.number().int().min(0).max(86_400).default(0),
  // question id → the number the user entered. Unanswered questions are simply
  // absent rather than sent as null.
  answers: z.record(z.string().uuid(), z.number().finite()),
});

export interface DrillResult {
  correct: number;
  total: number;
  questions: {
    id: string;
    position: number;
    correct: boolean;
    answered: number | null;
    expected: number;
    unit: string | null;
    explanation: string | null;
  }[];
}

/**
 * Grades a drill.
 *
 * Arithmetic, not AI: instant, free and perfectly repeatable, which is the
 * right trade-off for mental maths. Expected values are read with the service
 * role because they are withheld from the client by column grant — otherwise
 * the answers would be one REST call away and the drill pointless.
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

  const { data: questions } = await admin
    .from("drill_questions")
    .select("id, position, expected, tolerance_pct, unit, explanation")
    .eq("case_id", body.case_id)
    .order("position");

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Drill not found" }, { status: 404 });
  }

  const graded = questions.map((q) => {
    const answered = body.answers[q.id];
    const expected = Number(q.expected);

    // Tolerance is relative to the expected value, except when that value is
    // zero — a percentage band around zero would accept only an exact match.
    const band =
      expected === 0
        ? Number(q.tolerance_pct) / 100
        : Math.abs(expected) * (Number(q.tolerance_pct) / 100);

    const correct =
      typeof answered === "number" && Math.abs(answered - expected) <= band;

    return {
      id: q.id,
      position: q.position,
      correct,
      answered: typeof answered === "number" ? answered : null,
      expected,
      unit: q.unit,
      explanation: q.explanation,
    };
  });

  const correct = graded.filter((q) => q.correct).length;

  await admin.from("drill_attempts").insert({
    user_id: user.id,
    case_id: body.case_id,
    answers: body.answers,
    correct,
    total: graded.length,
    duration_seconds: body.duration_seconds,
  });

  return NextResponse.json<DrillResult>({
    correct,
    total: graded.length,
    questions: graded,
  });
}
