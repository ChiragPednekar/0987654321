import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  topic_id: z.string().uuid().optional(),
  max_participants: z.number().int().min(2).max(6).default(6),
  prep_seconds: z.number().int().min(0).max(600).default(120),
  discussion_seconds: z.number().int().min(120).max(3600).default(600),
});

/** Opens a room, and puts the host in it. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  // A topic is picked at random when none is named, which is how a GD actually
  // works — the panel gives you the topic, you do not choose it.
  let topicId = body.topic_id;
  if (!topicId) {
    const { data: topics } = await admin
      .from("gd_topics")
      .select("id")
      .eq("is_published", true)
      .limit(200);
    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: "No topics available yet." }, { status: 404 });
    }
    topicId = topics[Math.floor(Math.random() * topics.length)].id;
  }

  const { data: session, error } = await admin
    .from("gd_sessions")
    .insert({
      topic_id: topicId,
      host_id: user.id,
      max_participants: body.max_participants,
      prep_seconds: body.prep_seconds,
      discussion_seconds: body.discussion_seconds,
    })
    .select("id")
    .single();

  if (error || !session) {
    console.error("[gd] create failed", error?.message);
    return NextResponse.json({ error: "Could not open the room." }, { status: 500 });
  }

  await admin
    .from("gd_participants")
    .insert({ session_id: session.id, user_id: user.id });

  return NextResponse.json({ id: session.id }, { status: 201 });
}
