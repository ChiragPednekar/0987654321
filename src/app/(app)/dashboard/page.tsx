import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  Award,
  CheckCircle2,
  Flame,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import type { SkillPoint } from "@/components/skill-radar";
import { SkillRadarLazy } from "@/components/skill-radar-lazy";
import { DailyCaseCard, type DailyCase } from "@/components/daily-case-card";
import {
  SubmissionHeatmap,
  type HeatmapCounts,
} from "@/components/submission-heatmap";
import { dailyIndex } from "@/lib/daily-case";
import { QuoteCard } from "@/components/quote-card";
import { WeeklyPointsLazy } from "@/components/weekly-points-lazy";
import type { WeekPoint } from "@/components/weekly-points";
import {
  TargetSchoolCard,
  type CohortStanding,
} from "@/components/target-school-card";
import { DOMAINS } from "@/lib/constants";
import { formatNumber, timeAgo } from "@/lib/utils";
import type { ActivityType, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Dashboard" };

const ACTIVITY_COPY: Record<ActivityType, string> = {
  case_solved: "Solved",
  case_attempted: "Attempted",
  badge_earned: "Earned a badge",
  level_up: "Levelled up",
  contest_entered: "Entered a contest",
  path_step_completed: "Completed a path step",
};

export default async function DashboardPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/dashboard");

  const supabase = await createClient();

  const [
    { data: domainRows },
    { data: activity },
    { data: achievements },
    { data: rank },
    { data: recommended },
  ] = await Promise.all([
    supabase.from("domain_progress").select("*").eq("user_id", profile.id),
    supabase
      .from("user_activity")
      .select("*, cases(title, slug, domain)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("achievements")
      .select("earned_at, badges(slug, name, description, icon, tier)")
      .eq("user_id", profile.id)
      .order("earned_at", { ascending: false })
      .limit(6),
    supabase
      .from("leaderboards")
      .select("rank, total_points")
      .eq("user_id", profile.id)
      .eq("period", "all_time")
      .maybeSingle(),
    supabase
      .from("cases")
      .select("id, slug, title, domain, difficulty, estimated_minutes")
      .eq("is_published", true)
      .limit(3),
  ]);

  // Build the radar: every domain appears, even at zero, so the shape is
  // comparable between users.
  const byDomain = new Map(
    (domainRows ?? []).map((row) => [row.domain as Domain, row]),
  );

  const radarData: SkillPoint[] = DOMAINS.map((domain) => {
    const row = byDomain.get(domain.value);
    return {
      domain: domain.short,
      score: Number(row?.avg_percentage ?? 0),
      solved: Number(row?.cases_solved ?? 0),
    };
  });

  const accuracy =
    radarData.filter((d) => d.solved > 0).length > 0
      ? radarData.reduce((sum, d) => sum + d.score * d.solved, 0) /
        radarData.reduce((sum, d) => sum + d.solved, 0)
      : 0;

  // XP progress toward the next level (matches level_for_xp in SQL).
  const currentLevelXp = 50 * (profile.level - 1) ** 2;
  const nextLevelXp = 50 * profile.level ** 2;
  const levelProgress =
    ((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  // ---- daily case --------------------------------------------------------
  // Chosen by counting first and fetching one row at a deterministic offset,
  // so this stays O(1) regardless of how large the library grows.
  const { count: publishedCount } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);

  let dailyCase: DailyCase | null = null;
  let dailySolved = false;

  if (publishedCount && publishedCount > 0) {
    const offset = dailyIndex(publishedCount);
    const { data: picked } = await supabase
      .from("cases")
      .select("id, slug, title, domain, difficulty, estimated_minutes")
      .eq("is_published", true)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset)
      .maybeSingle();

    if (picked) {
      const XP_BY_DIFFICULTY: Record<string, number> = {
        easy: 30,
        medium: 50,
        hard: 80,
      };

      dailyCase = {
        slug: picked.slug,
        title: picked.title,
        domain: picked.domain,
        difficulty: picked.difficulty,
        estimated_minutes: picked.estimated_minutes,
        xpReward: XP_BY_DIFFICULTY[picked.difficulty] ?? 50,
      };

      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { count: solvedToday } = await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("case_id", picked.id)
        .gte("created_at", startOfDay.toISOString());

      dailySolved = (solvedToday ?? 0) > 0;
    }
  }

  // ---- campus standing ---------------------------------------------------
  // Rank is positional within the cohort, so it has to be counted: the stored
  // `rank` on leaderboards is global.
  let standing: CohortStanding | null = null;
  const university = profile.university?.trim();

  if (university) {
    const [{ count: cohortSize }, { data: myBoard }] = await Promise.all([
      supabase
        .from("leaderboards")
        .select("user_id, users!inner(university)", {
          count: "exact",
          head: true,
        })
        .eq("period", "all_time")
        .eq("users.university", university),
      supabase
        .from("leaderboards")
        .select("total_points")
        .eq("period", "all_time")
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

    let cohortRank: number | null = null;
    if (myBoard) {
      const { count: ahead } = await supabase
        .from("leaderboards")
        .select("user_id, users!inner(university)", {
          count: "exact",
          head: true,
        })
        .eq("period", "all_time")
        .eq("users.university", university)
        .gt("total_points", myBoard.total_points ?? 0);

      cohortRank = (ahead ?? 0) + 1;
    }

    standing = {
      university,
      rank: cohortRank,
      cohortSize: cohortSize ?? 0,
    };
  }

  // ---- 8-week activity ---------------------------------------------------
  const since = new Date(Date.now() - 8 * 7 * 86_400_000);
  const { data: recentSubmissions } = await supabase
    .from("submissions")
    .select("created_at")
    .eq("user_id", profile.id)
    .gte("created_at", since.toISOString())
    .limit(1000);

  const heatmapCounts: HeatmapCounts = {};
  for (const row of recentSubmissions ?? []) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    heatmapCounts[key] = (heatmapCounts[key] ?? 0) + 1;
  }

  // ---- weekly points -----------------------------------------------------
  const { data: recentScores } = await supabase
    .from("scores")
    .select("total_score, evaluated_at")
    .eq("user_id", profile.id)
    .gte("evaluated_at", new Date(Date.now() - 8 * 7 * 86_400_000).toISOString())
    .limit(500);

  const weekBuckets = new Map<string, { points: number; solved: number }>();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 86_400_000);
    const key = `${d.getUTCFullYear()}-${Math.floor(d.getTime() / (7 * 86_400_000))}`;
    weekBuckets.set(key, { points: 0, solved: 0 });
  }

  for (const row of recentScores ?? []) {
    const t = new Date(row.evaluated_at).getTime();
    const key = `${new Date(t).getUTCFullYear()}-${Math.floor(t / (7 * 86_400_000))}`;
    const bucket = weekBuckets.get(key);
    if (bucket) {
      bucket.points += row.total_score ?? 0;
      bucket.solved += 1;
    }
  }

  const weekly: WeekPoint[] = [...weekBuckets.entries()].map(
    ([, value], index) => ({
      label: index === 7 ? "This wk" : `-${7 - index}w`,
      points: value.points,
      solved: value.solved,
    }),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.full_name?.split(" ")[0] ?? "Welcome"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.cases_solved === 0
              ? "Your first case is the hardest. Start with an easy one."
              : `${formatNumber(profile.cases_solved)} cases solved · Level ${profile.level}`}
          </p>
        </div>
        <Button asChild>
          <Link href="/cases">Solve a case</Link>
        </Button>
      </div>

      {dailyCase && (
        <div className="mt-6">
          <DailyCaseCard dailyCase={dailyCase} solved={dailySolved} />
        </div>
      )}

      {/* ------------------------------------------------------- stats --- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cases solved"
          value={formatNumber(profile.cases_solved)}
          sublabel={`${formatNumber(profile.cases_attempted)} attempted`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Average score"
          value={accuracy > 0 ? `${accuracy.toFixed(0)}%` : "—"}
          sublabel="Across all solved cases"
          icon={Target}
        />
        <StatCard
          label="Current streak"
          value={profile.current_streak}
          sublabel={`Longest ${profile.longest_streak}`}
          icon={Flame}
          accent={profile.current_streak > 0 ? "text-[var(--warning)]" : undefined}
        />
        <StatCard
          label="Global rank"
          value={rank?.rank ? `#${formatNumber(rank.rank)}` : "—"}
          sublabel={`${formatNumber(profile.total_score)} points`}
          icon={TrendingUp}
        />
      </div>

      {/* ------------------------------------------------ weekly points --- */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Points by week</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last 8 weeks. Points come from graded cases.
          </p>
        </CardHeader>
        <CardContent>
          <WeeklyPointsLazy data={weekly} />
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- activity --- */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Last 8 weeks</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consistency beats intensity. Every square is a day.
          </p>
        </CardHeader>
        <CardContent>
          <SubmissionHeatmap counts={heatmapCounts} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* -------------------------------------------------- radar --- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Skill radar</CardTitle>
            <p className="text-sm text-muted-foreground">
              Average score by domain. The dents are your homework.
            </p>
          </CardHeader>
          <CardContent>
            <SkillRadarLazy data={radarData} />

            <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {DOMAINS.map((domain) => {
                const row = byDomain.get(domain.value);
                const score = Number(row?.avg_percentage ?? 0);
                return (
                  <Link
                    key={domain.value}
                    href={`/cases?domain=${domain.value}`}
                    className="group space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground group-hover:text-foreground">
                        {domain.label}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {row?.cases_solved ?? 0} solved
                        {score > 0 && ` · ${score.toFixed(0)}%`}
                      </span>
                    </div>
                    <Progress value={score} />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------------------------- level + xp --- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Level {profile.level}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={Math.min(100, Math.max(0, levelProgress))} />
              <p className="text-xs text-muted-foreground tabular">
                {formatNumber(profile.xp)} XP ·{" "}
                {formatNumber(Math.max(0, nextLevelXp - profile.xp))} to level{" "}
                {profile.level + 1}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Badges</CardTitle>
              <Award className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {achievements && achievements.length > 0 ? (
                <ul className="space-y-3">
                  {achievements.map((achievement, index) => {
                    const badge = achievement.badges as unknown as {
                      name: string;
                      description: string;
                      tier: string;
                    } | null;
                    if (!badge) return null;
                    return (
                      <li key={index} className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{badge.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {badge.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No badges yet. Solving one case earns your first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------- activity --- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TargetSchoolCard standing={standing} />
        <QuoteCard />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity && activity.length > 0 ? (
              <ul className="divide-y divide-border">
                {activity.map((item) => {
                  const caseRef = item.cases as unknown as {
                    title: string;
                    slug: string;
                  } | null;
                  const metadata = item.metadata as Record<string, unknown>;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="text-muted-foreground">
                          {ACTIVITY_COPY[item.type]}
                        </span>{" "}
                        {caseRef ? (
                          <Link
                            href={`/cases/${caseRef.slug}`}
                            className="font-medium hover:underline"
                          >
                            {caseRef.title}
                          </Link>
                        ) : (
                          <span className="font-medium">
                            {String(
                              metadata.badge_name ??
                                (metadata.level ? `Level ${metadata.level}` : ""),
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {item.xp_delta > 0 && (
                          <Badge variant="secondary" className="tabular">
                            +{item.xp_delta}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(item.created_at)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing here yet. Solve a case and it&apos;ll show up.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick up where you left off</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {(recommended ?? []).map((item) => (
                <li key={item.id} className="py-2.5">
                  <Link
                    href={`/cases/${item.slug}`}
                    className="flex items-center justify-between gap-3 text-sm hover:underline"
                  >
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.estimated_minutes}m
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link href="/cases">Browse all cases</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
