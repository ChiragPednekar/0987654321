import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Target, TrendingUp } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreTrendLazy } from "@/components/score-trend-lazy";
import type { TrendPoint } from "@/components/score-trend";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Progress" };

const PAGE_SIZE = 25;

type ScoreJoin = {
  id: string;
  total_score: number;
  max_score: number;
  percentage: number | null;
  evaluated_at: string;
  submission_id: string;
  cases: {
    slug: string;
    title: string;
    domain: string;
    difficulty: string;
  } | null;
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/progress");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Oldest → newest for the chart; the table re-sorts newest first.
  const [{ data: trendRows }, { data: history, count }] = await Promise.all([
    supabase
      .from("scores")
      .select("percentage, evaluated_at, cases(title, domain)")
      .eq("user_id", profile.id)
      .order("evaluated_at", { ascending: true })
      .limit(100),
    supabase
      .from("scores")
      .select(
        "id, total_score, max_score, percentage, evaluated_at, submission_id, cases(slug, title, domain, difficulty)",
        { count: "exact" },
      )
      .eq("user_id", profile.id)
      .order("evaluated_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ]);

  const trend: TrendPoint[] = (trendRows ?? []).map((row) => {
    const c = Array.isArray(row.cases) ? row.cases[0] : row.cases;
    return {
      label: shortDate(row.evaluated_at),
      percentage: Number(row.percentage ?? 0),
      title: c?.title ?? "Case",
      domain: c?.domain ?? "",
    };
  });

  const rows = (history ?? []) as unknown as ScoreJoin[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const graded = trend.length;
  const average =
    graded > 0
      ? trend.reduce((sum, p) => sum + p.percentage, 0) / graded
      : 0;
  const best = graded > 0 ? Math.max(...trend.map((p) => p.percentage)) : 0;

  // Improvement compares the mean of the first and last five, which is far
  // less jumpy than first-vs-last on two noisy grades.
  const window = Math.min(5, Math.floor(graded / 2));
  const delta =
    window > 0
      ? trend.slice(-window).reduce((s, p) => s + p.percentage, 0) / window -
        trend.slice(0, window).reduce((s, p) => s + p.percentage, 0) / window
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every graded attempt, and whether the feedback is landing.
      </p>

      {/* ---- summary ------------------------------------------------------ */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cases graded</p>
              <p className="text-xl font-semibold tabular">{graded}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Target className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-xl font-semibold tabular">
                {graded > 0 ? `${average.toFixed(0)}%` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Best</p>
              <p className="text-xl font-semibold tabular">
                {graded > 0 ? `${best.toFixed(0)}%` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- trend -------------------------------------------------------- */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">Score over time</CardTitle>
          {delta !== null && (
            <span
              className={cn(
                "text-xs font-medium tabular",
                delta >= 0 ? "text-[var(--success)]" : "text-muted-foreground",
              )}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)} pts
              <span className="ml-1 font-normal text-muted-foreground">
                first {window} vs last {window}
              </span>
            </span>
          )}
        </CardHeader>
        <CardContent>
          <ScoreTrendLazy data={trend} />
        </CardContent>
      </Card>

      {/* ---- history ------------------------------------------------------ */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span className="flex-1">Case</span>
          <span className="hidden w-28 sm:block">Domain</span>
          <span className="hidden w-20 sm:block">Difficulty</span>
          <span className="w-20 text-right">Score</span>
          <span className="w-20 text-right">Date</span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No graded attempts yet. Your history appears here after your first
              submission.
            </p>
            <Button asChild size="sm">
              <Link href="/cases">Browse cases</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-4 px-4 py-3">
                <Link
                  href={`/cases/${row.cases?.slug ?? ""}?submission=${row.submission_id}#review`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                >
                  {row.cases?.title ?? "Case"}
                </Link>
                <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
                  {row.cases ? DOMAIN_LABEL[row.cases.domain as Domain] : "—"}
                </span>
                <span
                  className={cn(
                    "hidden w-20 shrink-0 text-xs font-medium capitalize sm:block",
                    row.cases &&
                      DIFFICULTY_CLASS[row.cases.difficulty as Difficulty],
                  )}
                >
                  {row.cases?.difficulty ?? "—"}
                </span>
                <span className="w-20 shrink-0 text-right text-sm font-medium tabular">
                  {Number(row.percentage ?? 0).toFixed(0)}%
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular">
                  {shortDate(row.evaluated_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/progress?page=${page - 1}`}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground tabular">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/progress?page=${page + 1}`}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Scores come from AI grading and carry some variance.{" "}
        <Link
          href="/how-grading-works"
          className="underline underline-offset-2 hover:text-foreground"
        >
          How grading works
        </Link>
      </p>
    </div>
  );
}
