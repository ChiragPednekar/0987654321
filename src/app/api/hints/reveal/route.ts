import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ hint_id: z.string().uuid() });

/**
 * Reveals a hint and records it.
 *
 * The reveal is recorded server-side because it costs the user score. If the
 * client reported its own penalty, a student could read every hint and then
 * claim to have read none.
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

  // `body` is not granted to authenticated — only the service role can read
  // it, which is what makes the reveal endpoint the single way to obtain one.
  const admin = createAdminClient();

  const { data: hint } = await admin
    .from("case_hints")
    .select("id, case_id, body, penalty_pct")
    .eq("id", body.hint_id)
    .maybeSingle();

  if (!hint) {
    return NextResponse.json({ error: "Hint not found" }, { status: 404 });
  }

  // Idempotent — re-revealing must not stack another penalty.
  const { error } = await supabase.from("hint_reveals").upsert({
    user_id: user.id,
    hint_id: hint.id,
    case_id: hint.case_id,
  });

  if (error) {
    return NextResponse.json({ error: "Could not reveal" }, { status: 500 });
  }

  return NextResponse.json({ body: hint.body, penalty_pct: hint.penalty_pct });
}
