import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Users, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OpenGdForm } from "@/components/gd/open-gd-form";
import { timeAgo } from "@/lib/utils";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Group discussions" };

/** The GD lobby: public meetings to join, and your past discussions. */
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
      .select("id, created_at, max_participants, gd_topics(title)")
      .eq("status", "open")
      .eq("join_policy", "open")
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
  const { data: activeParticipants } = rooms.length > 0
    ? await admin.from("gd_participants")
      .select("session_id")
      .in("session_id", rooms.map((room) => room.id))
      .eq("admission_status", "approved")
      .is("left_at", null)
    : { data: [] };
  const countByRoom = new Map<string, number>();
  for (const participant of activeParticipants ?? []) {
    countByRoom.set(participant.session_id, (countByRoom.get(participant.session_id) ?? 0) + 1);
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Community"
        title="Group discussions"
        subtitle="Meet your group, talk through a topic, and share notes in chat. Use an open link or let the host approve each person."
        stats={[{ value: rooms.length, label: rooms.length === 1 ? "open room" : "open rooms" }]}
        actions={<OpenGdForm />}
      />

      <Card className="mt-6 border-muted">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Your camera and microphone are optional. Share the room link with your
          group; private rooms ask the host to admit each guest.
        </CardContent>
      </Card>

      <h2 className="mt-8 text-sm font-semibold text-foreground">
        Open rooms
      </h2>
      {rooms.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={MessagesSquare}
          title="No rooms open"
          description="Open one and share the link with your batch."
        />
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {rooms.map((room) => {
            const topic = Array.isArray(room.gd_topics) ? room.gd_topics[0] : room.gd_topics;
            const count = countByRoom.get(room.id) ?? 0;
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
            Past marked practice
          </h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
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
            These are results from earlier assessed discussions. New meetings are
            private calls and are not recorded or graded.
          </p>
        </>
      )}
    </Page>
  );
}
