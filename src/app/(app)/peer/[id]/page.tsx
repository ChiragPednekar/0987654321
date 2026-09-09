import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { canSolve } from "@/lib/entitlement";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { PeerRoom } from "@/components/peer/peer-room";
import type { RubricCriteria } from "@/lib/types/database";

export const metadata: Metadata = { title: "Peer interview" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

/**
 * The interview room, served per role.
 *
 * `cases.model_answer` and `expected_framework` are revoked from ordinary reads
 * so a candidate cannot look up the answer. The interviewer genuinely needs
 * them — that is what lets an ordinary student run a competent interview and
 * push on the right things.
 *
 * So the split happens here, on the server, and the candidate's page is never
 * sent the answer at all. Fetching it and hiding it behind a conditional would
 * put it one devtools tab away, which for this feature is the whole ballgame.
 */
export default async function PeerRoomPage({ params }: PageProps) {
  const { id } = await params;

  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/peer/${id}`);

  const admin = createAdminClient();
  if (!(await canSolve(admin, profile.id))) redirect("/peer");

  const { data: session } = await admin
    .from("peer_sessions")
    .select("id, case_id, host_id, guest_id, host_role, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  const isHost = session.host_id === profile.id;
  const isGuest = session.guest_id === profile.id;
  const isOpenSeat = session.status === "open" && !session.guest_id && !isHost;

  // Not in the room and no seat left — nothing here for you.
  if (!isHost && !isGuest && !isOpenSeat) redirect("/peer");

  const myRole: "interviewer" | "candidate" = isHost
    ? session.host_role
    : session.host_role === "interviewer"
      ? "candidate"
      : "interviewer";

  const interviewing = myRole === "interviewer";

  // The candidate's query deliberately omits model_answer and
  // expected_framework. Two queries rather than one filtered afterwards.
  const columns = interviewing
    ? "id, slug, title, domain, difficulty, estimated_minutes, scenario, supporting_data, instructions, expected_framework, model_answer, rubrics(criteria, max_score, pass_score)"
    : "id, slug, title, domain, difficulty, estimated_minutes, scenario, supporting_data, instructions, rubrics(criteria, max_score, pass_score)";

  const { data: caseRow } = await admin
    .from("cases")
    .select(columns)
    .eq("id", session.case_id)
    .maybeSingle();

  if (!caseRow) notFound();

  // The column list is chosen at runtime by role, which defeats the typed
  // select inference — hence the cast. The safety that matters is upstream:
  // the candidate's query never asked for the answer in the first place.
  const c = caseRow as unknown as Record<string, unknown>;
  const rubric = Array.isArray(c.rubrics) ? c.rubrics[0] : c.rubrics;
  const criteria = (rubric as { criteria?: RubricCriteria } | null)?.criteria ?? {};
  const maxScore = (rubric as { max_score?: number } | null)?.max_score ?? 100;

  const otherId = isHost ? session.guest_id : session.host_id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/peer" className="text-xs text-muted-foreground hover:underline">
            ← Peer interviews
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">
            {String(c.title)}
          </h1>
        </div>
        <Badge
          variant={interviewing ? "default" : "outline"}
          className="gap-1.5"
        >
          {interviewing ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          You are the {myRole}
        </Badge>
      </div>

      <PeerRoom
        sessionId={session.id}
        userId={profile.id}
        otherUserId={otherId}
        status={session.status}
        needsJoin={isOpenSeat}
        role={myRole}
        criteria={criteria as RubricCriteria}
        maxScore={maxScore}
        scenario={
          <div className="space-y-4">
            <Markdown>{String(c.scenario ?? "")}</Markdown>
            {Boolean(c.instructions) && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {interviewing ? "What to ask them for" : "Your task"}
                  </p>
                  <div className="mt-2 text-sm">
                    <Markdown>{String(c.instructions)}</Markdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        }
        interviewerNotes={
          interviewing ? (
            <div className="space-y-4">
              {Boolean(c.expected_framework) && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Expected structure
                  </p>
                  <div className="mt-1.5 text-sm">
                    <Markdown>{String(c.expected_framework)}</Markdown>
                  </div>
                </div>
              )}
              {Boolean(c.model_answer) && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Model answer — do not read aloud
                  </p>
                  <div className="mt-1.5 text-sm">
                    <Markdown>{String(c.model_answer)}</Markdown>
                  </div>
                </div>
              )}
            </div>
          ) : null
        }
      />
    </div>
  );
}
