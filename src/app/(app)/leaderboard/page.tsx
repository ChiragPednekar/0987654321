import Link from "next/link";
import type { Metadata } from "next";
import { Crown, GraduationCap, Medal } from "lucide-react";
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

type Sort = (typeof SORTS)[number]["value"];

/** Preserves the other filters when building a link that changes one of them. */
function hrefWith(
  current: { period: LeaderboardPeriod; sort: Sort; uni?: string },
  patch: Partial<{ period: LeaderboardPeriod; sort: Sort; uni: string | null }>,
) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams({ period: next.period, sort: next.sort });
  if (patch.uni !== null && next.uni) params.set("uni", next.uni);
  return `/leaderboard?${params.toString()}`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string; uni?: string }>;
}) {
  const params = await searchParams;
  const period = (PERIODS.find((p) => p.value === params.period)?.value ??
    "all_time") as LeaderboardPeriod;
  const sort = SORTS.find((s) => s.value === params.sort)?.value ?? "total_points";

  const supabase = await createClient();
  const profile = await getCurrentUser();

  // Cohort scope. `uni` lets any campus board be linked to directly; with no
  // `uni` param the board is global.
  const university = params.uni?.trim() || null;
  const myUniversity = profile?.university?.trim() || null;
  const isCohort = Boolean(university);
  const isMyCohort = isCohort && university === myUniversity;

  // `users!inner` turns the embedded profile into a join, which is what makes
  // filtering the board by a column on `users` possible.
  let query = supabase
    .from("leaderboards")
    .select(
      "rank, total_points, cases_solved, accuracy, user_id, users!inner(full_name, avatar_url, university, level)",
    )
    .eq("period", period)
    .order(sort, { ascending: false })
    .limit(LEADERBOARD_PAGE_SIZE);

  if (university) query = query.eq("users.university", university);

  // These three are independent, so they go out together. Run in sequence they
  // cost three round trips to the database region on every single render.
  const [{ data: rows }, { data: universityRows }, { data: myRow }] =
    await Promise.all([
      query,
      // Other campuses with a presence on this board, for the cohort switcher.
      supabase
        .from("users")
        .select("university")
        .not("university", "is", null)
        .neq("university", "")
        .limit(500),
      profile
        ? supabase
            .from("leaderboards")
            .select("rank, total_points, cases_solved, accuracy")
            .eq("period", period)
            .eq("user_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const universities = [
    ...new Set(
      [
        // Keep the board being viewed visible even when its cohort has no
        // ranked members yet, so the active scope is never unlabelled.
        ...(university ? [university] : []),
        ...(universityRows ?? []).map((row) => row.university?.trim()),
      ].filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const inTop = rows?.some((row) => row.user_id === profile?.id);

  const mine = myRow ?? null;

  // Global rank comes from the stored `rank`. A cohort rank is positional
  // within the filtered board, so it has to be counted rather than read — but
  // only when the viewer is missing from the visible page, since otherwise
  // their position is already on screen.
  let myCohortRank: number | null = null;

  if (mine && university && isMyCohort && !inTop) {
    const { count } = await supabase
      .from("leaderboards")
      .select("user_id, users!inner(university)", {
        count: "exact",
        head: true,
      })
      .eq("period", period)
      .eq("users.university", university)
      .gt(sort, mine[sort] ?? 0);

    myCohortRank = (count ?? 0) + 1;
  }

  const boardTitle = isCohort ? university : "Global leaderboard";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isCohort
          ? `Ranked within ${university}. Ties break on accuracy.`
          : "Ranked by points earned. Ties break on accuracy."}
      </p>

      {/* ---- cohort scope ---------------------------------------------- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={hrefWith({ period, sort }, { uni: null })}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            !isCohort
              ? "border-primary bg-primary/10 font-medium"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Global
        </Link>

        {myUniversity && (
          <Link
            href={hrefWith({ period, sort }, { uni: myUniversity })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              isMyCohort
                ? "border-primary bg-primary/10 font-medium"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <GraduationCap className="size-3.5" />
            {myUniversity}
          </Link>
        )}

        {universities
          .filter((name) => name !== myUniversity)
          .slice(0, 6)
          .map((name) => (
            <Link
              key={name}
              href={hrefWith({ period, sort }, { uni: name })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                university === name
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {name}
            </Link>
          ))}
      </div>

      {!myUniversity && (
        <p className="mt-3 text-xs text-muted-foreground">
          Add your university on your{" "}
          <Link href="/profile" className="underline underline-offset-2">
            profile
          </Link>{" "}
          to compete on your campus board.
        </p>
      )}

      {/* ---- period + sort --------------------------------------------- */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {PERIODS.map((option) => (
            <Link
              key={option.value}
              href={hrefWith(
                { period, sort, uni: university ?? undefined },
                { period: option.value },
              )}
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
              href={hrefWith(
                { period, sort, uni: university ?? undefined },
                { sort: option.value },
              )}
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
          <span className="flex-1">{boardTitle}</span>
          <span className="w-20 text-right">Points</span>
          <span className="hidden w-20 text-right sm:block">Solved</span>
          <span className="hidden w-20 text-right sm:block">Accuracy</span>
        </div>

        {!rows || rows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">
            {isCohort
              ? `Nobody from ${university} has ranked in this period yet. Solve a case to put your campus on the board.`
              : "No rankings yet for this period. Solve a case to appear here."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, index) => {
              const user = Array.isArray(row.users) ? row.users[0] : row.users;
              const isMe = row.user_id === profile?.id;
              // Cohort boards rank by position in the filtered list; the stored
              // rank is global and would read as a gap-riddled sequence here.
              const displayRank = isCohort ? index + 1 : row.rank;

              return (
                <li
                  key={row.user_id}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3",
                    isMe && "bg-primary/5",
                  )}
                >
                  <span className="w-10 shrink-0">
                    {displayRank === 1 ? (
                      <Crown className="size-4 text-[var(--warning)]" />
                    ) : displayRank <= 3 ? (
                      <Medal className="size-4 text-muted-foreground" />
                    ) : (
                      <span className="text-sm text-muted-foreground tabular">
                        {displayRank}
                      </span>
                    )}
                  </span>

                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar className="size-7 shrink-0">
                      {user?.avatar_url && (
                        <AvatarImage src={user.avatar_url} alt="" />
                      )}
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
                      {user?.university && !isCohort && (
                        <Link
                          href={hrefWith(
                            { period, sort },
                            { uni: user.university },
                          )}
                          className="truncate text-xs text-muted-foreground hover:underline"
                        >
                          {user.university}
                        </Link>
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

      {mine && !inTop && (!isCohort || isMyCohort) && (
        <Card className="mt-4 border-primary/40 bg-primary/5">
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="w-10 shrink-0 text-sm text-muted-foreground tabular">
              {isCohort ? (myCohortRank ?? "—") : (mine.rank ?? "—")}
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
    </div>
  );
}
