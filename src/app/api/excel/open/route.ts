import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startActivityAttempt } from "@/lib/proctoring";

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

  const admin = createAdminClient();

  const { data: exercise } = await admin
    .from("excel_exercises")
    .select("id, prompt, grid, answer_label, hint, is_published")
    .eq("slug", body.slug)
    .maybeSingle();

  if (!exercise || !exercise.is_published) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  await startActivityAttempt(admin, user.id, "excel", exercise.id);

  return NextResponse.json({
    prompt: exercise.prompt,
    grid: exercise.grid,
    answer_label: exercise.answer_label,
    hint: exercise.hint,
  });
}
