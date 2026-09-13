import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";
import { newFirm } from "@/lib/sim/engine";

export const dynamic = "force-dynamic";

/**
 * Starts a run.
 *
 * No quota and no Pro gate. The simulation costs nothing to run — the market
 * is arithmetic, not a model call — so metering it would price something that
 * is free. Only the one-off debrief at the end touches the AI.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  if (!(await canSolve(admin, user.id))) {
    return NextResponse.json(SOLVE_DENIAL, { status: 403 });
  }

  const { data: run, error } = await admin
    .from("sim_runs")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error || !run) {
    console.error("[sim] create failed", error?.message);
    return NextResponse.json({ error: "Could not start a run." }, { status: 500 });
  }

  // Round 0 holds the opening state, so round 1 has an input and the run can
  // be replayed from the very beginning rather than from after the first move.
  await admin.from("sim_rounds").insert({
    run_id: run.id,
    round: 0,
    decisions: {},
    outcome: {},
    states: [newFirm("You"), newFirm("Meridian"), newFirm("Apex")],
  });

  return NextResponse.json({ id: run.id }, { status: 201 });
}
