import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, MicOff, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GD_CRITERIA } from "@/lib/ai/gd-evaluate";
import { cn } from "@/lib/utils";
import type { GdScoreRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Discussion result" };

/**
 * Everyone's result, to everyone in the room.
 *
 * Deliberate: a GD is marked comparatively, the other five heard the same
 * discussion, and seeing where you placed against people who were actually
 * there is most of what makes it useful. It is also what a real GD result
 * looks like — the panel calls out names.
 */
export default async function GdResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/gd/${id}/result`);

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("gd_sessions")
    .select("id, status, gd_topics(title, prompt)")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  const { data: scores } = await admin
    .from("gd_scores")
    .select("*, users(full_name, email)")
    .eq("session_id", id);

  const rows = (scores ?? []) as (GdScoreRow & {
    users?: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[];
  })[];

  // Only people who were in the room may read it.
  if (!rows.some((r) => r.user_id === user.id)) {
    const { data: member } = await admin
      .from("gd_participants")
      .select("user_id")
      .eq("session_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) notFound();
  }

  const topic = Array.isArray(session.gd_topics) ? session.gd_topics[0] : session.gd_topics;
  const ranked = [...rows].sort((a, b) => b.total - a.total);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/gd" className="text-sm text-muted-foreground hover:text-foreground">
        ← Group discussions
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{topic?.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone in the room is marked separately, and everyone sees the same
        results.
      </p>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            This discussion has not been marked yet.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {ranked.map((row) => {
            const u = Array.isArray(row.users) ? row.users[0] : row.users;
            const name = u?.full_name || u?.email?.split("@")[0] || "Participant";
            const isYou = row.user_id === user.id;
            const fb = row.feedback ?? {};

            return (
              <Card key={row.user_id} className={cn(isYou && "border-primary/50")}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{name}</span>
                      {isYou && <Badge variant="secondary">you</Badge>}
                    </div>
                    {row.outcome === "scored" ? (
                      <span className="text-lg font-semibold tabular">
                        {row.total}
                        <span className="text-sm text-muted-foreground">
                          /{row.max_score}
                        </span>
                      </span>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        {row.outcome === "silent" ? (
                          <XCircle className="size-3" />
                        ) : (
                          <MicOff className="size-3" />
                        )}
                        {row.outcome === "silent" ? "did not speak" : "not transcribed"}
                      </Badge>
                    )}
                  </div>

                  {row.outcome === "scored" && (
                    <>
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {Object.entries(GD_CRITERIA).map(([key, max]) => {
                          const got = Number(row.breakdown?.[key] ?? 0);
                          return (
                            <div key={key}>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                {key}
                              </p>
                              <p className="text-sm font-medium tabular">
                                {got}
                                <span className="text-muted-foreground">/{max}</span>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground tabular">
                        {row.words_spoken} words spoken
                      </p>
                    </>
                  )}

                  {fb.verdict && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {fb.verdict}
                    </p>
                  )}

                  {isYou && (fb.strengths?.length || fb.weaknesses?.length) ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {fb.strengths?.length ? (
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                            <CheckCircle2 className="size-3.5" /> Strengths
                          </p>
                          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {fb.strengths.map((sItem) => (
                              <li key={sItem}>· {sItem}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {fb.weaknesses?.length ? (
                        <div>
                          <p className="text-xs font-medium text-[var(--warning)]">
                            To work on
                          </p>
                          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {fb.weaknesses.map((wItem) => (
                              <li key={wItem}>· {wItem}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
