import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expertForUser } from "@/lib/experts";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), feedback: z.string().trim().min(40).max(5000) }),
  z.object({ action: z.literal("no_show") }),
  z.object({ action: z.literal("review"), rating: z.number().int().min(1).max(5), review: z.string().trim().max(1500).default("") }),
]);

/**
 * After a session. The expert marks it done with written feedback (or marks a
 * no-show); the student then rates it. Each side can only do its own part,
 * and only once the session's start time has passed.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("expert_bookings")
    .select("id, expert_id, student_id, status, rating, slot_id")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const { data: slot } = await admin.from("expert_slots").select("starts_at").eq("id", booking.slot_id).single();
  const started = slot ? new Date(slot.starts_at).getTime() <= Date.now() : false;

  if (parsed.data.action === "review") {
    if (booking.student_id !== user.id) return NextResponse.json({ error: "Not your booking." }, { status: 403 });
    if (booking.status !== "completed") return NextResponse.json({ error: "You can rate a session once the expert has marked it done." }, { status: 409 });
    if (booking.rating) return NextResponse.json({ error: "Already rated." }, { status: 409 });
    await admin.from("expert_bookings").update({ rating: parsed.data.rating, review: parsed.data.review || null }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  const expert = await expertForUser(admin, user.id);
  if (!expert || expert.id !== booking.expert_id) return NextResponse.json({ error: "Not your session." }, { status: 403 });
  if (!started) return NextResponse.json({ error: "The session has not started yet." }, { status: 409 });
  if (booking.status !== "confirmed") return NextResponse.json({ error: "This session is already closed." }, { status: 409 });

  const update =
    parsed.data.action === "complete"
      ? { status: "completed" as const, expert_feedback: parsed.data.feedback, completed_at: new Date().toISOString() }
      : { status: "no_show" as const, completed_at: new Date().toISOString() };
  await admin.from("expert_bookings").update(update).eq("id", id).eq("status", "confirmed");

  if (parsed.data.action === "complete") {
    await admin.from("notifications").insert({
      user_id: booking.student_id,
      type: "system",
      title: "Your interview feedback is ready",
      body: `${expert.display_name} has written up your mock interview.`,
      href: "/experts/sessions",
    });
  }
  return NextResponse.json({ ok: true });
}
