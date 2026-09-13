import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callChat } from "@/lib/ai/chat";
import { buildPiSystemPrompt } from "@/lib/ai/pi-interview";
import { recordUsage } from "@/lib/usage";
import { RateLimitError } from "@/lib/ai/errors";
import { PI_MAX_QUESTIONS } from "@/lib/pi";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4_000),
});

/** One candidate turn, and the interviewer's next question. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data: session } = await admin
    .from("pi_sessions")
    .select("id, user_id, kind, target_firm, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your interview." }, { status: 403 });
  }
  if (session.status !== "live") {
    return NextResponse.json({ error: "This interview has ended." }, { status: 409 });
  }

  const [{ data: profile }, { data: history }] = await Promise.all([
    admin
      .from("pi_profiles")
      .select("background, target_role")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("pi_messages")
      .select("role, content")
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const turns = history ?? [];
  const questionsAsked = turns.filter((t) => t.role === "interviewer").length;

  // Recorded before the model is called. If the reply fails, the candidate's
  // answer is still on the record and the interview can be resumed rather than
  // silently losing what they just typed.
  await admin.from("pi_messages").insert({
    session_id: id,
    role: "candidate",
    content: body.message,
  });

  const system = buildPiSystemPrompt({
    kind: session.kind,
    background: profile?.background ?? "",
    targetRole: profile?.target_role ?? null,
    targetFirm: session.target_firm,
    questionsAsked,
    maxQuestions: PI_MAX_QUESTIONS,
  });

  try {
    const reply = await callChat(system, [
      ...turns.map((t) => ({ role: t.role, content: t.content })),
      { role: "candidate" as const, content: body.message },
    ]);

    await admin.from("pi_messages").insert({
      session_id: id,
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

    return NextResponse.json({
      message: reply.content,
      questions_asked: questionsAsked + 1,
      max_questions: PI_MAX_QUESTIONS,
      // The client uses this to offer "finish and get assessed" rather than
      // leaving the student guessing when a round is over.
      closing: questionsAsked + 1 >= PI_MAX_QUESTIONS,
    });
  } catch (err) {
    console.error("[pi] reply failed", err);
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy right now. Wait about ${wait} seconds and try again — nothing has been lost.`
            : "The AI is busy right now. Wait a moment and try again — nothing has been lost.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "The interviewer did not respond. Your answer was saved — try again." },
      { status: 500 },
    );
  }
}
