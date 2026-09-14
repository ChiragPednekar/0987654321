import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamSetup } from "@/components/competition/team-setup";
import { EntryForm } from "@/components/competition/entry-form";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import type { CompetitionLeaderboardRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Competition" };

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/competitions/${slug}`);

  const admin = createAdminClient();
  const { data: comp } = await admin
    .from("competitions")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!comp) notFound();

  const now = Date.now();
  const open =
    new Date(comp.opens_at).getTime() <= now && new Date(comp.closes_at).getTime() > now;
  const resultsOut =
    Boolean(comp.results_at) && new Date(comp.results_at!).getTime() <= now;

  const { data: membership } = await admin
    .from("competition_members")
    .select("team_id, competition_teams(name, join_code)")
    .eq("competition_id", comp.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const team = membership
    ? Array.isArray(membership.competition_teams)
      ? membership.competition_teams[0]
      : membership.competition_teams
    : null;

  const [{ data: mates }, { data: entry }, { data: board }] = await Promise.all([
    membership
      ? admin
          .from("competition_members")
          .select("user_id, is_lead, users(full_name, email)")
          .eq("team_id", membership.team_id)
      : Promise.resolve({ data: null }),
    membership
      ? admin
          .from("competition_entries")
          .select("answer, submitted_at, submitted_by, total_score, max_score, breakdown, feedback")
          .eq("team_id", membership.team_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    resultsOut
      ? admin.rpc("competition_leaderboard", { p_competition: comp.id })
      : Promise.resolve({ data: null }),
  ]);

  const members = mates ?? [];
  const submitterName = entry
    ? (members.find((m) => m.user_id === entry.submitted_by)?.users as
        | { full_name: string | null; email: string | null }
        | undefined)
    : undefined;

  const leaderboard = (board ?? []) as CompetitionLeaderboardRow[];
  const yourRank = membership
    ? leaderboard.find((r) => r.team_id === membership.team_id)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/competitions" className="text-sm text-muted-foreground hover:text-foreground">
        ← Competitions
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{comp.title}</h1>
        {open ? <Badge>open</Badge> : <Badge variant="secondary">closed</Badge>}
      </div>
      {comp.sponsor && <p className="mt-1 text-sm text-muted-foreground">{comp.sponsor}</p>}

      <Card className="mt-5">
        <CardContent className="p-5">
          <div className="prose-sm max-w-none">
            <Markdown>{comp.brief}</Markdown>
          </div>
          <div className="mt-4 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              What to submit
            </p>
            <p className="mt-1 text-sm">{comp.instructions}</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Judged on {Object.keys(comp.criteria).join(", ").replace(/_/g, " ")} ·{" "}
            {comp.max_score} points · teams of {comp.min_team_size}–{comp.max_team_size} ·
            closes {new Date(comp.closes_at).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* ---- your team -------------------------------------------------- */}
      <h2 className="mt-8 text-sm font-semibold text-foreground">
        Your team
      </h2>
      <div className="mt-3">
        {!membership ? (
          open ? (
            <TeamSetup
              slug={slug}
              minTeamSize={comp.min_team_size}
              maxTeamSize={comp.max_team_size}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                You did not enter this competition.
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{team?.name}</p>
                {open && team?.join_code && (
                  <p className="text-xs text-muted-foreground">
                    Join code{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono tracking-widest">
                      {team.join_code}
                    </code>
                  </p>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {members.map((m) => {
                  const u = Array.isArray(m.users) ? m.users[0] : m.users;
                  return (
                    <li key={m.user_id} className="flex items-center gap-2">
                      <Users className="size-3.5" />
                      {u?.full_name || u?.email?.split("@")[0] || "Member"}
                      {m.is_lead && <Badge variant="outline">lead</Badge>}
                    </li>
                  );
                })}
              </ul>
              {members.length < comp.min_team_size && open && (
                <p className="mt-3 text-xs text-[var(--warning)]">
                  You need at least {comp.min_team_size} members to submit.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---- entry ------------------------------------------------------- */}
      {membership && open && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-foreground">
            Your entry
          </h2>
          <div className="mt-3">
            <EntryForm
              slug={slug}
              existing={entry?.answer ?? ""}
              submittedAt={entry?.submitted_at ?? null}
              submittedByName={
                submitterName?.full_name || submitterName?.email?.split("@")[0] || null
              }
            />
          </div>
        </>
      )}

      {membership && !open && !resultsOut && (
        <Card className="mt-8">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {entry
              ? "Your entry is in. Results are published when judging closes."
              : "The deadline passed without an entry from your team."}
          </CardContent>
        </Card>
      )}

      {/* ---- results ----------------------------------------------------- */}
      {resultsOut && (
        <>
          <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="size-4" /> Final standings
          </h2>
          {leaderboard.length === 0 ? (
            <Card className="mt-3">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No entries were judged.
              </CardContent>
            </Card>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Team</th>
                    <th className="px-4 py-2 text-left font-medium">Members</th>
                    <th className="px-4 py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.team_id}
                      className={cn(
                        "border-t",
                        membership?.team_id === row.team_id && "bg-primary/5 font-medium",
                      )}
                    >
                      <td className="px-4 py-2 tabular">{row.rank}</td>
                      <td className="px-4 py-2">
                        {row.team_name}
                        {membership?.team_id === row.team_id && (
                          <span className="ml-2 text-xs text-muted-foreground">your team</span>
                        )}
                      </td>
                      <td className="px-4 py-2 tabular text-muted-foreground">
                        {row.member_count}
                      </td>
                      <td className="px-4 py-2 text-right tabular">
                        {row.total_score}/{row.max_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {entry && entry.total_score !== null && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <p className="text-sm font-medium">
                  Your entry scored {entry.total_score}/{entry.max_score}
                  {yourRank ? ` — ${yourRank.rank} of ${leaderboard.length}` : ""}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {Object.entries(comp.criteria).map(([key, max]) => (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm font-medium tabular">
                        {Number(entry.breakdown?.[key] ?? 0)}
                        <span className="text-muted-foreground">/{max}</span>
                      </p>
                    </div>
                  ))}
                </div>
                {entry.feedback?.verdict && (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {entry.feedback.verdict}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
