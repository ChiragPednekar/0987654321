import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireTeacherActor } from "@/lib/authz";
import { OBJECTIVE_TRACK_VALUES } from "@/lib/objective";
import { internalError } from "@/lib/http-errors";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    track: z.enum(OBJECTIVE_TRACK_VALUES),
    topic: z.string().trim().min(2).max(60),
    difficulty: z.enum(["easy", "medium", "hard"]),
    context: z.string().trim().max(2_000).optional().nullable(),
    stem: z.string().trim().min(5).max(2_000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    correct_index: z.number().int().min(0),
    explanation: z.string().trim().min(5).max(3_000),
  })
  .refine((b) => b.correct_index < b.options.length, {
    message: "Mark one of the options as correct.",
    path: ["correct_index"],
  })
  .refine((b) => new Set(b.options.map((o) => o.toLowerCase())).size === b.options.length, {
    message: "Two options are the same.",
    path: ["options"],
  });

/**
 * Lets any teacher add their own aptitude question.
 *
 * Stored in the same table as the platform bank so a quiz can mix the two, but
 * unpublished and owned by the teacher: it never enters the public practice
 * pool (which only draws published questions), and only its author sees it in
 * the library — the track page lists published questions plus the viewer's
 * own. Students meet it only inside a quiz their teacher assigns, served by
 * the service role. The answer key stays server-side throughout, as for every
 * other question (20250101000037).
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? `${error.issues[0]?.path.join(".")}: ${error.issues[0]?.message}`
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data: created, error } = await createAdminClient()
    .from("objective_questions")
    .insert({
      track: body.track,
      topic: body.topic,
      difficulty: body.difficulty,
      context: body.context || null,
      stem: body.stem,
      options: body.options,
      correct_index: body.correct_index,
      explanation: body.explanation,
      source: "teacher",
      is_published: false,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return internalError("teacher", error, "Could not save the question.");
  }

  await audit(actor, "aptitude_question.create", "objective_questions", created.id, {
    track: body.track,
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
