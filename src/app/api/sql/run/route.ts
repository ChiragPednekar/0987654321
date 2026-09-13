import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { runQuery } from "@/lib/sql/runner";

// A cross join on a bounded fixture is still slow. The platform cap is the
// backstop for a query sql.js cannot be interrupted out of.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().trim().min(1).max(120),
  query: z.string().max(8_000),
});

/**
 * Runs a query against the visible fixture and returns the rows.
 *
 * Feedback only — it says nothing about whether the answer is right, because
 * the student can see the data and could compare by eye anyway. Checking
 * correctness is /submit, which also runs the hidden fixture.
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
    .from("sql_exercises")
    .select("setup_sql")
    .eq("slug", body.slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: "Exercise not found." }, { status: 404 });

  const run = await runQuery(exercise.setup_sql, body.query);
  if (!run.ok) return NextResponse.json({ error: run.error }, { status: 200 });

  return NextResponse.json({ result: run.result, truncated: run.truncated ?? false });
}
