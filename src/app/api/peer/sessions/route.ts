import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

const createSchema = z.object({
  case_id: z.string().uuid(),
  host_role: z.enum(["interviewer", "candidate"]).default("candidate"),
  scheduled_at: z.string().datetime().optional().nullable(),
});

/**
 * Opens a peer interview room and puts it in the lobby.
 *
 * Gated on the same entitlement as solving: a peer session is practice against
 * a licensed case, and the interviewer side is shown the model answer, which is
 * the most licensed content on the platform.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  // One open room per person. Without this the lobby fills with abandoned rooms
  // from someone clicking twice, and nobody can tell which is real.
  const { data: existing } = await admin
    .from("peer_sessions")
    .select("id")
    .eq("host_id", user.id)
    .eq("status", "open")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have a room waiting. Close it before opening another.", session_id: existing.id },
      { status: 409 },
    );
  }

  const { data: caseRow } = await admin
    .from("cases")
    .select("id, is_published, visibility")
    .eq("id", body.case_id)
    .maybeSingle();

  if (!caseRow?.is_published) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("peer_sessions")
    .insert({
      case_id: body.case_id,
      host_id: user.id,
      host_role: body.host_role,
      scheduled_at: body.scheduled_at ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, session_id: data.id });
}
