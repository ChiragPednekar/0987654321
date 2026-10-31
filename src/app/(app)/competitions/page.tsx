import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDay, formatDayTime } from "@/lib/utils";
import { DateBlock } from "@/components/date-block";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Competitions" };

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
    <Page>
      <PageHeader
        eyebrow="Community"
        title="Competitions"
        subtitle={
          <>
            Teams of two to four, one brief, one submission, ranked against everyone
            who entered.
          </>
        }
      />

      <Card className="mt-6 border-muted">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Nothing here is proctored. Splitting the work between you and pasting
          it into one document is the exercise — the integrity checks that apply
          to individual practice deliberately do not apply to a team entry.
          Rankings appear only after the deadline.
        </CardContent>
      </Card>

      {/* Live and upcoming first, soonest deadline on top; then past ones, newest first. */}
      {(() => {
        const all = (comps ?? []).map((c) => ({ ...c, state: stateOf(c) }));
        const live = all.filter((c) => c.state === "open" || c.state === "upcoming");
        const past = all
          .filter((c) => c.state === "judging" || c.state === "results")
          .sort((x, y) => new Date(y.closes_at).getTime() - new Date(x.closes_at).getTime());
        if (all.length === 0) {
          return (
            <EmptyState
              className="mt-6"
              icon={Trophy}
              title="No competitions yet"
              description="When one opens you'll see it here, with its brief and team size."
            />
          );
        }
        return [
          { title: "Open and upcoming", rows: live },
          { title: "Past", rows: past },
        ]
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <section key={group.title} className="mt-8">
              <h2 className="px-1 pb-2 text-[1.25rem] font-bold tracking-[-0.018em]">{group.title}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.rows.map((c) => {
                  const isIn = enteredSlugs.has(c.slug);
                  const keyDate = c.state === "upcoming" ? c.opens_at : c.closes_at;
                  return (
                    <Link key={c.slug} href={`/competitions/${c.slug}`} className="block">
                      <Card className="transition-[border-color,box-shadow] hover:border-border hover:shadow-md">
                        <CardContent className="flex gap-4 p-5">
                          <DateBlock date={keyDate} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{c.title}</p>
                              {c.state === "open" && <Badge>Open</Badge>}
                              {c.state === "upcoming" && <Badge variant="outline">Opens soon</Badge>}
                              {c.state === "judging" && <Badge variant="secondary">Judging</Badge>}
                              {c.state === "results" && (
                                <Badge variant="secondary" className="gap-1">
                                  <Trophy className="size-3" /> Results out
                                </Badge>
                              )}
                              {isIn && <Badge variant="success">Entered</Badge>}
                            </div>
                            {c.sponsor && <p className="mt-0.5 text-xs text-muted-foreground">{c.sponsor}</p>}
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.brief}</p>
                            <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="size-3" />
                                {c.min_team_size}–{c.max_team_size} per team
                              </span>
                              <span>
                                {c.state === "upcoming"
                                  ? `Opens ${formatDayTime(c.opens_at)}`
                                  : c.state === "open"
                                    ? `Closes ${formatDayTime(c.closes_at)}`
                                    : `Closed ${formatDay(c.closes_at)}`}
                              </span>
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ));
      })()}
    </Page>
  );
}
