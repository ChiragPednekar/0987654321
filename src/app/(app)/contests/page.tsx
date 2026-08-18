import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Trophy, Zap } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DIFFICULTY_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types/database";

export const metadata: Metadata = { title: "Contests" };

const STATUS_VARIANT = {
  live: "success",
  scheduled: "default",
  grading: "warning",
  completed: "secondary",
} as const;

export default async function ContestsPage() {
  const supabase = await createClient();
  const profile = await getCurrentUser();

  const { data: contests } = await supabase
    .from("contests")
    .select("*, cases(slug, title, difficulty, domain)")
    .eq("is_published", true)
    .order("starts_at", { ascending: false })
    .limit(20);

  const { data: myEntries } = profile
    ? await supabase
        .from("contest_submissions")
        .select("contest_id, rank, final_score, submitted_at")
        .eq("user_id", profile.id)
    : { data: [] };

  const entryByContest = new Map(
    (myEntries ?? []).map((entry) => [entry.contest_id, entry]),
  );

  const now = Date.now();
  const live = (contests ?? []).filter(
    (c) =>
      new Date(c.starts_at).getTime() <= now &&
      new Date(c.ends_at).getTime() >= now,
  );
  const upcoming = (contests ?? []).filter(
    (c) => new Date(c.starts_at).getTime() > now,
  );
  const past = (contests ?? []).filter(
    (c) => new Date(c.ends_at).getTime() < now,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Weekly contests</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        One featured case a week. Two hours on your personal timer, plus a speed
        bonus for finishing early. Opens Friday, closes Sunday.
      </p>

      {live.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Zap className="size-4 text-[var(--success)]" />
            Live now
          </h2>
          <div className="space-y-4">
            {live.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                entry={entryByContest.get(contest.id)}
                highlight
              />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Calendar className="size-4 text-muted-foreground" />
            Upcoming
          </h2>
          <div className="space-y-4">
            {upcoming.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                entry={entryByContest.get(contest.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Trophy className="size-4 text-muted-foreground" />
          Past contests
        </h2>
        {past.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No contests have run yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {past.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                entry={entryByContest.get(contest.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type ContestWithCase = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  max_speed_bonus: number;
  cases: { slug: string; title: string; difficulty: string; domain: string }[] | {
    slug: string;
    title: string;
    difficulty: string;
    domain: string;
  } | null;
};

function ContestCard({
  contest,
  entry,
  highlight,
}: {
  contest: ContestWithCase;
  entry?: { rank: number | null; final_score: number | null; submitted_at: string | null };
  highlight?: boolean;
}) {
  const caseRef = Array.isArray(contest.cases) ? contest.cases[0] : contest.cases;
  const status = contest.status as keyof typeof STATUS_VARIANT;

  return (
    <Card className={cn(highlight && "border-[var(--success)]/40")}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{contest.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {contest.description}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
            {contest.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>
            {new Date(contest.starts_at).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
            })}
            {" – "}
            {new Date(contest.ends_at).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <span className="tabular">{contest.duration_minutes} min timer</span>
          <span className="tabular">+{contest.max_speed_bonus} speed bonus</span>
          {caseRef && (
            <span
              className={cn(
                "font-medium capitalize",
                DIFFICULTY_CLASS[caseRef.difficulty as Difficulty],
              )}
            >
              {caseRef.difficulty}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {entry?.rank ? (
            <span className="text-sm">
              You finished{" "}
              <span className="font-semibold tabular">#{entry.rank}</span> with{" "}
              <span className="tabular">{entry.final_score}</span> points
            </span>
          ) : entry?.submitted_at ? (
            <span className="text-sm text-muted-foreground">
              Submitted — awaiting final ranking
            </span>
          ) : (
            <span />
          )}

          <Button size="sm" variant={highlight ? "default" : "outline"} asChild>
            <Link href={`/contests/${contest.slug}`}>
              {highlight ? "Enter contest" : "View"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
