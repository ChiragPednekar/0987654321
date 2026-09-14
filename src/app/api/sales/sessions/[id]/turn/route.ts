import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buyerTurn } from "@/lib/ai/sales";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import type { SalesScenarioRow } from "@/lib/types/database";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().trim().min(1).max(2_000) });

/**
 * One exchange: the seller speaks, the buyer answers.
 *
 * Nothing is written until the buyer has replied. The session row is then
 * advanced only if its turn count is still the one this request read, so a
 * double-click or a second tab cannot run two turns against the same state —
 * the loser gets a 409 and nothing of it is stored. A failed model call stores
 * nothing either; the client keeps the unsent text.
 */
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
    .from("sales_sessions")
    .select("id, user_id, scenario_id, status, uncovered, resolved, turns")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your meeting." }, { status: 403 });
  }
  if (session.status !== "live") {
    return NextResponse.json({ error: "This meeting has ended." }, { status: 409 });
  }

  // The buyer's brief, needs, objections and rule are not granted to clients;
  // the service role is the only way they are read.
  const { data: scenario } = await admin
    .from("sales_scenarios")
    .select("*")
    .eq("id", session.scenario_id)
    .maybeSingle<SalesScenarioRow>();
  if (!scenario) return NextResponse.json({ error: "Scenario missing." }, { status: 500 });

  const { data: history } = await admin
    .from("sales_messages")
    .select("role, content")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const turn = session.turns + 1;

  try {
    const result = await buyerTurn({
      scenario: {
        sharedBrief: scenario.shared_brief,
        buyerRole: scenario.buyer_role,
        buyerBrief: scenario.buyer_brief,
        studentRole: scenario.student_role,
        needs: scenario.needs,
        objections: scenario.objections,
        buyRule: scenario.buy_rule,
        maxTurns: scenario.max_turns,
      },
      state: { uncovered: session.uncovered, resolved: session.resolved },
      history: history ?? [],
      studentMessage: body.message,
      turn,
    });

    void recordUsage(admin, {
      userId: user.id,
      operation: "interview",
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      totalTokens: result.tokensUsed,
    });

    if (result.overrode) {
      console.warn("[sales] model tried to buy before the rule was met", { session: id, turn });
    }

    const { data: advanced } = await admin
      .from("sales_sessions")
      .update({
        uncovered: result.state.uncovered,
        resolved: result.state.resolved,
        turns: turn,
        status: result.outcome,
        outcome_reason: result.reason,
        ...(result.outcome !== "live" ? { ended_at: new Date().toISOString() } : {}),
      })
      .eq("id", id)
      .eq("status", "live")
      .eq("turns", session.turns)
      .select("id");

    if (!advanced || advanced.length === 0) {
      return NextResponse.json(
        { error: "That message crossed with another one. Reload to see the meeting." },
        { status: 409 },
      );
    }

    const now = Date.now();
    // Both rows carry every key: PostgREST rejects a bulk insert whose objects
    // differ in shape ("All object keys must match"), and did so silently here
    // until the error was checked.
    const { error: messageError } = await admin.from("sales_messages").insert([
      {
        session_id: id,
        role: "student",
        content: body.message,
        overridden: false,
        created_at: new Date(now).toISOString(),
      },
      {
        session_id: id,
        role: "buyer",
        content: result.message,
        overridden: result.overrode,
        created_at: new Date(now + 1).toISOString(),
      },
    ]);
    if (messageError) {
      // The turn has already advanced, so the transcript is now missing an
      // exchange the review will not see. Loud, because it should never happen.
      console.error("[sales] could not store the exchange", { session: id, turn, error: messageError.message });
    }

    return NextResponse.json({
      message: result.message,
      outcome: result.outcome,
      turn,
      maxTurns: scenario.max_turns,
    });
  } catch (err) {
    console.error("[sales] turn failed", err);
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy. Wait about ${wait} seconds and send again.`
            : "The AI is busy. Wait a moment and send again.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "The buyer did not respond. Send your message again." }, { status: 500 });
  }
}
