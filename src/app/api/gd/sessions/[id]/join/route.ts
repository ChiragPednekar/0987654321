import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from("gd_participants")
    .select("admission_status")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({ admission_status: data?.admission_status ?? null });
}

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
    .select("id, status, host_id, join_policy, max_participants")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  if (session.status === "completed" || session.status === "cancelled") {
    return NextResponse.json({ error: "This meeting has ended." }, { status: 409 });
  }

  const { data: existing } = await admin.from("gd_participants")
    .select("admission_status, left_at")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.admission_status === "approved" && !existing.left_at) {
    return NextResponse.json({ admission_status: "approved" });
  }
  if (existing?.admission_status === "pending") {
    return NextResponse.json({ admission_status: "pending" });
  }

  const { data: active } = await admin.from("gd_participants")
    .select("user_id")
    .eq("session_id", id)
    .eq("admission_status", "approved")
    .is("left_at", null);
  if ((active ?? []).length >= session.max_participants) {
    return NextResponse.json({ error: "This meeting is full." }, { status: 409 });
  }

  const admissionStatus = session.join_policy === "approval" && user.id !== session.host_id
    ? "pending"
    : "approved";
  const { error } = await admin.from("gd_participants").upsert({
    session_id: id,
    user_id: user.id,
    admission_status: admissionStatus,
    left_at: null,
  }, { onConflict: "session_id,user_id" });
  if (error) {
    console.error("[gd] join request failed", error.message);
    return NextResponse.json({ error: "Could not join this meeting." }, { status: 500 });
  }

  return NextResponse.json({ admission_status: admissionStatus }, { status: 201 });
}
