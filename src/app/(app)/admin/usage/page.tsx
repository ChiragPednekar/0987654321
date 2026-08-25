import type { Metadata } from "next";
import { Cpu } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { MODEL_RATES, QUOTA } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "AI usage" };

function rupees(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default async function UsagePage() {
  const admin = createAdminClient();

  const [{ data: events }, { data: institutions }] = await Promise.all([
    // Capped: a usage table grows without bound, and the dashboard should not
    // start timing out once it does. Aggregates below are over this window.
    admin
      .from("usage_events")
      .select("operation, model, input_tokens, output_tokens, total_tokens, cost_inr, institution_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(5_000),
    admin.from("institutions").select("id, name, seats_licensed"),
  ]);

  const rows = events ?? [];

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI usage</h1>
        <Card className="mt-6">
          <CardContent className="p-6 text-center">
            <Cpu className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No AI usage recorded yet. This fills in once students start being
              graded or run mock interviews.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Every call records its own tokens and cost, so these figures are
              measured rather than estimated.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gradings = rows.filter((r) => r.operation === "grading");
  const interviews = rows.filter((r) => r.operation === "interview");
  const totalCost = rows.reduce((a, r) => a + Number(r.cost_inr), 0);
  const uniqueUsers = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;

  const byInstitution = new Map<string, { cost: number; n: number; users: Set<string> }>();
  for (const r of rows) {
    const key = r.institution_id ?? "unlicensed";
    const e = byInstitution.get(key) ?? { cost: 0, n: 0, users: new Set<string>() };
    e.cost += Number(r.cost_inr);
    e.n += 1;
    if (r.user_id) e.users.add(r.user_id);
    byInstitution.set(key, e);
  }

  const instName = new Map((institutions ?? []).map((i) => [i.id, i.name]));

  const byModel = new Map<string, { cost: number; n: number; tokens: number }>();
  for (const r of rows) {
    const key = r.model ?? "unknown";
    const e = byModel.get(key) ?? { cost: 0, n: 0, tokens: 0 };
    e.cost += Number(r.cost_inr);
    e.n += 1;
    e.tokens += r.total_tokens;
    byModel.set(key, e);
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Measured per call, priced at the rates in force when it ran.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total spend" value={rupees(totalCost)}
          sublabel={`${formatNumber(rows.length)} calls`} icon={Cpu} />
        <StatCard label="Graded answers" value={formatNumber(gradings.length)}
          sublabel={rupees(gradings.reduce((a, r) => a + Number(r.cost_inr), 0))} icon={Cpu} />
        <StatCard label="Interviews" value={formatNumber(interviews.length)}
          sublabel={rupees(interviews.reduce((a, r) => a + Number(r.cost_inr), 0))} icon={Cpu} />
        <StatCard label="Cost per student"
          value={uniqueUsers ? rupees(totalCost / uniqueUsers) : "—"}
          sublabel={`${formatNumber(uniqueUsers)} students`} icon={Cpu} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Spend by institution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Institution</th>
                  <th className="py-2 text-right font-medium">Calls</th>
                  <th className="py-2 text-right font-medium">Students</th>
                  <th className="py-2 text-right font-medium">Spend</th>
                  <th className="py-2 text-right font-medium">Per student</th>
                </tr>
              </thead>
              <tbody>
                {[...byInstitution.entries()]
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([id, v]) => (
                    <tr key={id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        {id === "unlicensed" ? (
                          <span className="text-muted-foreground">
                            Retail / unlicensed
                          </span>
                        ) : (
                          (instName.get(id) ?? id.slice(0, 8))
                        )}
                      </td>
                      <td className="py-2 text-right tabular">{formatNumber(v.n)}</td>
                      <td className="py-2 text-right tabular">{formatNumber(v.users.size)}</td>
                      <td className="py-2 text-right tabular">{rupees(v.cost)}</td>
                      <td className="py-2 text-right tabular">
                        {v.users.size ? rupees(v.cost / v.users.size) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Spend by model</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[...byModel.entries()]
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([model, v]) => (
                <li key={model} className="flex items-center gap-3 text-sm">
                  <span className="w-48 shrink-0 truncate font-mono text-xs">
                    {model}
                  </span>
                  <Progress value={(v.cost / totalCost) * 100} className="flex-1" />
                  <span className="w-24 shrink-0 text-right tabular">
                    {rupees(v.cost)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular">
                    {formatNumber(v.tokens)} tok
                  </span>
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Priced at ${MODEL_RATES.inputPerMillionUsd}/1M input and $
        {MODEL_RATES.outputPerMillionUsd}/1M output at ₹{MODEL_RATES.usdInr}/$1.
        Fair use is {QUOTA.pro.gradings} graded answers and{" "}
        {QUOTA.pro.interviews} interviews per student per {QUOTA.windowDays}{" "}
        days unless a licence overrides it. Showing the most recent 5,000 calls.
      </p>
    </div>
  );
}
