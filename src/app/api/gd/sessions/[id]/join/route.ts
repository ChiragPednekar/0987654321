import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /**
   * Whether this browser can transcribe its own microphone.
   *
   * Reported at join rather than inferred later, because an empty transcript
   * is ambiguous and this is not: it is the difference between "said nothing"
   * and "could not be heard", and only the first should ever be held against
   * a student.
   */
  transcription_ok: z.boolean().default(false),
});

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
    body = { transcription_ok: false };
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: session } = await admin
    .from("gd_sessions")
    .select("id, status, max_participants")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  if (session.status === "completed" || session.status === "cancelled") {
    return NextResponse.json({ error: "This discussion has ended." }, { status: 409 });
  }

  const { data: existing } = await admin
    .from("gd_participants")
    .select("user_id")
    .eq("session_id", id);

  const already = (existing ?? []).some((p) => p.user_id === user.id);

  // The cap is enforced here and not only in the UI. Mesh WebRTC degrades
  // sharply past six, so a seventh joiner would damage the call for everyone
  // already in it, not just for themselves.
  if (!already && (existing ?? []).length >= session.max_participants) {
    return NextResponse.json({ error: "This room is full." }, { status: 409 });
  }

  await admin.from("gd_participants").upsert(
    {
      session_id: id,
      user_id: user.id,
      transcription_ok: body.transcription_ok,
      left_at: null,
    },
    { onConflict: "session_id,user_id" },
  );

  return NextResponse.json({ ok: true, participants: (existing ?? []).length + (already ? 0 : 1) });
}
