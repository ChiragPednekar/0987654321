import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Claims the caller's personal contest timer.
 *
 * `started_at` is set server-side and never trusted from the client — it is
 * what the speed bonus is computed from.
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

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: contest } = await admin
    .from("contests")
    .select("id, starts_at, ends_at, duration_minutes, is_published, case_id, cases(slug)")
    .eq("id", id)
    .maybeSingle();

  if (!contest || !contest.is_published) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const now = Date.now();
  if (
    now < new Date(contest.starts_at).getTime() ||
    now > new Date(contest.ends_at).getTime()
  ) {
    return NextResponse.json({ error: "Contest is not open" }, { status: 409 });
  }

  // Already started? Return the existing timer rather than resetting it —
  // otherwise refreshing the page would buy more time.
  const { data: existing } = await admin
    .from("contest_submissions")
    .select("started_at, submitted_at")
    .eq("contest_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      started_at: existing.started_at,
      already_started: true,
      submitted: Boolean(existing.submitted_at),
    });
  }

  const startedAt = new Date().toISOString();

  const { error } = await admin
    .from("contest_submissions")
    .insert({ contest_id: id, user_id: user.id, started_at: startedAt });

  if (error) {
    return NextResponse.json({ error: "Could not start" }, { status: 500 });
  }

  await admin.from("user_activity").insert({
    user_id: user.id,
    type: "contest_entered",
    case_id: contest.case_id,
    metadata: { contest_id: id },
  });

  return NextResponse.json({ started_at: startedAt, already_started: false });
}
