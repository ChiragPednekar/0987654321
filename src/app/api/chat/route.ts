import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callChat, interviewerSystemPrompt, type ChatTurn } from "@/lib/ai/chat";
import { RATE_LIMIT } from "@/lib/constants";

// A model turn takes several seconds; the default function timeout is tight.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  // Omitted on the opening turn, when the interviewer speaks first.
  session_id: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4_000).optional(),
});

/** Beyond this the transcript is long enough that the interview should close. */
const MAX_TURNS = 30;

export interface ChatResponse {
  session_id: string;
  reply: string;
  turn: number;
  closed: boolean;
}

/**
 * One turn of the Case Chat interviewer (spec §6).
 *
 * Every write goes through the service role. The transcript is the record of
 * what happened in the interview, so a client that could insert into it could
 * fabricate its own answers — and, since the model reads the history back as
 * context, could talk the interviewer into anything.
 */
export async function POST(request: NextRequest) {
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

  // Same database-backed limiter the grading route uses, for the same reason:
  // it has to hold across serverless instances.
  const since = new Date(Date.now() - RATE_LIMIT.windowMs).toISOString();
  const { count: recent } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "candidate")
    .gte("created_at", since)
    .in(
      "session_id",
      (
        await admin.from("chat_sessions").select("id").eq("user_id", user.id)
      ).data?.map((s) => s.id) ?? ["00000000-0000-0000-0000-000000000000"],
    );

  if ((recent ?? 0) >= RATE_LIMIT.maxEvaluations * 4) {
    return NextResponse.json(
      { error: "Too many messages. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const { data: caseData } = await admin
    .from("cases")
    .select(
      "id, title, domain, difficulty, scenario, instructions, expected_framework, model_answer, is_published",
    )
    .eq("id", body.case_id)
    .maybeSingle();

  if (!caseData || !caseData.is_published) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // ---- resolve the session -------------------------------------------------
  let sessionId = body.session_id;

  if (sessionId) {
    const { data: session } = await admin
      .from("chat_sessions")
      .select("id, user_id, ended_at")
      .eq("id", sessionId)
      .maybeSingle();

    // Checking ownership explicitly: the service role bypasses RLS, so without
    // this any signed-in user could post into anyone's interview.
    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.ended_at) {
      return NextResponse.json(
        { error: "This interview has already finished." },
        { status: 409 },
      );
    }
  } else {
    const { data: created, error } = await admin
      .from("chat_sessions")
      .insert({ user_id: user.id, case_id: caseData.id })
      .select("id")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: "Could not start the interview." },
        { status: 500 },
      );
    }
    sessionId = created.id;
  }

  // ---- history -------------------------------------------------------------
  const { data: history } = await admin
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const turns: ChatTurn[] = (history ?? []).map((m) => ({
    role: m.role as ChatTurn["role"],
    content: m.content,
  }));

  if (body.message) {
    await admin.from("chat_messages").insert({
      session_id: sessionId,
      role: "candidate",
      content: body.message,
    });
    turns.push({ role: "candidate", content: body.message });
  } else if (turns.length > 0) {
    // No message and a transcript already exists means a duplicate open.
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  // Gemini and Anthropic both reject a history that opens on an assistant
  // turn, so the very first request seeds a candidate turn instead of an
  // empty array.
  if (turns.length === 0) {
    turns.push({
      role: "candidate",
      content: "I'm ready — please introduce the case.",
    });
  }

  // ---- model ---------------------------------------------------------------
  let reply;
  try {
    reply = await callChat(interviewerSystemPrompt(caseData), turns);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Interviewer unavailable: ${error.message}`
            : "Interviewer unavailable.",
      },
      { status: 502 },
    );
  }

  await admin.from("chat_messages").insert({
    session_id: sessionId,
    role: "interviewer",
    content: reply.content,
  });

  const turnCount = turns.length + 1;

  // The prompt asks the interviewer to close itself; this is the backstop so a
  // session cannot run forever and cost tokens indefinitely.
  const closed =
    turnCount >= MAX_TURNS || /interview is complete/i.test(reply.content);

  if (closed) {
    await admin
      .from("chat_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return NextResponse.json<ChatResponse>({
    session_id: sessionId,
    reply: reply.content,
    turn: turnCount,
    closed,
  });
}
