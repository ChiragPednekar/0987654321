import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from("gd_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("session_id", id)
    .eq("user_id", user.id)
    .eq("admission_status", "approved");
  if (error) return NextResponse.json({ error: "Could not leave the meeting." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
