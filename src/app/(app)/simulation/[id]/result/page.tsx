import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DebriefLoader } from "@/components/sim/debrief-loader";
import type { PastRound } from "@/components/sim/sim-room";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Run result" };

const crore = (n: number) => `₹${(n / 10_000_000).toFixed(2)} cr`;

export default async function SimResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/simulation/${id}/result`);

  const admin = createAdminClient();
  const { data: run } = await admin
    .from("sim_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!run || run.user_id !== user.id) notFound();
  if (run.status === "live") redirect(`/simulation/${id}`);

  const { data: rows } = await admin
    .from("sim_rounds")
    .select("round, decisions, outcome")
    .eq("run_id", id)
    .gt("round", 0)
    .order("round", { ascending: true });

  const history = (rows ?? []) as unknown as PastRound[];
  const debrief = run.debrief ?? {};
  const hasDebrief = Object.keys(debrief).length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/simulation" className="text-sm text-muted-foreground hover:text-foreground">
        ← Simulation
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {run.status === "bankrupt" ? "Bankrupt" : "Run complete"}
        </h1>
        {run.status === "bankrupt" && <Badge variant="destructive">ran out of credit</Badge>}
      </div>

      <Card className="mt-5">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Final score
            </p>
            <p className="mt-1 text-3xl font-semibold tabular">
              {crore(run.final_score ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Cumulative profit
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-semibold tabular",
                run.cumulative_profit >= 0 ? "text-[var(--success)]" : "text-destructive",
              )}
            >
              {crore(run.cumulative_profit)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Quarters played
            </p>
            <p className="mt-1 text-3xl font-semibold tabular">{history.length}</p>
          </div>
        </CardContent>
      </Card>

      {hasDebrief ? (
        <div className="mt-5 space-y-4">
          {debrief.verdict && (
            <Card>
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed">{debrief.verdict}</p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {debrief.strengths?.length ? (
              <Card>
                <CardContent className="p-5">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--success)]">
                    <CheckCircle2 className="size-4" /> What worked
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {debrief.strengths.map((s) => (
                      <li key={s}>· {s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            {debrief.weaknesses?.length ? (
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-[var(--warning)]">
                    Next run
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {debrief.weaknesses.map((w) => (
                      <li key={w}>· {w}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <DebriefLoader runId={id} />
        </div>
      )}

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Every quarter
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {["Q", "Price", "Mktg", "R&D", "Capex", "Sold", "Lost", "Share", "Profit", "Debt"].map(
                (h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => {
              const f = h.outcome.firms[0];
              const d = h.decisions;
              return (
                <tr key={h.round} className="border-t">
                  <td className="px-3 py-2 tabular">{h.round}</td>
                  <td className="px-3 py-2 tabular">{d.price}</td>
                  <td className="px-3 py-2 tabular">{(d.marketing / 100_000).toFixed(0)}L</td>
                  <td className="px-3 py-2 tabular">{(d.rnd / 100_000).toFixed(0)}L</td>
                  <td className="px-3 py-2 tabular">
                    {(d.capacityInvestment / 100_000).toFixed(0)}L
                  </td>
                  <td className="px-3 py-2 tabular">{f.unitsSold.toLocaleString()}</td>
                  <td
                    className={cn("px-3 py-2 tabular", f.lostSales > 0 && "text-[var(--warning)]")}
                  >
                    {f.lostSales > 0 ? f.lostSales.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 tabular">{f.share}%</td>
                  <td
                    className={cn(
                      "px-3 py-2 tabular",
                      f.profit >= 0 ? "text-[var(--success)]" : "text-destructive",
                    )}
                  >
                    {crore(f.profit)}
                  </td>
                  <td className={cn("px-3 py-2 tabular", f.debt > 0 && "text-destructive")}>
                    {f.debt > 0 ? crore(f.debt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
