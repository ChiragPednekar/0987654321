import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The seller ends the meeting without a sale. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sales_sessions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your meeting." }, { status: 403 });
  }
  if (session.status !== "live") return NextResponse.json({ ok: true, already: true });

  await admin
    .from("sales_sessions")
    .update({ status: "lost", outcome_reason: "seller ended the meeting", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "live");

  return NextResponse.json({ ok: true });
}
