import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attemptPath } from "@/lib/certificates";
import { lockoutResponse } from "@/lib/exam-lockouts";

export const dynamic = "force-dynamic";

/**
 * Starts the clock on a paid attempt. The deadline is stamped here, on the
 * server, from the exam's duration — the browser only counts down to it.
 * Starting twice is harmless: an attempt already under way keeps its deadline.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const locked = await lockoutResponse(user.id, attemptPath(id));
  if (locked) return locked;

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("cert_attempts")
    .select("id, user_id, status, deadline_at, exam_id")
    .eq("id", id)
    .maybeSingle();
  if (!attempt || attempt.user_id !== user.id) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

  if (attempt.status === "in_progress") {
    return NextResponse.json({ deadline_at: attempt.deadline_at });
  }
  if (attempt.status !== "ready") {
    return NextResponse.json({ error: "This attempt has already been used." }, { status: 409 });
  }

  const { data: exam } = await admin.from("cert_exams").select("duration_minutes").eq("id", attempt.exam_id).single();
  const now = new Date();
  const deadline = new Date(now.getTime() + (exam?.duration_minutes ?? 90) * 60_000).toISOString();

  const { data: started } = await admin
    .from("cert_attempts")
    .update({ status: "in_progress", started_at: now.toISOString(), deadline_at: deadline })
    .eq("id", id)
    .eq("status", "ready")
    .select("deadline_at");

  if (!started?.length) {
    const { data: again } = await admin.from("cert_attempts").select("deadline_at").eq("id", id).single();
    return NextResponse.json({ deadline_at: again?.deadline_at ?? null });
  }
  return NextResponse.json({ deadline_at: started[0].deadline_at });
}
