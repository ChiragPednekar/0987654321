import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { debriefSales } from "@/lib/ai/sales";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import type { SalesScenarioRow } from "@/lib/types/database";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Reviews a finished meeting. One model call, once; a reload returns the stored review. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sales_sessions")
    .select("id, user_id, scenario_id, status, uncovered, resolved, turns, outcome_reason, debrief")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your meeting." }, { status: 403 });
  }
  if (session.status === "live") {
    return NextResponse.json({ error: "This meeting is still going." }, { status: 409 });
  }
  if (session.debrief && Object.keys(session.debrief).length > 0) {
    return NextResponse.json({ debrief: session.debrief, cached: true });
  }

  const [{ data: scenario }, { data: messages }] = await Promise.all([
    admin.from("sales_scenarios").select("*").eq("id", session.scenario_id).maybeSingle<SalesScenarioRow>(),
    admin.from("sales_messages").select("role, content").eq("session_id", id).order("created_at"),
  ]);
  if (!scenario) return NextResponse.json({ error: "Scenario missing." }, { status: 500 });

  if (!messages || messages.length === 0) {
    const empty = {
      scores: {},
      strengths: [],
      improvements: ["Open the conversation — the review needs at least one exchange to say anything useful."],
      verdict: "The meeting ended before anything was said.",
    };
    await admin.from("sales_sessions").update({ debrief: empty }).eq("id", id);
    return NextResponse.json({ debrief: empty });
  }

  try {
    const review = await debriefSales({
      scenario: {
        sharedBrief: scenario.shared_brief,
        buyerRole: scenario.buyer_role,
        buyerBrief: scenario.buyer_brief,
        studentRole: scenario.student_role,
        studentBrief: scenario.student_brief,
        needs: scenario.needs,
        objections: scenario.objections,
        buyRule: scenario.buy_rule,
        maxTurns: scenario.max_turns,
      },
      transcript: messages,
      state: { uncovered: session.uncovered, resolved: session.resolved },
      outcome: session.status,
      reason: session.outcome_reason,
    });

    void recordUsage(admin, {
      userId: user.id,
      operation: "interview",
      model: review.model,
      inputTokens: review.inputTokens,
      outputTokens: review.outputTokens,
      cachedTokens: review.cachedTokens,
      totalTokens: review.tokensUsed,
    });

    const stored = {
      scores: review.scores,
      strengths: review.strengths,
      improvements: review.improvements,
      verdict: review.verdict,
    };
    await admin.from("sales_sessions").update({ debrief: stored }).eq("id", id);
    return NextResponse.json({ debrief: stored });
  } catch (err) {
    console.error("[sales] debrief failed", err);
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "The AI is busy. Wait a moment and reload — your meeting is saved.", code: "rate_limited" },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Could not write the review. Reload to try again." }, { status: 500 });
  }
}
