import Link from "next/link";
import type { Metadata } from "next";
import { Crown, GraduationCap, Medal } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber, initials, plural } from "@/lib/utils";
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

  /**
   * Everyone who has not opted out.
   *
   * The opt-out is enforced twice, and it has to be. refresh_leaderboards()
   * leaves an opted-out user out of the `leaderboards` table, which is what the
   * dashboard rank reads — but this page does not read only that table. It
   * merges the table with every row in `users` so that accounts which have
   * never been graded still appear, and that merge was silently putting the
   * opted-out user back on the board under their real name, scored zero.
   *
   * So the settings toggle reported "Removed from the leaderboards", the
   * database honoured it, and the public page listed them anyway. A privacy
   * control that announces success and changes nothing is worse than not
   * offering it, because the user stops checking.
   *
   * Filtering here rather than after the merge: a row that must not be shown
   * should never enter the list in the first place.
   */
  let userQuery = supabase
    .from("users")
    .select("id, full_name, avatar_url, university, level, role, created_at")
    .eq("show_on_leaderboard", true)
    .order("created_at", { ascending: true });

  if (university) userQuery = userQuery.eq("university", university);

  const [{ data: allUsers }, { data: lbRows }, { data: universityRows }] =
    await Promise.all([
      userQuery,
      supabase
        .from("leaderboards")
        .select("user_id, total_points, cases_solved, accuracy, rank")
        .eq("period", period),
      supabase
        .from("users")
        .select("university")
        .not("university", "is", null)
        .neq("university", "")
        .limit(500),
    ]);

  const lbMap = new Map((lbRows ?? []).map((r) => [r.user_id, r]));

  // Combine so EVERY registered user/student present on the platform is included
  const allRankedRows = (allUsers ?? []).map((u) => {
    const lb = lbMap.get(u.id);
    return {
      user_id: u.id,
      users: {
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        university: u.university,
        level: u.level,
      },
      total_points: Number(lb?.total_points ?? 0),
      cases_solved: Number(lb?.cases_solved ?? 0),
      accuracy: Number(lb?.accuracy ?? 0),
    };
  });

  // Sort by the selected metric with sensible tie-breakers
  allRankedRows.sort((a, b) => {
    if (b[sort] !== a[sort]) return b[sort] - a[sort];
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return b.cases_solved - a.cases_solved;
  });

  /**
   * Competition ranking: tied rows share a rank, and the next distinct row
   * skips ahead — 1, 2, 2, 2, 7 — matching SQL rank(), which is what
   * refresh_leaderboards() stores and what the dashboard reads.
   *
   * This was `idx + 1`. That numbers a five-way tie 2, 3, 4, 5, 6, so a user
   * whose dashboard said "Global rank #2" clicked through and found themselves
   * listed sixth. Both numbers described the same standing; only one of them
   * could be right. It also handed a silver medal to whichever tied row the
   * database happened to return second.
   *
   * The board cannot simply reuse the stored rank, because it is re-sortable by
   * accuracy and cases solved while the stored rank is by points. So the rank
   * is recomputed here against whichever ordering is active, using the same
   * comparator the sort just used.
   */
  const ties = (a: (typeof allRankedRows)[number], b: (typeof allRankedRows)[number]) =>
    a[sort] === b[sort] &&
    a.total_points === b.total_points &&
    a.accuracy === b.accuracy &&
    a.cases_solved === b.cases_solved;

  let currentRank = 0;
  const rows = allRankedRows.map((r, idx, all) => {
    if (idx === 0 || !ties(r, all[idx - 1])) currentRank = idx + 1;
    return { ...r, rank: currentRank };
  });

  const universities = [
    ...new Set(
      [
        ...(university ? [university] : []),
        ...(universityRows ?? []).map((row) => row.university?.trim()),
      ].filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const myRow = rows.find((r) => r.user_id === profile?.id) ?? null;
  const inTop = true;
  const mine = myRow;
  const myCohortRank: number | null = myRow ? myRow.rank : null;

  const boardTitle = isCohort ? university : "Global leaderboard";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isCohort
          ? `Ranked within ${university}. Ties break on accuracy.`
          : `Ranking of all ${plural(rows.length, "student")} on the platform. Ties break on accuracy.`}
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
            {rows.map((row) => {
              const user = Array.isArray(row.users) ? row.users[0] : row.users;
              const isMe = row.user_id === profile?.id;
              // Both boards use the rank computed above: it is already scoped
              // to the rows being shown, so a cohort board reads 1..N without
              // the gaps a global rank would leave.
              const displayRank = row.rank;

              return (
                <li
                  key={row.user_id}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3",
                    isMe && "bg-primary/5",
                  )}
                >
                  <span className="w-10 shrink-0">
                    {row.total_points > 0 && displayRank === 1 ? (
                      <Crown className="size-4 text-[var(--warning)]" />
                    ) : row.total_points > 0 && displayRank <= 3 ? (
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
                        <Link
                          href={`/u/${row.user_id}`}
                          className="hover:underline"
                        >
                          {user?.full_name ?? "Anonymous"}
                        </Link>
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
