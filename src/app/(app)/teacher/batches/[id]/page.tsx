import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { AuthzError, requireBatchTeacher } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { RosterTable } from "@/components/institution/roster-table";
import { BatchControls } from "@/components/teacher/batch-controls";
import { DOMAIN_LABEL } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import type { Domain, InstitutionRosterRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Batch" };

const STALE_DAYS = 14;

export default async function BatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Proves this teacher owns this batch. A 404 for anyone else, so probing ids
  // reveals nothing.
  try {
    await requireBatchTeacher(id);
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const admin = createAdminClient();

  const [{ data: batch }, { data: members }, { data: assignments }] =
    await Promise.all([
      admin.from("classrooms").select("*").eq("id", id).maybeSingle(),
      admin
        .from("classroom_members")
        .select(
          "user_id, joined_at, users(full_name, email, cases_solved, cases_attempted, ce)",
        )
        .eq("classroom_id", id)
        .eq("role", "student"),
      admin
        .from("classroom_assignments")
        .select("id, title, due_at, is_published, max_marks, cases(title)")
        .eq("classroom_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!batch) notFound();

  const studentIds = (members ?? []).map((m) => m.user_id);

  const [{ data: scores }, { data: domains }, { data: interviewRows }] =
    await Promise.all([
      studentIds.length
        ? admin
            .from("scores")
            .select("user_id, percentage, evaluated_at")
            .in("user_id", studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? admin
            .from("domain_progress")
            .select("domain, avg_percentage, cases_solved")
            .in("user_id", studentIds)
        : Promise.resolve({ data: [] }),
      // Mock-interview counts. The roster column existed but was fed a literal
      // zero, so every student looked as though they had never used the
      // interviewer — the one feature with a real per-use cost.
      studentIds.length
        ? admin
            .from("chat_sessions")
            .select("user_id")
            .in("user_id", studentIds)
        : Promise.resolve({ data: [] }),
    ]);

  const interviewsByUser = new Map<string, number>();
  for (const row of interviewRows ?? []) {
    interviewsByUser.set(row.user_id, (interviewsByUser.get(row.user_id) ?? 0) + 1);
  }

  const graded = scores ?? [];
  const avg = graded.length
    ? graded.reduce((a, s) => a + Number(s.percentage), 0) / graded.length
    : null;

  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  const lastActive = new Map<string, string>();
  for (const s of graded) {
    const cur = lastActive.get(s.user_id);
    if (!cur || s.evaluated_at > cur) lastActive.set(s.user_id, s.evaluated_at);
  }
  const active = [...lastActive.values()].filter(
    (t) => new Date(t).getTime() >= cutoff,
  ).length;

  const avgByUser = new Map<string, { total: number; n: number }>();
  for (const s of graded) {
    const e = avgByUser.get(s.user_id) ?? { total: 0, n: 0 };
    e.total += Number(s.percentage);
    e.n += 1;
    avgByUser.set(s.user_id, e);
  }

  const roster: InstitutionRosterRow[] = (members ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    const a = avgByUser.get(m.user_id);
    return {
      user_id: m.user_id,
      full_name: u?.full_name ?? null,
      email: u?.email ?? "",
      cases_solved: u?.cases_solved ?? 0,
      cases_attempted: u?.cases_attempted ?? 0,
      ce: u?.ce ?? 0,
      avg_percentage: a ? a.total / a.n : null,
      last_active: lastActive.get(m.user_id) ?? null,
      interviews: interviewsByUser.get(m.user_id) ?? 0,
    };
  });

  const byDomain = new Map<string, { total: number; n: number }>();
  for (const d of domains ?? []) {
    const e = byDomain.get(d.domain) ?? { total: 0, n: 0 };
    e.total += Number(d.avg_percentage ?? 0);
    e.n += 1;
    byDomain.set(d.domain, e);
  }
  const weakest = [...byDomain.entries()]
    .map(([domain, v]) => ({ domain, avg: v.total / v.n }))
    .sort((a, b) => a.avg - b.avg);

  return (
    <div>
      <Link href="/teacher/batches" className="text-sm text-muted-foreground hover:text-foreground">
        ← Batches
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{batch.name}</h1>
          {batch.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{batch.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {batch.archived ? (
            <Badge variant="secondary">Archived</Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-sm">
              Join code {batch.join_code}
            </Badge>
          )}
          <BatchControls
            classroomId={id}
            name={batch.name}
            archived={Boolean(batch.archived)}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={formatNumber(roster.length)} icon={Users} />
        <StatCard
          label={`Active in ${STALE_DAYS}d`}
          value={formatNumber(active)}
          sublabel={roster.length ? `${Math.round((active / roster.length) * 100)}%` : undefined}
          icon={Users}
        />
        <StatCard
          label="Assignments"
          value={formatNumber((assignments ?? []).filter((a) => a.is_published).length)}
          sublabel={`${(assignments ?? []).filter((a) => !a.is_published).length} draft`}
          icon={Users}
        />
        <StatCard
          label="Batch average"
          value={avg !== null ? `${avg.toFixed(1)}%` : "—"}
          sublabel={`${formatNumber(graded.length)} graded`}
          icon={Users}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing assigned yet. Create an assignment to give this batch
              something to work on.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => {
                const c = Array.isArray(a.cases) ? a.cases[0] : a.cases;
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/teacher/assignments/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {a.title ?? c?.title ?? "Assignment"}
                    </Link>
                    {!a.is_published ? <Badge variant="outline">Draft</Badge> : null}
                    {a.due_at ? (
                      <span className="text-xs text-muted-foreground">
                        due {new Date(a.due_at).toLocaleDateString()}
                      </span>
                    ) : null}
                    {a.max_marks ? (
                      <span className="text-xs text-muted-foreground tabular">
                        out of {a.max_marks}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Performance by domain</CardTitle>
        </CardHeader>
        <CardContent>
          {weakest.length === 0 ? (
            <p className="text-sm text-muted-foreground">No graded work yet.</p>
          ) : (
            <ul className="space-y-3">
              {weakest.map((row) => (
                <li key={row.domain} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm">
                    {DOMAIN_LABEL[row.domain as Domain]}
                  </span>
                  <Progress value={row.avg} className="flex-1" />
                  <span className="w-12 shrink-0 text-right text-sm tabular">
                    {row.avg.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Roster{" "}
            <span className="text-sm font-normal text-muted-foreground tabular">
              ({formatNumber(roster.length)})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* The teacher of this batch may unenrol a student; the placement
              dashboard renders the same table without this prop. */}
          <RosterTable
            students={roster}
            staleDays={STALE_DAYS}
            removeFromClassroomId={id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
