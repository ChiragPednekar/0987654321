import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Ends the call without recording or grading its conversation. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = createAdminClient();
  const { data: session } = await admin.from("gd_sessions")
    .select("host_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  if (session.host_id !== user.id) {
    return NextResponse.json({ error: "Only the host can end the meeting." }, { status: 403 });
  }
  if (session.status === "completed" || session.status === "cancelled") {
    return NextResponse.json({ ok: true, already_ended: true });
  }
  const { error } = await admin.from("gd_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["open", "live"]);
  if (error) return NextResponse.json({ error: "Could not end the meeting." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
