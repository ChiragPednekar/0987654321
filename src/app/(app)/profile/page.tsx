import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Award } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

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

  const [{ data: badges }, { data: earned }] = await Promise.all([
    supabase.from("badges").select("*").order("sort_order"),
    supabase
      .from("achievements")
      .select("badge_id, earned_at")
      .eq("user_id", profile.id),
  ]);

  const earnedIds = new Map(
    (earned ?? []).map((row) => [row.badge_id, row.earned_at]),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Level", profile.level],
          ["XP", formatNumber(profile.xp)],
          ["Solved", formatNumber(profile.cases_solved)],
          ["Best streak", profile.longest_streak],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
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
