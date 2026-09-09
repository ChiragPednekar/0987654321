import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

const actionSchema = z.object({
  action: z.enum(["join", "start", "end", "cancel"]),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Joining, starting and ending a peer room.
 *
 * Every transition re-reads the row and checks the caller is actually in it.
 * The room id travels in the URL and is shared in a lobby, so it must never be
 * enough on its own to act on a session.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof actionSchema>;
  try {
    body = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: session } = await admin
    .from("peer_sessions")
    .select("id, host_id, guest_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isHost = session.host_id === user.id;
  const isGuest = session.guest_id === user.id;

  if (body.action === "join") {
    if (isHost) {
      return NextResponse.json(
        { error: "You opened this room — wait for someone to join." },
        { status: 400 },
      );
    }
    if (session.guest_id && !isGuest) {
      return NextResponse.json({ error: "This room is already full." }, { status: 409 });
    }
    if (session.status !== "open" && !isGuest) {
      return NextResponse.json({ error: "This room is no longer open." }, { status: 409 });
    }

    // Conditional on the seat still being empty, so two people clicking join at
    // the same moment cannot both take it.
    const { data: claimed, error } = await admin
      .from("peer_sessions")
      .update({ guest_id: user.id, status: "live", started_at: new Date().toISOString() })
      .eq("id", id)
      .is("guest_id", null)
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!claimed && !isGuest) {
      return NextResponse.json({ error: "Someone just took that seat." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, session_id: id });
  }

  if (!isHost && !isGuest) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }

  if (body.action === "cancel") {
    if (!isHost) {
      return NextResponse.json({ error: "Only the host can cancel." }, { status: 403 });
    }
    await admin.from("peer_sessions").update({ status: "cancelled" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "end") {
    await admin
      .from("peer_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
