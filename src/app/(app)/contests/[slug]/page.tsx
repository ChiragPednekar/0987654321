import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Crown, Medal } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Markdown } from "@/components/markdown";
import { ContestRunner } from "@/components/contest/contest-runner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contests")
    .select("title")
    .eq("slug", slug)
    .maybeSingle();

  return { title: data?.title ?? "Contest not found" };
}

export default async function ContestDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const profile = await getCurrentUser();

  const { data: contest } = await supabase
    .from("contests")
    .select("*, cases(id, slug, title, scenario, instructions, difficulty, estimated_minutes)")
    .eq("slug", slug)
    .maybeSingle();

  if (!contest) notFound();

  const caseRef = Array.isArray(contest.cases) ? contest.cases[0] : contest.cases;

  const now = Date.now();
  const isOpen =
    now >= new Date(contest.starts_at).getTime() &&
    now <= new Date(contest.ends_at).getTime();
  const isClosed = now > new Date(contest.ends_at).getTime();

  const { data: myEntry } = profile
    ? await supabase
        .from("contest_submissions")
        .select("started_at, submitted_at, rank, final_score, base_score, speed_bonus")
        .eq("contest_id", contest.id)
        .eq("user_id", profile.id)
        .maybeSingle()
    : { data: null };

  // Standings are only readable once the contest is completed (enforced by RLS).
  const { data: standings } = await supabase
    .from("contest_submissions")
    .select("rank, final_score, base_score, speed_bonus, duration_seconds, users(full_name)")
    .eq("contest_id", contest.id)
    .not("rank", "is", null)
    .order("rank", { ascending: true })
    .limit(50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/contests"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All contests
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{contest.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contest.description}</p>
        </div>
        <Badge variant={isOpen ? "success" : isClosed ? "secondary" : "default"}>
          {contest.status}
        </Badge>
      </div>

      {myEntry?.rank && (
        <Card className="mt-6 border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Your result</p>
              <p className="text-2xl font-semibold tabular">#{myEntry.rank}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Base</p>
                <p className="font-medium tabular">{myEntry.base_score}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Speed bonus</p>
                <p className="font-medium tabular">+{myEntry.speed_bonus}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Final</p>
                <p className="font-medium tabular">{myEntry.final_score}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {caseRef && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{caseRef.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Hide the case body until the window opens, so nobody can
                      pre-write an answer before the clock starts. */}
                  {isOpen || isClosed ? (
                    <>
                      <Markdown>{caseRef.scenario}</Markdown>
                      <div className="mt-6 border-t border-border pt-4">
                        <Markdown>{caseRef.instructions}</Markdown>
                      </div>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      The case is revealed when the contest opens on{" "}
                      {new Date(contest.starts_at).toLocaleString("en-US", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      .
                    </p>
                  )}
                </CardContent>
              </Card>

              {profile ? (
                <ContestRunner
                  contestId={contest.id}
                  caseId={caseRef.id}
                  durationMinutes={contest.duration_minutes}
                  maxSpeedBonus={contest.max_speed_bonus}
                  startedAt={myEntry?.started_at ?? null}
                  alreadySubmitted={Boolean(myEntry?.submitted_at)}
                  isOpen={isOpen}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Log in to enter this contest.
                    </p>
                    <Button asChild>
                      <Link href={`/login?next=/contests/${slug}`}>Log in</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Standings</CardTitle>
          </CardHeader>
          <CardContent>
            {!standings || standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isClosed
                  ? "Results are being finalised."
                  : "Standings are published when the contest closes."}
              </p>
            ) : (
              <ul className="space-y-3">
                {standings.map((entry, index) => {
                  const user = Array.isArray(entry.users)
                    ? entry.users[0]
                    : entry.users;
                  return (
                    <li key={index} className="flex items-center gap-3">
                      <span className="w-6 shrink-0">
                        {entry.rank === 1 ? (
                          <Crown className="size-4 text-[var(--warning)]" />
                        ) : entry.rank && entry.rank <= 3 ? (
                          <Medal className="size-4 text-muted-foreground" />
                        ) : (
                          <span className="text-xs text-muted-foreground tabular">
                            {entry.rank}
                          </span>
                        )}
                      </span>
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="text-[9px]">
                          {initials(user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {user?.full_name ?? "Anonymous"}
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular">
                        {entry.final_score}
                      </span>
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
