import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SimRoom, type PastRound } from "@/components/sim/sim-room";

export const metadata: Metadata = { title: "Simulation" };

export default async function SimRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/simulation/${id}`);

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("sim_runs")
    .select("id, user_id, status, current_round")
    .eq("id", id)
    .maybeSingle();

  if (!run || run.user_id !== user.id) notFound();
  if (run.status !== "live") redirect(`/simulation/${id}/result`);

  const { data: rows } = await admin
    .from("sim_rounds")
    .select("round, decisions, outcome")
    .eq("run_id", id)
    .gt("round", 0)
    .order("round", { ascending: true });

  const history = (rows ?? []) as unknown as PastRound[];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <SimRoom
        runId={id}
        currentRound={run.current_round}
        history={history}
        status={run.status}
      />
    </div>
  );
}
