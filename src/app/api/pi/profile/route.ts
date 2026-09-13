import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  background: z.string().trim().max(6_000),
  target_role: z.string().trim().max(120).optional().nullable(),
  target_firms: z.string().trim().max(300).optional().nullable(),
});

/**
 * Saves the candidate's background so it is written once rather than before
 * every practice interview. Friction here is the difference between a student
 * doing ten mock interviews and doing one.
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
  const { error } = await admin.from("pi_profiles").upsert(
    {
      user_id: user.id,
      background: body.background,
      target_role: body.target_role ?? null,
      target_firms: body.target_firms ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[pi] profile save failed", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
