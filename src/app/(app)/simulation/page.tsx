import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StartRunButton } from "@/components/sim/start-run-button";
import { SIM } from "@/lib/sim/engine";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Business simulation" };

export default async function SimulationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/simulation");

  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("sim_runs")
    .select("id, status, current_round, final_score, started_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(10);

  const live = (runs ?? []).find((r) => r.status === "live");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Business simulation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {SIM.rounds} quarters running a manufacturer against two rivals. Set
        price, marketing, R&amp;D and capacity each quarter and live with what
        the market does.
      </p>

      <Card className="mt-6 border-muted">
        <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
          <p>
            The market is a fixed model, not an AI — the same decisions always
            produce the same result, so you can test an idea and learn from it.
            Unlimited, and it uses none of your AI allowance.
          </p>
          <p>
            Meridian competes on price. Apex holds a premium position and keeps
            investing in its product. Both react to what you charge.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6">
        {live ? (
          <Link
            href={`/simulation/${live.id}`}
            className="inline-flex rounded-md bg-action px-4 py-2 text-sm font-medium text-action-foreground hover:bg-action-hover"
          >
            Resume quarter {live.current_round}
          </Link>
        ) : (
          <StartRunButton />
        )}
      </div>

      {(runs ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold text-foreground">
            Your runs
          </h2>
          <div className="mt-3 space-y-2">
            {(runs ?? []).map((r) => (
              <Link
                key={r.id}
                href={r.status === "live" ? `/simulation/${r.id}` : `/simulation/${r.id}/result`}
              >
                <Card className="transition-colors hover:border-foreground/25">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {r.status === "live"
                          ? `Quarter ${r.current_round} of ${SIM.rounds}`
                          : r.status === "bankrupt"
                            ? "Bankrupt"
                            : "Completed"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(r.started_at)}
                      </p>
                    </div>
                    {r.final_score !== null ? (
                      <span className="text-sm font-semibold tabular">
                        ₹{(r.final_score / 10_000_000).toFixed(2)} cr
                      </span>
                    ) : (
                      <Badge variant="outline">in progress</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
