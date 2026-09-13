import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { debriefRun } from "@/lib/ai/sim-debrief";
import { RateLimitError } from "@/lib/ai/errors";
import { recordUsage } from "@/lib/usage";
import type { Decisions, RoundOutcome } from "@/lib/sim/engine";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Reads a finished run and writes the debrief. One model call, once. */
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

  const { data: run } = await admin
    .from("sim_runs")
    .select("id, user_id, status, cumulative_profit, final_score, debrief")
    .eq("id", id)
    .maybeSingle();

  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (run.user_id !== user.id) {
    return NextResponse.json({ error: "Not your run." }, { status: 403 });
  }
  if (run.status === "live") {
    return NextResponse.json({ error: "This run is still going." }, { status: 409 });
  }
  // Already written. Returned rather than regenerated, so refreshing the
  // result page does not buy a second opinion at a second cost.
  if (run.debrief && Object.keys(run.debrief).length > 0) {
    return NextResponse.json({ debrief: run.debrief, cached: true });
  }

  const { data: rows } = await admin
    .from("sim_rounds")
    .select("round, decisions, outcome")
    .eq("run_id", id)
    .gt("round", 0)
    .order("round", { ascending: true });

  const rounds = (rows ?? []).map((r) => ({
    round: r.round,
    decisions: r.decisions as Decisions,
    outcome: r.outcome as RoundOutcome,
  }));

  if (rounds.length === 0) {
    return NextResponse.json({ error: "Nothing to debrief." }, { status: 409 });
  }

  try {
    const debrief = await debriefRun(
      rounds,
      run.status === "bankrupt" ? "bankrupt" : "completed",
      run.cumulative_profit,
      run.final_score ?? 0,
    );

    void recordUsage(admin, {
      userId: user.id,
      operation: "grading",
      model: debrief.model,
      inputTokens: debrief.inputTokens,
      outputTokens: debrief.outputTokens,
      cachedTokens: debrief.cachedTokens,
      totalTokens: debrief.tokensUsed,
    });

    const stored = {
      strengths: debrief.strengths,
      weaknesses: debrief.weaknesses,
      verdict: debrief.verdict,
    };
    await admin.from("sim_runs").update({ debrief: stored }).eq("id", id);

    return NextResponse.json({ debrief: stored });
  } catch (err) {
    console.error("[sim] debrief failed", err);
    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy. Wait about ${wait} seconds and reload — your run is saved.`
            : "The AI is busy. Wait a moment and reload — your run is saved.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Could not write the debrief." }, { status: 500 });
  }
}
