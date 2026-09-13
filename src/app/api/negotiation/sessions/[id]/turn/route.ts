import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { counterpartyTurn } from "@/lib/ai/negotiate";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import {
  isComplete,
  scoreDeal,
  type NegotiationSetup,
  type Terms,
} from "@/lib/negotiation/engine";
import type { NegotiationCaseRow } from "@/lib/types/database";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(3_000),
  /** Complete terms when the student is making an offer; omitted when talking. */
  offer: z.record(z.string(), z.string()).nullable().optional(),
});

/** One exchange: the student speaks, the counterparty answers. */
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
    .from("negotiation_sessions")
    .select("id, user_id, case_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your negotiation." }, { status: 403 });
  }
  if (session.status !== "live") {
    return NextResponse.json({ error: "This negotiation has ended." }, { status: 409 });
  }

  // Read with the service role: the counterparty's payoffs and brief are not
  // granted to `authenticated` at all, and this is the only place they are
  // loaded.
  const { data: kase } = await admin
    .from("negotiation_cases")
    .select("*")
    .eq("id", session.case_id)
    .maybeSingle<NegotiationCaseRow>();

  if (!kase) return NextResponse.json({ error: "Case missing." }, { status: 500 });

  const setup: NegotiationSetup = {
    issues: kase.issues,
    studentPayoffs: kase.student_payoffs,
    counterpartyPayoffs: kase.counterparty_payoffs,
    studentBatna: kase.student_batna,
    counterpartyBatna: kase.counterparty_batna,
  };

  // An offer only counts if every issue is settled. A partial one is treated
  // as conversation, which is what it is.
  const studentOffer =
    body.offer && isComplete(setup.issues, body.offer as Terms)
      ? (body.offer as Terms)
      : null;

  const { data: history } = await admin
    .from("negotiation_messages")
    .select("role, content, offer")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  await admin.from("negotiation_messages").insert({
    session_id: id,
    role: "student",
    content: body.message,
    offer: studentOffer,
  });

  try {
    const turn = await counterpartyTurn({
      setup,
      sharedBrief: kase.shared_brief,
      role: kase.counterparty_role,
      brief: kase.counterparty_brief,
      history: (history ?? []).map((h) => ({
        role: h.role,
        content: h.content,
        offer: h.offer,
      })),
      studentMessage: body.message,
      studentOffer,
    });

    if (turn.overrode) {
      // Worth seeing in the logs: it means the model was argued past its own
      // position and the engine caught it.
      console.warn("[negotiation] model tried to accept below its BATNA", { session: id });
    }

    void recordUsage(admin, {
      userId: user.id,
      operation: "interview",
      model: turn.model,
      inputTokens: turn.inputTokens,
      outputTokens: turn.outputTokens,
      cachedTokens: turn.cachedTokens,
      totalTokens: turn.tokensUsed,
    });

    await admin.from("negotiation_messages").insert({
      session_id: id,
      role: "counterparty",
      content: turn.message,
      offer: turn.offer,
    });

    if (turn.accepted && studentOffer) {
      const card = scoreDeal(setup, studentOffer);
      await admin
        .from("negotiation_sessions")
        .update({
          status: "deal",
          agreed_terms: studentOffer,
          student_score: card.studentScore,
          counterparty_score: card.counterpartyScore,
          joint_value: card.jointValue,
          max_joint: card.maxJoint,
          efficiency_pct: card.efficiencyPct,
          beat_batna: card.beatBatna,
          ended_at: new Date().toISOString(),
        })
        .eq("id", id);

      return NextResponse.json({ message: turn.message, accepted: true, deal: card });
    }

    return NextResponse.json({
      message: turn.message,
      offer: turn.offer,
      accepted: false,
    });
  } catch (err) {
    console.error("[negotiation] turn failed", err);
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy. Wait about ${wait} seconds and send again — your message is saved.`
            : "The AI is busy. Wait a moment and send again — your message is saved.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "The counterparty did not respond. Your message was saved — try again." },
      { status: 500 },
    );
  }
}
