import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, Building2, Cpu, Percent, Plus, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { MODEL_RATES, PLATFORM_INFRA_INR_PER_YEAR } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/utils";
import type { InstitutionCommercialsRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Campus licences" };

function rupees(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default async function LicencesPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/admin/licences");
  if (profile.role !== "admin") redirect("/dashboard");

  const admin = createAdminClientOrNull();
  if (!admin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold">Unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Missing service-role key.
        </p>
      </div>
    );
  }

  const { data } = await admin.rpc("institution_commercials", {
    p_in_rate_per_million: MODEL_RATES.inputPerMillionUsd,
    p_out_rate_per_million: MODEL_RATES.outputPerMillionUsd,
    p_usd_inr: MODEL_RATES.usdInr,
  });

  const rows = (data ?? []) as InstitutionCommercialsRow[];

  const live = rows.filter(
    (r) =>
      !r.is_suspended &&
      (!r.licence_ends_on || new Date(r.licence_ends_on) >= new Date()),
  );
  const arr = live.reduce((a, r) => a + (r.contract_value_inr ?? 0), 0);
  const aiCost = rows.reduce((a, r) => a + Number(r.ai_cost_inr), 0);
  const seatsSold = live.reduce((a, r) => a + r.seats_licensed, 0);
  const seatsUsed = live.reduce((a, r) => a + Number(r.seats_used), 0);

  // Infra is a platform-wide fixed cost, not per licence. Subtracted once here
  // so the headline margin is not flattered by leaving it out.
  const grossMargin = arr > 0 ? (arr - aiCost - PLATFORM_INFRA_INR_PER_YEAR) / arr : null;

  const renewingSoon = live.filter((r) => {
    if (!r.licence_ends_on) return false;
    const days = (new Date(r.licence_ends_on).getTime() - Date.now()) / 86_400_000;
    return days <= 60;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campus licences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contracts, seat usage and what each one costs to serve.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/licences/new">
            <Plus className="size-4" />
            New licence
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Annual contract value" value={rupees(arr)} icon={Building2} />
        <StatCard
          label="AI cost to date"
          value={rupees(aiCost)}
          sublabel={`+ ${rupees(PLATFORM_INFRA_INR_PER_YEAR)}/yr infra`}
          icon={Cpu}
        />
        <StatCard
          label="Gross margin"
          value={grossMargin === null ? "—" : `${(grossMargin * 100).toFixed(0)}%`}
          sublabel="after AI and infra"
          icon={Percent}
        />
        <StatCard
          label="Seats used"
          value={`${formatNumber(seatsUsed)} / ${formatNumber(seatsSold)}`}
          sublabel={
            seatsSold
              ? `${Math.round((seatsUsed / seatsSold) * 100)}% activation`
              : undefined
          }
          icon={Users}
        />
      </div>

      {renewingSoon.length > 0 ? (
        <Card className="mt-6 border-amber-500/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium">
                {renewingSoon.length}{" "}
                {renewingSoon.length === 1 ? "licence renews" : "licences renew"}{" "}
                within 60 days
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {renewingSoon.map((r) => r.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No licences yet. Create the first one to start selling seats.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Institution</th>
                    <th className="px-4 py-3 text-right font-medium">Seats</th>
                    <th className="px-4 py-3 text-right font-medium">Active 30d</th>
                    <th className="px-4 py-3 text-right font-medium">Contract</th>
                    <th className="px-4 py-3 text-right font-medium">AI cost</th>
                    <th className="px-4 py-3 text-right font-medium">Margin</th>
                    <th className="px-4 py-3 text-right font-medium">Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const value = row.contract_value_inr ?? 0;
                    const cost = Number(row.ai_cost_inr);
                    const margin = value > 0 ? (value - cost) / value : null;
                    const expired =
                      row.licence_ends_on &&
                      new Date(row.licence_ends_on) < new Date();
                    return (
                      <tr
                        key={row.institution_id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/licences/${row.institution_id}`}
                            className="font-medium hover:underline"
                          >
                            {row.name}
                          </Link>
                          {row.is_suspended ? (
                            <Badge variant="destructive" className="ml-2">
                              Suspended
                            </Badge>
                          ) : expired ? (
                            <Badge variant="outline" className="ml-2">
                              Expired
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {formatNumber(Number(row.seats_used))} /{" "}
                          {formatNumber(row.seats_licensed)}
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {formatNumber(Number(row.active_30d))}
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {rupees(row.contract_value_inr)}
                        </td>
                        <td className="px-4 py-3 text-right tabular">
                          {rupees(cost)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right tabular",
                            margin !== null && margin < 0.3 && "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {margin === null ? "—" : `${(margin * 100).toFixed(0)}%`}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {row.licence_ends_on ?? "open"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        AI cost is computed from stored token counts at ₹
        {MODEL_RATES.usdInr}/$1 and Google&apos;s current list rates. Those rates
        roughly double on 1 Jan 2027 — see MODEL_RATES in constants.
      </p>
    </div>
  );
}
