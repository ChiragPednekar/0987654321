import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Award } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Sparkline } from "@/components/sparkline";

export const metadata: Metadata = { title: "Profile" };

const TIER_VARIANT = {
  bronze: "secondary",
  silver: "outline",
  gold: "warning",
  platinum: "default",
} as const;

export default async function ProfilePage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/profile");

  const supabase = await createClient();

  const [{ data: badges }, { data: earned }, { data: history }] =
    await Promise.all([
      supabase.from("badges").select("*").order("sort_order"),
      supabase
        .from("achievements")
        .select("badge_id, earned_at")
        .eq("user_id", profile.id),
      // Oldest-first so the sparklines read left to right. Capped at 30: past
      // that the line is denser than it is informative at this size.
      supabase
        .from("scores")
        .select("percentage, evaluated_at")
        .eq("user_id", profile.id)
        .order("evaluated_at", { ascending: true })
        .limit(30),
    ]);

  const scoreTrend = (history ?? []).map((row) => Number(row.percentage));

  // CE is cumulative, so the interesting shape is the running total rather
  // than the per-case award. Reconstructed from score history rather than
  // stored per-day, which would need a snapshot table for one sparkline.
  const ceTrend = scoreTrend.reduce<number[]>((acc, pct) => {
    acc.push((acc[acc.length - 1] ?? 0) + pct);
    return acc;
  }, []);

  const earnedIds = new Map(
    (earned ?? []).map((row) => [row.badge_id, row.earned_at]),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {(
          [
            ["Level", profile.level, null],
            ["CE", formatNumber(profile.ce), ceTrend],
            ["Solved", formatNumber(profile.cases_solved), null],
            ["Avg score", scoreTrend.length
              ? `${Math.round(scoreTrend.reduce((a, b) => a + b, 0) / scoreTrend.length)}%`
              : "—", scoreTrend],
          ] as [string, string | number, number[] | null][]
        ).map(([label, value, trend]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-2xl font-semibold tabular">{value}</p>
                {trend ? (
                  <Sparkline
                    values={trend}
                    label={`${label} across your last ${trend.length} graded cases`}
                    className="mb-1"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Badges</CardTitle>
          <span className="text-sm text-muted-foreground tabular">
            {earnedIds.size} of {badges?.length ?? 0}
          </span>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(badges ?? []).map((badge) => {
              const earnedAt = earnedIds.get(badge.id);
              return (
                <li
                  key={badge.id}
                  className={`flex items-start gap-3 rounded-lg border border-border p-3 ${
                    earnedAt ? "" : "opacity-50"
                  }`}
                >
                  <Award
                    className={`mt-0.5 size-4 shrink-0 ${
                      earnedAt ? "text-[var(--warning)]" : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{badge.name}</p>
                      <Badge
                        variant={
                          TIER_VARIANT[badge.tier as keyof typeof TIER_VARIANT] ??
                          "secondary"
                        }
                      >
                        {badge.tier}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {badge.description}
                    </p>
                    {earnedAt && (
                      <p className="mt-1 text-xs text-[var(--success)]">
                        Earned{" "}
                        {new Date(earnedAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
