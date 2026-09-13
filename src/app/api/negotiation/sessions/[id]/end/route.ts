import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Walks away.
 *
 * A deliberate no-deal is a legitimate and sometimes correct outcome, so it is
 * recorded as one rather than as an abandoned session. The scorecard then says
 * whether walking was right: if the best offer on the table was below the
 * student's own BATNA, it was.
 */
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
    .from("negotiation_sessions")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your negotiation." }, { status: 403 });
  }
  if (session.status !== "live") return NextResponse.json({ ok: true, already: true });

  await admin
    .from("negotiation_sessions")
    .update({ status: "no_deal", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "live");

  return NextResponse.json({ ok: true });
}
