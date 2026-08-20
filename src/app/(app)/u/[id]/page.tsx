import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Award, Flame, Target, Trophy } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { YearHeatmap, type YearCounts } from "@/components/year-heatmap";
import { DOMAINS, DOMAIN_LABEL } from "@/lib/constants";
import { formatNumber, initials } from "@/lib/utils";
import type { Domain } from "@/lib/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();

  return { title: data?.full_name ?? "Profile" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const viewer = await getCurrentUser();

  const { data: user } = await supabase
    .from("users")
    .select(
      "id, full_name, avatar_url, university, career_goal, xp, level, total_score, cases_solved, cases_attempted, current_streak, longest_streak, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!user) notFound();

  const [
    { data: domainRows },
    { data: rank },
    { data: achievements },
    { data: submissions },
  ] = await Promise.all([
    supabase.from("domain_progress").select("*").eq("user_id", user.id),
    supabase
      .from("leaderboards")
      .select("rank")
      .eq("user_id", user.id)
      .eq("period", "all_time")
      .maybeSingle(),
    supabase
      .from("achievements")
      .select("earned_at, badges(slug, name, description, icon, tier)")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false }),
    supabase
      .from("submissions")
      .select("created_at")
      .eq("user_id", user.id)
      .gte(
        "created_at",
        new Date(Date.now() - 366 * 86_400_000).toISOString(),
      )
      .limit(2000),
  ]);

  const counts: YearCounts = {};
  for (const row of submissions ?? []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const byDomain = new Map(
    (domainRows ?? []).map((row) => [row.domain as string, row]),
  );

  const accuracy =
    user.cases_attempted > 0
      ? (user.cases_solved / user.cases_attempted) * 100
      : 0;

  const isMe = viewer?.id === user.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* ---- header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
            <AvatarFallback>{initials(user.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {user.full_name ?? "Anonymous"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {user.university && (
                <Link
                  href={`/leaderboard?uni=${encodeURIComponent(user.university)}`}
                  className="hover:text-foreground hover:underline"
                >
                  {user.university}
                </Link>
              )}
              <span>
                Joined{" "}
                {new Date(user.created_at).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            {user.career_goal && (
              <p className="mt-1 text-sm text-muted-foreground">
                {user.career_goal}
              </p>
            )}
          </div>
        </div>

        {isMe && (
          <Button variant="outline" asChild>
            <Link href="/settings">Edit profile</Link>
          </Button>
        )}
      </div>

      {/* ---- stats -------------------------------------------------------- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cases solved" value={formatNumber(user.cases_solved)} icon={Target} />
        <Stat
          label="Accuracy"
          value={user.cases_attempted > 0 ? `${accuracy.toFixed(0)}%` : "—"}
          icon={Trophy}
        />
        <Stat
          label="Day streak"
          value={formatNumber(user.current_streak)}
          icon={Flame}
        />
        <Stat
          label="Global rank"
          value={rank?.rank ? `#${formatNumber(rank.rank)}` : "—"}
          icon={Award}
        />
      </div>

      {/* ---- activity ----------------------------------------------------- */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <YearHeatmap counts={counts} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---- skill mastery ---------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skill mastery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DOMAINS.map((domain) => {
              const row = byDomain.get(domain.value);
              const score = Number(row?.avg_percentage ?? 0);
              const solved = row?.cases_solved ?? 0;
              return (
                <div key={domain.value} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {DOMAIN_LABEL[domain.value as Domain]}
                    </span>
                    <span className="text-xs text-muted-foreground tabular">
                      {solved} solved{score > 0 && ` · ${score.toFixed(0)}%`}
                    </span>
                  </div>
                  <Progress value={score} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ---- badges ------------------------------------------------------ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Badges
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular">
                {achievements?.length ?? 0}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!achievements || achievements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No badges yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {achievements.map((item, index) => {
                  const badge = Array.isArray(item.badges)
                    ? item.badges[0]
                    : item.badges;
                  if (!badge) return null;
                  return (
                    <li key={index} className="flex items-start gap-2.5">
                      <Award className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {badge.name}
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            {badge.tier}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {badge.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Award;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="size-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
