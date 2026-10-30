import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, InfinityIcon } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { OBJECTIVE_TRACKS } from "@/lib/objective";
import type { ObjectiveSummaryRow } from "@/lib/types/database";
import { Page, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Aptitude" };

/**
 * The objective practice hub.
 *
 * Separate from /cases because it is a different kind of work: a case is an
 * hour of writing judged by a model, this is ten minutes of drilling marked
 * against a key. Students reach for them at different moments and the platform
 * should not pretend otherwise.
 */
export default async function PracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/practice");

  const admin = createAdminClient();
  const { data } = await admin.rpc("objective_summary", { p_user: user.id });
  const summary = new Map(
    ((data ?? []) as ObjectiveSummaryRow[]).map((r) => [r.track, r]),
  );

  const groups = ["Aptitude", "Domain"] as const;
  const profile = await getCurrentUser();
  const canAssign = profile?.role === "teacher" || profile?.role === "admin";

  return (
    <Page className="max-w-4xl">
      <PageHeader
        eyebrow="Practise"
        title="Aptitude"
        subtitle={
          <>
            Marked instantly against an answer key, with the working shown for every
            question.
          </>
        }
      />

      {/*
        Said plainly because it is the commercial point, not a footnote: this
        costs nothing to serve, so nothing about it is metered. A student who
        has run out of case gradings can still practise here every day.
      */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
        <InfinityIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          Unlimited. These sets are marked against an answer key rather than by
          the AI, so they never use your grading allowance.
        </p>
      </div>

      {canAssign && (
        <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Open a track to see its questions with answers, tick the ones you want,
          and add them to a batch as a quiz.
        </p>
      )}

      {groups.map((group) => (
        <section key={group} className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">
            {group}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {OBJECTIVE_TRACKS.filter((t) => t.group === group).map((track) => {
              const stat = summary.get(track.value);
              return (
                <Link key={track.value} href={`/practice/${track.value}`} className="group">
                  <Card className="h-full transition-colors hover:border-foreground/25">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{track.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {track.description}
                          </p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-4 text-xs text-muted-foreground tabular">
                        {stat && Number(stat.questions) > 0
                          ? `${stat.accuracy_pct}% over ${stat.questions} questions`
                          : "Not attempted yet"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </Page>
  );
}
