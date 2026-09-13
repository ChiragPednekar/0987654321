import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

/**
 * Records one thing this participant said.
 *
 * Note what the body does NOT contain: a speaker. The speaker is taken from
 * the authenticated session, so the attribution the whole feature rests on
 * cannot be forged by posting somebody else's id — which is the single thing
 * that would make every GD score meaningless.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  // Membership rather than mere authentication: a signed-in stranger must not
  // be able to inject speech into a room they were never in.
  const { data: member } = await admin
    .from("gd_participants")
    .select("user_id")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }

  const { data: session } = await admin
    .from("gd_sessions")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (session?.status === "completed" || session?.status === "cancelled") {
    return NextResponse.json({ error: "This discussion has ended." }, { status: 409 });
  }

  const { error } = await admin.from("gd_utterances").insert({
    session_id: id,
    user_id: user.id,
    text: body.text,
  });

  if (error) {
    console.error("[gd] utterance insert failed", error.message);
    return NextResponse.json({ error: "Could not record." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
