import Link from "next/link";
import type { Metadata } from "next";
import { Copy, ExternalLink, MessageSquare, PhoneOff, Users, Video } from "lucide-react";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Section, SectionEmpty, SectionList } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeacherGdDialog } from "@/components/teacher/teacher-gd-dialog";
import { TeacherGdSessionActions } from "@/components/teacher/teacher-gd-session-actions";
import { formatDay, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Group Discussions — Teacher" };

export default async function TeacherDiscussionsPage() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();
  const batchIds = await batchesTaughtBy(actor.id);

  const [
    { data: batches },
    { data: topics },
    { data: teacherSessions },
  ] = await Promise.all([
    batchIds.length
      ? admin.from("classrooms").select("id, name").in("id", batchIds).order("name")
      : Promise.resolve({ data: [] }),
    admin
      .from("gd_topics")
      .select("id, title, prompt, category")
      .eq("is_published", true)
      .order("category")
      .order("title")
      .limit(100),
    admin
      .from("gd_sessions")
      .select("id, topic_id, host_id, classroom_id, status, join_policy, max_participants, created_at, gd_topics(title, prompt)")
      .eq("host_id", actor.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const sessions = teacherSessions ?? [];
  const sessionIds = sessions.map((s) => s.id);

  const { data: participants } = sessionIds.length
    ? await admin
        .from("gd_participants")
        .select("session_id, user_id, admission_status, left_at")
        .in("session_id", sessionIds)
        .eq("admission_status", "approved")
        .is("left_at", null)
    : { data: [] };

  const countBySession = new Map<string, number>();
  for (const p of participants ?? []) {
    countBySession.set(p.session_id, (countBySession.get(p.session_id) ?? 0) + 1);
  }

  const batchById = new Map((batches ?? []).map((b) => [b.id, b.name]));

  const liveSessions = sessions.filter((s) => s.status === "open" || s.status === "live");
  const pastSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled");

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ Header --- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Teaching · Live Practice
          </p>
          <h1 className="mt-1 font-editorial text-[2.6rem] font-normal leading-[1.02] tracking-[-0.02em]">
            Group Discussions
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Host live, Google Meet-style group discussions with your batches. Practice communication, argument framing,
            and discussion etiquette without any proctoring interference.
          </p>
        </div>

        <TeacherGdDialog
          topics={topics ?? []}
          batches={batches ?? []}
          triggerLabel="Host discussion"
        />
      </div>

      {/* --------------------------------------- Feature Explainer Banner --- */}
      <div className="rounded-lg border border-border bg-card/60 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-border/80 bg-background p-3.5">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">1. Google Meet Experience</span>
            <p className="mt-1 text-sm font-semibold">Live Video &amp; Reactions</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Multi-peer audio and video, hand-raising, and floating emoji reactions.
            </p>
          </div>
          <div className="rounded border border-border/80 bg-background p-3.5">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">2. Frictionless Sharing</span>
            <p className="mt-1 text-sm font-semibold">1-Click Student Link</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Direct entry for open links. Private rooms require teacher admission.
            </p>
          </div>
          <div className="rounded border border-border/80 bg-background p-3.5">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">3. Meeting Chat</span>
            <p className="mt-1 text-sm font-semibold">Media &amp; Note Sharing</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Real-time in-call chat with image and video sharing up to 25 MB.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- Active Sessions --- */}
      <Section title="Active discussion rooms" count={liveSessions.length}>
        {liveSessions.length === 0 ? (
          <SectionEmpty>
            No active discussion rooms. Click &quot;Host discussion&quot; to start a session and send the link to your students.
          </SectionEmpty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {liveSessions.map((session) => {
              const topic = Array.isArray(session.gd_topics) ? session.gd_topics[0] : session.gd_topics;
              const batchName = session.classroom_id ? batchById.get(session.classroom_id) : null;
              const currentCount = countBySession.get(session.id) ?? 0;

              return (
                <Card key={session.id} className="border-foreground/30">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Now
                          </span>
                          {session.join_policy === "open" ? (
                            <Badge variant="outline" className="font-mono text-[10px]">Open link</Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-[10px]">Approval required</Badge>
                          )}
                        </div>
                        <h3 className="mt-2 font-editorial text-xl font-normal">
                          {topic?.title ?? "Group Discussion"}
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground tabular">
                        <Users className="mr-1 inline size-3.5" />
                        {currentCount}/{session.max_participants}
                      </span>
                    </div>

                    {topic?.prompt && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {topic.prompt}
                      </p>
                    )}

                    {batchName && (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Batch: <span className="text-foreground">{batchName}</span>
                      </p>
                    )}

                    <div className="border-t border-border pt-3">
                      <TeacherGdSessionActions
                        sessionId={session.id}
                        topicTitle={topic?.title ?? "Group Discussion"}
                        batchName={batchName ?? undefined}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      {/* --------------------------------------------- Past Sessions --- */}
      {pastSessions.length > 0 && (
        <Section title="Past discussion rooms" count={pastSessions.length}>
          <SectionList>
            {pastSessions.map((session) => {
              const topic = Array.isArray(session.gd_topics) ? session.gd_topics[0] : session.gd_topics;
              const batchName = session.classroom_id ? batchById.get(session.classroom_id) : null;

              return (
                <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <div>
                    <span className="text-sm font-medium">{topic?.title ?? "Discussion"}</span>
                    {batchName && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        ({batchName})
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Ended · {timeAgo(session.created_at)}
                  </span>
                </li>
              );
            })}
          </SectionList>
        </Section>
      )}
    </div>
  );
}
