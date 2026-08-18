import Link from "next/link";
import type { Metadata } from "next";
import { Crown, Medal } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LEADERBOARD_PAGE_SIZE } from "@/lib/constants";
import { cn, formatNumber, initials } from "@/lib/utils";
import type { LeaderboardPeriod } from "@/lib/types/database";

export const metadata: Metadata = { title: "Leaderboard" };

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "all_time", label: "All time" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
];

const SORTS = [
  { value: "total_points", label: "Points" },
  { value: "accuracy", label: "Accuracy" },
  { value: "cases_solved", label: "Cases solved" },
] as const;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const period = (PERIODS.find((p) => p.value === params.period)?.value ??
    "all_time") as LeaderboardPeriod;
  const sort =
    SORTS.find((s) => s.value === params.sort)?.value ?? "total_points";

  const supabase = await createClient();
  const profile = await getCurrentUser();

  const { data: rows } = await supabase
    .from("leaderboards")
    .select(
      "rank, total_points, cases_solved, accuracy, user_id, users(full_name, avatar_url, university, level)",
    )
    .eq("period", period)
    .order(sort, { ascending: false })
    .limit(LEADERBOARD_PAGE_SIZE);

  // The viewer's own standing, so they always see where they are.
  const { data: mine } = profile
    ? await supabase
        .from("leaderboards")
        .select("rank, total_points, cases_solved, accuracy")
        .eq("period", period)
        .eq("user_id", profile.id)
        .maybeSingle()
    : { data: null };

  const inTop = rows?.some((row) => row.user_id === profile?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ranked by points earned. Ties break on accuracy.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {PERIODS.map((option) => (
            <Link
              key={option.value}
              href={`/leaderboard?period=${option.value}&sort=${sort}`}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                period === option.value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          {SORTS.map((option) => (
            <Link
              key={option.value}
              href={`/leaderboard?period=${period}&sort=${option.value}`}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                sort === option.value
                  ? "bg-accent font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span className="w-10">#</span>
          <span className="flex-1">Student</span>
          <span className="w-20 text-right">Points</span>
          <span className="hidden w-20 text-right sm:block">Solved</span>
          <span className="hidden w-20 text-right sm:block">Accuracy</span>
        </div>

        {!rows || rows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">
            No rankings yet for this period. Solve a case to appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const user = Array.isArray(row.users) ? row.users[0] : row.users;
              const isMe = row.user_id === profile?.id;

              return (
                <li
                  key={row.user_id}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3",
                    isMe && "bg-primary/5",
                  )}
                >
                  <span className="w-10 shrink-0">
                    {row.rank === 1 ? (
                      <Crown className="size-4 text-[var(--warning)]" />
                    ) : row.rank <= 3 ? (
                      <Medal className="size-4 text-muted-foreground" />
                    ) : (
                      <span className="text-sm text-muted-foreground tabular">
                        {row.rank}
                      </span>
                    )}
                  </span>

                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar className="size-7 shrink-0">
                      {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                      <AvatarFallback className="text-[10px]">
                        {initials(user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user?.full_name ?? "Anonymous"}
                        {isMe && (
                          <Badge variant="default" className="ml-2">
                            You
                          </Badge>
                        )}
                      </p>
                      {user?.university && (
                        <p className="truncate text-xs text-muted-foreground">
                          {user.university}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="w-20 shrink-0 text-right text-sm font-medium tabular">
                    {formatNumber(row.total_points)}
                  </span>
                  <span className="hidden w-20 shrink-0 text-right text-sm text-muted-foreground tabular sm:block">
                    {row.cases_solved}
                  </span>
                  <span className="hidden w-20 shrink-0 text-right text-sm text-muted-foreground tabular sm:block">
                    {Number(row.accuracy).toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {mine && !inTop && (
        <Card className="mt-4 border-primary/40 bg-primary/5">
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="w-10 shrink-0 text-sm text-muted-foreground tabular">
              {mine.rank}
            </span>
            <span className="flex-1 text-sm font-medium">
              {profile?.full_name ?? "You"}
              <Badge className="ml-2">You</Badge>
            </span>
            <span className="w-20 text-right text-sm font-medium tabular">
              {formatNumber(mine.total_points)}
            </span>
            <span className="hidden w-20 text-right text-sm text-muted-foreground tabular sm:block">
              {mine.cases_solved}
            </span>
            <span className="hidden w-20 text-right text-sm text-muted-foreground tabular sm:block">
              {Number(mine.accuracy).toFixed(0)}%
            </span>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Rankings refresh every 10 minutes.
      </p>
    </div>
  );
}
