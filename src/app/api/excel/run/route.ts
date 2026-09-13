import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { evaluateFormula, guardFormula, type Grid } from "@/lib/excel/runner";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().trim().min(1).max(120),
  formula: z.string().max(1_000),
});

/**
 * Evaluates a formula against the visible grid and returns the value.
 *
 * Feedback only — it says nothing about whether the answer is right, because
 * the student can see the grid and could work the number out by hand anyway.
 * Checking correctness is /submit, which also evaluates the hidden grid.
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

  const { data: exercise } = await admin
    .from("excel_exercises")
    .select("grid")
    .eq("slug", body.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: "Exercise not found." }, { status: 404 });

  const guard = guardFormula(body.formula);
  if (!guard.ok || !guard.formula) {
    return NextResponse.json({ error: guard.reason });
  }

  const result = evaluateFormula(exercise.grid as Grid, guard.formula);
  if (!result.ok) return NextResponse.json({ error: result.error });

  return NextResponse.json({ value: result.value ?? null });
}
