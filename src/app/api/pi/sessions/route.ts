import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { getQuotaStatus, quotaDenial } from "@/lib/quota";
import { callChat } from "@/lib/ai/chat";
import { buildPiSystemPrompt } from "@/lib/ai/pi-interview";
import { PI_MAX_QUESTIONS } from "@/lib/pi";
import { recordUsage } from "@/lib/usage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["hr_fit", "resume_deep_dive", "why_firm", "stress"]).default("hr_fit"),
  target_firm: z.string().trim().max(120).optional().nullable(),
});

/** Starts an interview and returns the interviewer's opening question. */
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

  // Same gate and same allowance as the case interviewer: a multi-turn
  // conversation is the expensive operation on the platform, and there is no
  // reason for two kinds of interview to be metered differently.
  const quota = await getQuotaStatus(admin, user.id);
  if (!quota.isPro) {
    return NextResponse.json(
      {
        error: "Mock interviews are a Pro feature.",
        code: "pro_required",
      },
      { status: 402 },
    );
  }
  if (quota.interviewsLeft <= 0) {
    return NextResponse.json(quotaDenial("interviews", quota), { status: 402 });
  }

  const { data: profile } = await admin
    .from("pi_profiles")
    .select("background, target_role")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: session, error } = await admin
    .from("pi_sessions")
    .insert({
      user_id: user.id,
      kind: body.kind,
      target_firm: body.target_firm ?? null,
    })
    .select("id")
    .single();

  if (error || !session) {
    console.error("[pi] session insert failed", error?.message);
    return NextResponse.json({ error: "Could not start the interview." }, { status: 500 });
  }

  const system = buildPiSystemPrompt({
    kind: body.kind,
    background: profile?.background ?? "",
    targetRole: profile?.target_role ?? null,
    targetFirm: body.target_firm ?? null,
    questionsAsked: 0,
    maxQuestions: PI_MAX_QUESTIONS,
  });

  try {
    const reply = await callChat(system, [
      {
        role: "candidate",
        content:
          "(The candidate has sat down. Greet them briefly and ask your first question.)",
      },
    ]);

    await admin.from("pi_messages").insert({
      session_id: session.id,
      role: "interviewer",
      content: reply.content,
    });

    void recordUsage(admin, {
      userId: user.id,
      operation: "interview",
      model: reply.model,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      cachedTokens: reply.cachedTokens,
      totalTokens: reply.tokensUsed,
    });

    return NextResponse.json({ id: session.id, message: reply.content }, { status: 201 });
  } catch (err) {
    console.error("[pi] opening turn failed", err);
    // No opening question means no interview. Mark it abandoned rather than
    // leaving a live session the student can never resume.
    await admin.from("pi_sessions").update({ status: "abandoned" }).eq("id", session.id);
    return NextResponse.json({ error: "Could not start the interview." }, { status: 500 });
  }
}
