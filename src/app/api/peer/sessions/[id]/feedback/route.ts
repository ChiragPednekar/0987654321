import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  to_user: z.string().uuid(),
  breakdown: z.record(z.string(), z.number().min(0)),
  notes: z.string().trim().max(4_000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * One participant's verdict on the other.
 *
 * Both people are checked against the session row rather than trusted from the
 * body: the room id is shared in a public lobby, so it cannot be enough on its
 * own to write feedback about somebody.
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

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("peer_sessions")
    .select("id, case_id, host_id, guest_id")
    .eq("id", id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const participants = [session.host_id, session.guest_id].filter(Boolean);
  if (!participants.includes(user.id)) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }
  if (!participants.includes(body.to_user) || body.to_user === user.id) {
    return NextResponse.json(
      { error: "You can only mark the other person in the room." },
      { status: 400 },
    );
  }

  // Clamp to the rubric, exactly as AI grading does — a peer cannot award 40
  // out of a criterion worth 20, by accident or otherwise.
  const { data: rubric } = await admin
    .from("rubrics")
    .select("criteria, max_score")
    .eq("case_id", session.case_id)
    .maybeSingle();

  const criteria = (rubric?.criteria ?? {}) as Record<string, number>;
  const clamped: Record<string, number> = {};
  for (const [key, weight] of Object.entries(criteria)) {
    clamped[key] = Math.max(0, Math.min(Number(body.breakdown[key] ?? 0), Number(weight)));
  }
  const total = Object.values(clamped).reduce((a, b) => a + b, 0);

  const { error } = await admin.from("peer_feedback").upsert(
    {
      session_id: id,
      from_user: user.id,
      to_user: body.to_user,
      breakdown: clamped,
      total_score: total,
      max_score: rubric?.max_score ?? null,
      notes: body.notes ?? null,
    },
    { onConflict: "session_id,from_user" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("notifications").insert({
    user_id: body.to_user,
    type: "system",
    title: `Peer feedback — ${total}${rubric?.max_score ? `/${rubric.max_score}` : ""}`,
    body: "Your partner marked your interview.",
    href: `/peer/${id}`,
  });

  return NextResponse.json({ ok: true, total_score: total });
}
