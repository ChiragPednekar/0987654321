import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Case competitions" };

function stateOf(c: { opens_at: string; closes_at: string; results_at: string | null }) {
  const now = Date.now();
  if (new Date(c.opens_at).getTime() > now) return "upcoming" as const;
  if (new Date(c.closes_at).getTime() > now) return "open" as const;
  if (c.results_at && new Date(c.results_at).getTime() <= now) return "results" as const;
  return "judging" as const;
}

export default async function CompetitionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/competitions");

  const admin = createAdminClient();
  const [{ data: comps }, { data: mine }] = await Promise.all([
    admin
      .from("competitions")
      .select("slug, title, sponsor, brief, opens_at, closes_at, results_at, min_team_size, max_team_size")
      .eq("is_published", true)
      .order("closes_at", { ascending: true }),
    admin
      .from("competition_members")
      .select("competition_id, competition_teams(name)")
      .eq("user_id", user.id),
  ]);

  const entered = new Map(
    (mine ?? []).map((m) => {
      const t = Array.isArray(m.competition_teams) ? m.competition_teams[0] : m.competition_teams;
      return [m.competition_id, t?.name ?? "your team"];
    }),
  );

  const { data: ids } = await admin.from("competitions").select("id, slug");
  const slugOf = new Map((ids ?? []).map((c) => [c.id, c.slug]));
  const enteredSlugs = new Set(
    [...entered.keys()].map((id) => slugOf.get(id)).filter(Boolean) as string[],
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Case competitions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Teams of two to four, one brief, one submission, ranked against everyone
        who entered.
      </p>

      <Card className="mt-6 border-muted">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Nothing here is proctored. Splitting the work between you and pasting
          it into one document is the exercise — the integrity checks that apply
          to individual practice deliberately do not apply to a team entry.
          Rankings appear only after the deadline.
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {(comps ?? []).map((c) => {
          const state = stateOf(c);
          const isIn = enteredSlugs.has(c.slug);
          return (
            <Link key={c.slug} href={`/competitions/${c.slug}`}>
              <Card className="transition-colors hover:border-foreground/25">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{c.title}</p>
                        {state === "open" && <Badge>open</Badge>}
                        {state === "upcoming" && <Badge variant="outline">opens soon</Badge>}
                        {state === "judging" && <Badge variant="secondary">judging</Badge>}
                        {state === "results" && (
                          <Badge variant="secondary" className="gap-1">
                            <Trophy className="size-3" /> results out
                          </Badge>
                        )}
                        {isIn && <Badge variant="outline">entered</Badge>}
                      </div>
                      {c.sponsor && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.sponsor}</p>
                      )}
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {c.brief}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {c.min_team_size}–{c.max_team_size} per team
                    </span>
                    <span>
                      {state === "upcoming"
                        ? `opens ${timeAgo(c.opens_at)}`
                        : state === "open"
                          ? `closes ${timeAgo(c.closes_at)}`
                          : `closed ${timeAgo(c.closes_at)}`}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
