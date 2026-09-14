import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { GdRoom } from "@/components/gd/gd-room";
import { GdJoinGate } from "@/components/gd/gd-join-gate";

export const metadata: Metadata = { title: "Group discussion" };

export default async function GdRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/gd/${id}`);

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("gd_sessions")
    .select("id, status, prep_seconds, discussion_seconds, started_at, max_participants, gd_topics(title, prompt)")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();
  if (session.status === "completed") redirect(`/gd/${id}/result`);

  const topic = Array.isArray(session.gd_topics) ? session.gd_topics[0] : session.gd_topics;

  const { data: participants } = await admin
    .from("gd_participants")
    .select("user_id, users(full_name, email)")
    .eq("session_id", id);

  const people = participants ?? [];
  const joined = people.some((p) => p.user_id === user.id);

  const names = people.map((p) => {
    const u = Array.isArray(p.users) ? p.users[0] : p.users;
    return {
      userId: p.user_id,
      name: u?.full_name || u?.email?.split("@")[0] || "Participant",
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground">
            Topic
          </p>
          <h1 className="mt-1 text-lg font-semibold">{topic?.title}</h1>
          {topic?.prompt ? (
            <p className="mt-2 text-sm text-muted-foreground">{topic.prompt}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4">
        {joined ? (
          <GdRoom
            sessionId={id}
            userId={user.id}
            names={names}
            prepSeconds={session.prep_seconds}
            discussionSeconds={session.discussion_seconds}
            startedAt={session.started_at}
          />
        ) : (
          <GdJoinGate
            sessionId={id}
            occupied={people.length}
            capacity={session.max_participants}
          />
        )}
      </div>
    </div>
  );
}
