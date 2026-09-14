"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SIM, type Decisions, type RoundOutcome } from "@/lib/sim/engine";
import { cn } from "@/lib/utils";

const crore = (n: number) => `₹${(n / 10_000_000).toFixed(2)} cr`;

export interface PastRound {
  round: number;
  decisions: Decisions;
  outcome: RoundOutcome;
}

/**
 * One quarter at a time.
 *
 * The decision form carries last quarter's numbers forward rather than
 * resetting, because the interesting question is what you change, and a form
 * that empties itself every round hides that.
 */
export function SimRoom({
  runId,
  currentRound,
  history,
  status,
}: {
  runId: string;
  currentRound: number;
  history: PastRound[];
  status: string;
}) {
  const router = useRouter();
  const last = history[history.length - 1];

  const [price, setPrice] = React.useState(last?.decisions.price ?? 1_200);
  const [marketing, setMarketing] = React.useState(
    (last?.decisions.marketing ?? 5_500_000) / 100_000,
  );
  const [rnd, setRnd] = React.useState((last?.decisions.rnd ?? 3_000_000) / 100_000);
  const [capex, setCapex] = React.useState(
    (last?.decisions.capacityInvestment ?? 10_000_000) / 100_000,
  );
  const [busy, setBusy] = React.useState(false);

  async function play() {
    setBusy(true);
    try {
      const response = await fetch(`/api/sim/runs/${runId}/round`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          price: Math.round(price),
          marketing: Math.round(marketing * 100_000),
          rnd: Math.round(rnd * 100_000),
          capacity_investment: Math.round(capex * 100_000),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not play the quarter.");
        return;
      }
      if (payload.status !== "live") {
        router.push(`/simulation/${runId}/result`);
      }
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const you = last?.outcome.firms[0];
  const openingCapacity = you ? you.capacity : SIM.startingCapacity;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Quarter {currentRound} of {SIM.rounds}
        </h2>
        {you && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground tabular">
            <span>Cash {crore(you.cash)}</span>
            {you.debt > 0 && (
              <span className="text-destructive">Debt {crore(you.debt)}</span>
            )}
            <span>Capacity {openingCapacity.toLocaleString()}</span>
            <span>Quality {you.quality}</span>
            <span>Brand {you.brand}</span>
          </div>
        )}
      </div>

      {status === "live" && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="price">Price per unit (₹)</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  min={100}
                  step={10}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="mt-1 tabular"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Value buyers are far more price-sensitive than premium buyers.
                </p>
              </div>
              <div>
                <Label htmlFor="marketing">Marketing (₹ lakh)</Label>
                <Input
                  id="marketing"
                  type="number"
                  value={marketing}
                  min={0}
                  step={5}
                  onChange={(e) => setMarketing(Number(e.target.value))}
                  className="mt-1 tabular"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Brand decays every quarter. Roughly ₹39 L holds it steady.
                </p>
              </div>
              <div>
                <Label htmlFor="rnd">R&amp;D (₹ lakh)</Label>
                <Input
                  id="rnd"
                  type="number"
                  value={rnd}
                  min={0}
                  step={5}
                  onChange={(e) => setRnd(Number(e.target.value))}
                  className="mt-1 tabular"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Quality decays more slowly. About ₹9 L holds it.
                </p>
              </div>
              <div>
                <Label htmlFor="capex">Capacity investment (₹ lakh)</Label>
                <Input
                  id="capex"
                  type="number"
                  value={capex}
                  min={0}
                  step={10}
                  onChange={(e) => setCapex(Number(e.target.value))}
                  className="mt-1 tabular"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  ₹{SIM.capacityCostPerUnit.toLocaleString()} per unit, usable next
                  quarter. Adds {Math.floor((capex * 100_000) / SIM.capacityCostPerUnit).toLocaleString()} units.
                </p>
              </div>
            </div>

            <Button onClick={play} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />}
              {busy ? "Running the quarter…" : `Run quarter ${currentRound}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Results so far
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  {["Q", "Price", "Sold", "Lost", "Share", "Revenue", "Profit", "Cash", "Debt"].map(
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
                  return (
                    <tr key={h.round} className="border-t">
                      <td className="px-3 py-2 tabular">{h.round}</td>
                      <td className="px-3 py-2 tabular">{f.price}</td>
                      <td className="px-3 py-2 tabular">{f.unitsSold.toLocaleString()}</td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular",
                          f.lostSales > 0 && "text-[var(--warning)]",
                        )}
                      >
                        {f.lostSales > 0 ? f.lostSales.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 tabular">{f.share}%</td>
                      <td className="px-3 py-2 tabular">{crore(f.revenue)}</td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular",
                          f.profit >= 0 ? "text-[var(--success)]" : "text-destructive",
                        )}
                      >
                        {crore(f.profit)}
                      </td>
                      <td className="px-3 py-2 tabular">{crore(f.cash)}</td>
                      <td
                        className={cn(
                          "px-3 py-2 tabular",
                          f.debt > 0 && "text-destructive",
                        )}
                      >
                        {f.debt > 0 ? crore(f.debt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {last && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Quarter {last.round} — the market
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  {last.outcome.firms.map((f, i) => (
                    <p key={f.name} className="flex flex-wrap gap-x-4 tabular">
                      <span className={cn("w-24 font-medium", i === 0 && "text-primary")}>
                        {f.name}
                      </span>
                      <span className="text-muted-foreground">₹{f.price}</span>
                      <span className="text-muted-foreground">{f.share}% share</span>
                      <span className="text-muted-foreground">
                        quality {f.quality} · brand {f.brand}
                      </span>
                    </p>
                  ))}
                </div>
                {last.outcome.firms[0].lostSales > 0 && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--warning)]">
                    <TrendingDown className="mt-0.5 size-3.5 shrink-0" />
                    {last.outcome.firms[0].lostSales.toLocaleString()} units of demand
                    went unserved — about {crore(last.outcome.firms[0].lostSales * last.outcome.firms[0].price)} of
                    revenue you could not make.
                  </p>
                )}
                {last.outcome.firms[0].profit > 0 && last.outcome.firms[0].lostSales === 0 && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                    Unit cost is ₹{last.outcome.firms[0].unitCost} a unit, and falls as
                    cumulative volume grows.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
