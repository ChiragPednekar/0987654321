import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODEL_RATES } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/utils";
import type { InstitutionCommercialsRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Renewals" };

function rupees(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export default async function RenewalsPage() {
  const admin = createAdminClient();

  const { data } = await admin.rpc("institution_commercials", {
    p_in_rate_per_million: MODEL_RATES.inputPerMillionUsd,
    p_out_rate_per_million: MODEL_RATES.outputPerMillionUsd,
    p_usd_inr: MODEL_RATES.usdInr,
  });

  const rows = ((data ?? []) as InstitutionCommercialsRow[]).filter(
    (r) => r.licence_ends_on,
  );

  // Three buckets, because they call for different actions: expired needs a
  // conversation today, 30 days needs a call this week, 60 needs it on the list.
  const groups = [
    {
      key: "expired",
      title: "Expired",
      note: "Access has already stopped for these students.",
      rows: rows.filter((r) => daysUntil(r.licence_ends_on!) < 0),
      tone: "border-rose-500/40",
    },
    {
      key: "30",
      title: "Within 30 days",
      note: "Close these now — a lapse means students lose access mid-term.",
      rows: rows.filter((r) => {
        const d = daysUntil(r.licence_ends_on!);
        return d >= 0 && d <= 30;
      }),
      tone: "border-amber-500/40",
    },
    {
      key: "60",
      title: "Within 60 days",
      note: "Start the conversation.",
      rows: rows.filter((r) => {
        const d = daysUntil(r.licence_ends_on!);
        return d > 30 && d <= 60;
      }),
      tone: "",
    },
  ];

  const total = groups.reduce((a, g) => a + g.rows.length, 0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Renewals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contracts expiring within 60 days, and any that already have.
        </p>
      </div>

      {total === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center">
            <CalendarClock className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing expiring in the next 60 days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {groups
            .filter((g) => g.rows.length > 0)
            .map((group) => (
              <Card key={group.key} className={cn(group.tone)}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {group.title}{" "}
                    <span className="text-sm font-normal text-muted-foreground tabular">
                      ({group.rows.length})
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{group.note}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2 font-medium">Institution</th>
                          <th className="px-4 py-2 text-right font-medium">Expires</th>
                          <th className="px-4 py-2 text-right font-medium">Seats</th>
                          <th className="px-4 py-2 text-right font-medium">Utilisation</th>
                          <th className="px-4 py-2 text-right font-medium">Value</th>
                          <th className="px-4 py-2 text-right font-medium">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((r) => {
                          const value = r.contract_value_inr ?? 0;
                          const cost = Number(r.ai_cost_inr);
                          const margin = value > 0 ? (value - cost) / value : null;
                          const used = Number(r.seats_used);
                          const util = r.seats_licensed
                            ? (used / r.seats_licensed) * 100
                            : 0;
                          const days = daysUntil(r.licence_ends_on!);
                          return (
                            <tr key={r.institution_id} className="border-b border-border last:border-0">
                              <td className="px-4 py-2">
                                <Link href={`/admin/licences/${r.institution_id}`}
                                  className="font-medium hover:underline">
                                  {r.name}
                                </Link>
                                {r.is_suspended ? (
                                  <Badge variant="destructive" className="ml-2">Suspended</Badge>
                                ) : null}
                              </td>
                              <td className="px-4 py-2 text-right text-xs">
                                {r.licence_ends_on}
                                <span className="block text-muted-foreground tabular">
                                  {days < 0 ? `${-days}d ago` : `in ${days}d`}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right tabular">
                                {formatNumber(used)} / {formatNumber(r.seats_licensed)}
                              </td>
                              <td className={cn(
                                "px-4 py-2 text-right tabular",
                                util < 40 && "text-amber-600 dark:text-amber-400",
                              )}>
                                {util.toFixed(0)}%
                              </td>
                              <td className="px-4 py-2 text-right tabular">
                                {rupees(r.contract_value_inr)}
                              </td>
                              <td className={cn(
                                "px-4 py-2 text-right tabular",
                                margin !== null && margin < 0.3 && "text-amber-600 dark:text-amber-400",
                              )}>
                                {margin === null ? "—" : `${(margin * 100).toFixed(0)}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Low utilisation is the strongest predictor of a lapsed renewal — a
        campus at 20% will not sign again.
      </p>
    </div>
  );
}
