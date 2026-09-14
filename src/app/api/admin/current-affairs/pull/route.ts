import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAdminActor } from "@/lib/authz";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question_id: z.string().uuid(),
  pulled: z.boolean(),
});

/**
 * Pulls a daily-quiz question, or restores it.
 *
 * Pulling does not delete: past attempts keep their answers, and scoring skips
 * a pulled question for everyone (scoreAttempt), so the correction reaches
 * students who already answered as well as those who have not.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ca_questions")
    .update({
      is_pulled: body.pulled,
      pulled_at: body.pulled ? new Date().toISOString() : null,
      pulled_by: body.pulled ? actor.id : null,
    })
    .eq("id", body.question_id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  void audit(actor, body.pulled ? "ca_question.pull" : "ca_question.restore", "ca_questions", body.question_id);
  return NextResponse.json({ ok: true });
}
