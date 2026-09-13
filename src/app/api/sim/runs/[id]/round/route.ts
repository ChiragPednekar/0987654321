import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  finalScore,
  rivalDecisions,
  SIM,
  simulateRound,
  type FirmState,
} from "@/lib/sim/engine";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  price: z.number().int().min(100).max(10_000),
  marketing: z.number().int().min(0).max(500_000_000),
  rnd: z.number().int().min(0).max(500_000_000),
  capacity_investment: z.number().int().min(0).max(500_000_000),
});

/**
 * Plays one quarter.
 *
 * Simulated on the server from the stored state, never from anything the
 * client sends beyond the four decisions. The engine is pure and also runs in
 * the browser so a student can preview a round before committing, but a
 * preview is a projection — this is the only place a round becomes real.
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
    return NextResponse.json({ error: "Invalid decisions" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: run } = await admin
    .from("sim_runs")
    .select("id, user_id, status, current_round, cumulative_profit")
    .eq("id", id)
    .maybeSingle();

  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  if (run.user_id !== user.id) {
    return NextResponse.json({ error: "Not your run." }, { status: 403 });
  }
  if (run.status !== "live") {
    return NextResponse.json({ error: "This run has finished." }, { status: 409 });
  }

  // The previous round's stored state is the input. Reading it rather than
  // trusting a client-held state is what stops a player editing their own cash.
  const { data: previous } = await admin
    .from("sim_rounds")
    .select("states")
    .eq("run_id", id)
    .eq("round", run.current_round - 1)
    .maybeSingle();

  if (!previous) {
    return NextResponse.json({ error: "Run state is missing." }, { status: 500 });
  }

  const states = previous.states as FirmState[];
  const mine = {
    price: body.price,
    marketing: body.marketing,
    rnd: body.rnd,
    capacityInvestment: body.capacity_investment,
  };

  const { outcome, next } = simulateRound(run.current_round, states, [
    mine,
    rivalDecisions(states[1], run.current_round, mine.price),
    rivalDecisions(states[2], run.current_round, mine.price),
  ]);

  const cumulativeProfit = run.cumulative_profit + outcome.firms[0].profit;
  const lastRound = run.current_round >= SIM.rounds;
  const status = outcome.bankrupt ? "bankrupt" : lastRound ? "completed" : "live";

  const { error: roundError } = await admin.from("sim_rounds").insert({
    run_id: id,
    round: run.current_round,
    decisions: mine,
    outcome,
    states: next,
  });

  if (roundError) {
    console.error("[sim] round insert failed", roundError.message);
    return NextResponse.json({ error: "Could not save the quarter." }, { status: 500 });
  }

  await admin
    .from("sim_runs")
    .update({
      current_round: run.current_round + 1,
      cumulative_profit: cumulativeProfit,
      status,
      final_score:
        status === "live" ? null : finalScore(next[0], cumulativeProfit),
      ended_at: status === "live" ? null : new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({
    outcome,
    status,
    round: run.current_round,
    next_round: run.current_round + 1,
    total_rounds: SIM.rounds,
    cumulative_profit: cumulativeProfit,
    final_score: status === "live" ? null : finalScore(next[0], cumulativeProfit),
  });
}
