import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { getQuotaStatus, type QuotaStatus } from "@/lib/quota";
import { QuotaCard } from "@/components/quota-card";
import { Section, SectionEmpty, SectionList } from "@/components/section";
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

  // CE progress toward the next level (matches level_for_ce in SQL).
  const currentLevelCe = 50 * (profile.level - 1) ** 2;
  const nextLevelCe = 50 * profile.level ** 2;
  const levelProgress =
    ((profile.ce - currentLevelCe) / (nextLevelCe - currentLevelCe)) * 100;

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
      const CE_BY_DIFFICULTY: Record<string, number> = {
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
        ceReward: CE_BY_DIFFICULTY[picked.difficulty] ?? 50,
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
  // eslint-disable-next-line react-hooks/purity -- async server component: renders once per request, so reading the clock here is the request time, not a re-render hazard.
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
    // eslint-disable-next-line react-hooks/purity -- async server component: renders once per request, so reading the clock here is the request time, not a re-render hazard.
    .gte("evaluated_at", new Date(Date.now() - 8 * 7 * 86_400_000).toISOString())
    .limit(500);

  const weekBuckets = new Map<string, { points: number; solved: number }>();
  for (let i = 7; i >= 0; i--) {
    // eslint-disable-next-line react-hooks/purity -- async server component: renders once per request, so reading the clock here is the request time, not a re-render hazard.
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

  // Optional enrichment — a missing service-role key hides the allowance card
  // rather than taking the whole dashboard down.
  let quota: QuotaStatus | null = null;
  const quotaAdmin = createAdminClientOrNull();
  if (quotaAdmin) quota = await getQuotaStatus(quotaAdmin, profile.id);

  // The greeting is worked out in IST: the page is rendered on a server in
  // another timezone, and "Good evening" at 9 a.m. would be worse than none.
  const now = new Date();
  const hourIst = Number(
    now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }),
  );
  const greeting = hourIst < 12 ? "Good morning" : hourIst < 17 ? "Good afternoon" : "Good evening";
  const today = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
  // Only a word that reads as a name goes in the headline. Accounts created
  // from an email address can carry a handle like "jdoe-2024", and set at
  // 60px in italic that is worse than no name at all.
  const firstWord = profile.full_name?.trim().split(/\s+/)[0] ?? "";
  const firstName = /^[\p{L}][\p{L}'’.-]{0,19}$/u.test(firstWord) ? firstWord : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
      {/* --------------------------------------------------- greeting --- */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {today}
          </p>
          <h1 className="mt-4 font-editorial text-[2.8rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.8rem]">
            {greeting}
            {firstName ? (
              <>
                , <em className="italic">{firstName}</em>
              </>
            ) : null}
            .
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {profile.cases_solved === 0
              ? "Your first case is the hardest. Start with an easy one."
              : `${formatNumber(profile.cases_solved)} cases solved · Level ${profile.level}`}
          </p>
        </div>
        <Button variant="ink" size="lg" asChild>
          <Link href="/cases">Solve a case</Link>
        </Button>
      </header>

      {dailyCase && (
        <div className="mt-10">
          <DailyCaseCard dailyCase={dailyCase} solved={dailySolved} />
        </div>
      )}

      {/* ------------------------------------------------------- stats --- */}
      <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <StatCard
          label="Cases solved"
          value={formatNumber(profile.cases_solved)}
          sublabel={`${formatNumber(profile.cases_attempted)} attempted`}
        />
        <StatCard
          label="Average score"
          value={accuracy > 0 ? `${accuracy.toFixed(0)}%` : "—"}
          sublabel="Across all solved cases"
        />
        <StatCard
          label="Current streak"
          value={profile.current_streak}
          sublabel={`Longest ${profile.longest_streak}`}
        />
        <StatCard
          label="Global rank"
          value={rank?.rank ? `#${formatNumber(rank.rank)}` : "—"}
          sublabel={`${formatNumber(profile.total_score)} points`}
        />
      </div>

      {/* --------------------------------------------- effort over time --- */}
      {/* Paired: both answer "how much have I been doing lately", and side by
          side they compare instead of scrolling past each other. */}
      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title="Points by week" description="Last 8 weeks. Points come from graded cases.">
          <div className="pt-4">
            <WeeklyPointsLazy data={weekly} />
          </div>
        </Section>
        <Section title="Every day" description="The last 8 weeks, one square a day. Consistency beats intensity.">
          <div className="pt-4">
            <SubmissionHeatmap counts={heatmapCounts} />
          </div>
        </Section>
      </div>

      <div className="grid gap-x-12 lg:grid-cols-3">
        {/* -------------------------------------------------- radar --- */}
        <Section
          title="Skill radar"
          description="Average score by domain. The dents are your homework."
          className="lg:col-span-2"
        >
          <div className="pt-4">
            <SkillRadarLazy data={radarData} />
          </div>
          <SectionList className="mt-4 border-t border-border">
            {DOMAINS.map((domain) => {
              const row = byDomain.get(domain.value);
              const score = Number(row?.avg_percentage ?? 0);
              return (
                <li key={domain.value}>
                  <Link
                    href={`/cases?domain=${domain.value}`}
                    className="group flex items-center gap-4 py-2.5"
                  >
                    <span className="w-36 shrink-0 font-editorial text-lg group-hover:italic sm:w-56">
                      {domain.label}
                    </span>
                    <Progress value={score} className="h-1 flex-1" />
                    <span className="w-28 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
                      {row?.cases_solved ?? 0} solved{score > 0 && ` · ${score.toFixed(0)}%`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </SectionList>
        </Section>

        {/* ---------------------------------------------- level + ce --- */}
        <div>
          <Section title={`Level ${profile.level}`}>
            <div className="space-y-3 pt-4">
              <Progress value={Math.min(100, Math.max(0, levelProgress))} className="h-1" />
              <p className="font-mono text-xs text-muted-foreground tabular">
                {formatNumber(profile.ce)} CE ·{" "}
                {formatNumber(Math.max(0, nextLevelCe - profile.ce))} to level{" "}
                {profile.level + 1}
              </p>
            </div>
          </Section>

          <Section title="Badges" count={achievements?.length ?? 0}>
            {achievements && achievements.length > 0 ? (
              <SectionList>
                {achievements.map((achievement, index) => {
                  const badge = achievement.badges as unknown as {
                    name: string;
                    description: string;
                    tier: string;
                  } | null;
                  if (!badge) return null;
                  return (
                    <li key={index} className="py-2.5">
                      <p className="text-sm font-medium">{badge.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {badge.description}
                      </p>
                    </li>
                  );
                })}
              </SectionList>
            ) : (
              <SectionEmpty>No badges yet. Solving one case earns your first.</SectionEmpty>
            )}
          </Section>
        </div>
      </div>

      {quota ? <QuotaCard quota={quota} /> : null}

      <div className="grid gap-x-12 lg:grid-cols-2">
        <TargetSchoolCard standing={standing} />
        <div className="mt-10">
          <QuoteCard />
        </div>
      </div>

      {/* ---------------------------------------------------- activity --- */}
      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title="Recent activity">
          {activity && activity.length > 0 ? (
            <SectionList>
              {activity.map((item) => {
                const caseRef = item.cases as unknown as {
                  title: string;
                  slug: string;
                } | null;
                const metadata = item.metadata as Record<string, unknown>;
                return (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
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
                    <div className="flex shrink-0 items-baseline gap-3 font-mono text-xs text-muted-foreground">
                      {item.ce_delta > 0 && <span className="tabular text-foreground">+{item.ce_delta}</span>}
                      <span>{timeAgo(item.created_at)}</span>
                    </div>
                  </li>
                );
              })}
            </SectionList>
          ) : (
            <SectionEmpty>Nothing here yet. Solve a case and it&apos;ll show up.</SectionEmpty>
          )}
        </Section>

        <Section
          title="Pick up where you left off"
          action={
            <Link href="/cases" className="text-xs text-muted-foreground hover:text-foreground">
              All cases
            </Link>
          }
        >
          <SectionList>
            {(recommended ?? []).map((item) => (
              <li key={item.id}>
                <Link
                  href={`/cases/${item.slug}`}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm hover:underline"
                >
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {item.estimated_minutes} min
                  </span>
                </Link>
              </li>
            ))}
          </SectionList>
        </Section>
      </div>
    </div>
  );
}
