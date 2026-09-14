import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startActivityAttempt } from "@/lib/proctoring";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ slug: z.string().min(1).max(120) });

/**
 * Hands over the exercise, once the attempt is armed.
 *
 * This exists because rendering the prompt and schema into the page was not
 * the same as withholding them. A gate that only stops them being DRAWN still
 * ships them: they travel in the RSC payload as props for the client
 * component, where View Source or the network tab reads them without the
 * student ever pressing Start. Someone could work the whole answer out
 * unsupervised and then arm exam mode to type it in with a clean record, which
 * is precisely the window proctoring is supposed to close.
 *
 * So the page now sends an identifier and nothing else, and the body of the
 * exercise is fetched here — after the gate, and in the same call that stamps
 * the server's clock. The aptitude runner already worked this way; this brings
 * the workbenches into line with it.
 *
 * Note what is still NOT sent: solution_sql and hidden_setup_sql have no grant
 * to `authenticated` at all (20250101000045), so they could not be returned
 * here even by mistake.
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
    .from("sql_exercises")
    .select("id, prompt, schema_note, order_matters, hint, is_published")
    .eq("slug", body.slug)
    .maybeSingle();

  if (!exercise || !exercise.is_published) {
    return NextResponse.json({ error: "Exercise not found." }, { status: 404 });
  }

  await startActivityAttempt(admin, user.id, "sql", exercise.id);

  return NextResponse.json({
    prompt: exercise.prompt,
    schema_note: exercise.schema_note,
    order_matters: exercise.order_matters,
    hint: exercise.hint,
  });
}
