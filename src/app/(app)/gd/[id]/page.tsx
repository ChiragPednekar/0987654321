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
    .select("id, status, host_id, join_policy, max_participants, gd_topics(title, prompt)")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();
  if (session.status === "completed" || session.status === "cancelled") redirect("/gd");

  const topic = Array.isArray(session.gd_topics) ? session.gd_topics[0] : session.gd_topics;

  const { data: participants } = await admin
    .from("gd_participants")
    .select("user_id, admission_status, left_at, users(full_name, email)")
    .eq("session_id", id);

  let people = (participants ?? []).filter(
    (participant) => participant.admission_status === "approved" && !participant.left_at,
  );
  let joined = user.id === session.host_id || people.some((person) => person.user_id === user.id);
  let myStatus = (participants ?? []).find((person) => person.user_id === user.id)?.admission_status ?? null;

  // For open rooms: no permission needed, directly admit the visitor into the meeting
  if (!joined && session.join_policy === "open" && people.length < session.max_participants) {
    const { error: joinError } = await admin.from("gd_participants").upsert(
      {
        session_id: id,
        user_id: user.id,
        admission_status: "approved",
        left_at: null,
      },
      { onConflict: "session_id,user_id" },
    );
    if (!joinError) {
      joined = true;
      myStatus = "approved";
      const { data: profile } = await admin
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();
      people = [
        ...people,
        {
          user_id: user.id,
          admission_status: "approved" as const,
          left_at: null,
          users: {
            full_name: profile?.full_name ?? null,
            email: profile?.email ?? user.email ?? "",
          },
        },
      ];
    }
  }

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
            hostId={session.host_id}
            joinPolicy={session.join_policy}
            names={names}
          />
        ) : (
          <GdJoinGate
            sessionId={id}
            occupied={people.length}
            capacity={session.max_participants}
            joinPolicy={session.join_policy}
            initialStatus={myStatus}
          />
        )}
      </div>
    </div>
  );
}
