import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  topic_id: z.string().uuid().optional(),
  custom_topic_title: z.string().trim().min(3).max(200).optional(),
  custom_topic_prompt: z.string().trim().max(1000).optional(),
  classroom_id: z.string().uuid().optional(),
  join_policy: z.enum(["open", "approval"]).default("open"),
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

  let topicId = body.topic_id;
  if (!topicId && body.custom_topic_title) {
    const { data: newTopic } = await admin
      .from("gd_topics")
      .insert({
        title: body.custom_topic_title,
        prompt: body.custom_topic_prompt || undefined,
        category: "business",
        difficulty: "medium",
        is_published: false,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (newTopic) topicId = newTopic.id;
  }

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
      classroom_id: body.classroom_id ?? null,
      join_policy: body.join_policy,
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

  const { error: participantError } = await admin.from("gd_participants").insert({
    session_id: session.id,
    user_id: user.id,
    admission_status: "approved",
  });
  if (participantError) {
    console.error("[gd] host membership insert failed", participantError.message);
    await admin.from("gd_sessions").delete().eq("id", session.id);
    return NextResponse.json({ error: "Could not open the room." }, { status: 500 });
  }

  return NextResponse.json({ id: session.id }, { status: 201 });
}
