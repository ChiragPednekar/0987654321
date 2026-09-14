import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OpenGdForm } from "@/components/gd/open-gd-form";
import { plural, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Group discussions" };

/** The GD lobby: open rooms to join, and your own past discussions. */
export default async function GdLobbyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/gd");

  const admin = createAdminClient();

  const [{ data: open }, { data: mine }] = await Promise.all([
    admin
      .from("gd_sessions")
      .select("id, created_at, max_participants, gd_topics(title), gd_participants(user_id)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("gd_scores")
      .select("session_id, total, max_score, outcome, created_at, gd_sessions(gd_topics(title))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const rooms = open ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Group discussions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Six people, one topic, ten minutes. Everyone is marked separately on
            what they contributed.
          </p>
        </div>
        <OpenGdForm />
      </div>

      {/*
        Said before anyone joins, because it decides whether a student can be
        marked at all and there is nothing we can do about it from here.
      */}
      <Card className="mt-6 border-muted">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Use Chrome or Edge on a laptop. Marking works by each browser
          transcribing its own microphone, and Firefox and Safari cannot do it —
          you can still take part, but your contribution will show as
          &ldquo;not transcribed&rdquo; rather than being marked.
        </CardContent>
      </Card>

      <h2 className="mt-8 text-sm font-semibold text-foreground">
        Rooms waiting
      </h2>
      {rooms.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No rooms open. Open one and share the link with your batch.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 space-y-2">
          {rooms.map((room) => {
            const topic = Array.isArray(room.gd_topics) ? room.gd_topics[0] : room.gd_topics;
            const count = (room.gd_participants ?? []).length;
            const full = count >= room.max_participants;
            return (
              <Card key={room.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{topic?.title ?? "Topic"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <Users className="mr-1 inline size-3" />
                      {count}/{room.max_participants} · opened {timeAgo(room.created_at)}
                    </p>
                  </div>
                  {full ? (
                    <Badge variant="secondary">Full</Badge>
                  ) : (
                    <Link
                      href={`/gd/${room.id}`}
                      className="rounded-md bg-action px-3 py-1.5 text-sm font-medium text-action-foreground hover:bg-action-hover"
                    >
                      Join
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(mine ?? []).length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-foreground">
            Your discussions
          </h2>
          <div className="mt-3 space-y-2">
            {(mine ?? []).map((row) => {
              const s = Array.isArray(row.gd_sessions) ? row.gd_sessions[0] : row.gd_sessions;
              const t = s && (Array.isArray(s.gd_topics) ? s.gd_topics[0] : s.gd_topics);
              return (
                <Link key={row.session_id} href={`/gd/${row.session_id}/result`}>
                  <Card className="transition-colors hover:border-foreground/25">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t?.title ?? "Discussion"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {timeAgo(row.created_at)}
                        </p>
                      </div>
                      {row.outcome === "scored" ? (
                        <span className="text-sm font-semibold tabular">
                          {row.total}/{row.max_score}
                        </span>
                      ) : (
                        <Badge variant="outline">
                          {row.outcome === "silent" ? "did not speak" : "not transcribed"}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {plural((mine ?? []).length, "discussion")} marked.
          </p>
        </>
      )}
    </div>
  );
}
