import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle, ClipboardCheck, GraduationCap, TrendingDown, Users,
} from "lucide-react";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/teacher/empty-state";
import { DOMAIN_LABEL } from "@/lib/constants";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import type { Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Teacher dashboard" };

/** A student counts as lapsed after this long without a graded submission. */
const STALE_DAYS = 14;

export default async function TeacherDashboard() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();
  const batchIds = await batchesTaughtBy(actor.id);

  if (batchIds.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No batches yet"
        body="Create your first batch to start assigning cases. Students join with a six-character code — no invites, no spreadsheets."
        action={{ href: "/teacher/batches", label: "Create a batch" }}
      />
    );
  }

  // Everything below is aggregated in the database rather than fetched row by
  // row: a teacher with 300 students should not pull 300 records to show four
  // numbers.
  const [
    { data: roster },
    { data: assignments },
    { data: submissions },
    { data: batches },
  ] = await Promise.all([
    admin
      .from("classroom_members")
      .select("user_id, classroom_id, users(full_name, email, cases_solved, ce)")
      .in("classroom_id", batchIds)
      .eq("role", "student"),
    admin
      .from("classroom_assignments")
      .select("id, title, due_at, is_published, max_marks, classroom_id, cases(title)")
      .in("classroom_id", batchIds),
    admin
      .from("assignment_submissions")
      .select("assignment_id, user_id, status, faculty_marks, submitted_at, submission_id")
      .in(
        "assignment_id",
        // Guard against an empty IN list, which PostgREST rejects.
        (
          await admin
            .from("classroom_assignments")
            .select("id")
            .in("classroom_id", batchIds)
        ).data?.map((a) => a.id) ?? ["00000000-0000-0000-0000-000000000000"],
      ),
    admin.from("classrooms").select("id, name, join_code").in("id", batchIds),
  ]);

  const students = roster ?? [];
  const uniqueStudents = new Set(students.map((s) => s.user_id));
  const allAssignments = assignments ?? [];
  const subs = submissions ?? [];

  const awaitingReview = subs.filter(
    (s) => s.status === "submitted" || s.status === "ai_graded",
  );
  const reviewed = subs.filter((s) => s.status === "reviewed");
  const needsResubmission = subs.filter(
    (s) => s.status === "resubmission_requested",
  );

  // Scores, for the class average and the weak-domain list.
  const submissionIds = subs.map((s) => s.submission_id).filter(Boolean) as string[];
  const { data: scores } = submissionIds.length
    ? await admin
        .from("scores")
        .select("percentage, case_id, user_id, evaluated_at")
        .in("submission_id", submissionIds)
    : { data: [] };

  const graded = scores ?? [];
  const classAverage = graded.length
    ? graded.reduce((a, s) => a + Number(s.percentage), 0) / graded.length
    : null;

  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  const activeIds = new Set(
    graded
      .filter((s) => new Date(s.evaluated_at).getTime() >= cutoff)
      .map((s) => s.user_id),
  );
  const submittedIds = new Set(subs.map((s) => s.user_id));
  const neverStarted = [...uniqueStudents].filter((id) => !submittedIds.has(id));

  const published = allAssignments.filter((a) => a.is_published);
  const overdue = published.filter(
    (a) => a.due_at && new Date(a.due_at) < new Date(),
  );
  const upcoming = published
    .filter((a) => a.due_at && new Date(a.due_at) >= new Date())
    .sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1))
    .slice(0, 5);

  // Weakest domains across the batches, from the teacher's own students only.
  const { data: domainRows } = uniqueStudents.size
    ? await admin
        .from("domain_progress")
        .select("domain, avg_percentage, cases_solved")
        .in("user_id", [...uniqueStudents])
    : { data: [] };

  const byDomain = new Map<string, { total: number; n: number; solved: number }>();
  for (const row of domainRows ?? []) {
    const entry = byDomain.get(row.domain) ?? { total: 0, n: 0, solved: 0 };
    entry.total += Number(row.avg_percentage ?? 0);
    entry.n += 1;
    entry.solved += row.cases_solved;
    byDomain.set(row.domain, entry);
  }
  const weakest = [...byDomain.entries()]
    .map(([domain, v]) => ({ domain, avg: v.total / v.n, solved: v.solved }))
    .sort((a, b) => a.avg - b.avg);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(uniqueStudents.size)} students across{" "}
            {formatNumber(batchIds.length)}{" "}
            {batchIds.length === 1 ? "batch" : "batches"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/teacher/questions/new">New question</Link>
          </Button>
          <Button asChild>
            <Link href="/teacher/assignments/new">New assignment</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Students"
          value={formatNumber(uniqueStudents.size)}
          sublabel={`${formatNumber(activeIds.size)} active in ${STALE_DAYS} days`}
          icon={Users}
        />
        <StatCard
          label="Awaiting review"
          value={formatNumber(awaitingReview.length)}
          sublabel={`${formatNumber(reviewed.length)} already marked`}
          icon={ClipboardCheck}
          accent={awaitingReview.length > 0 ? "text-amber-500" : undefined}
        />
        <StatCard
          label="Active assignments"
          value={formatNumber(published.length)}
          sublabel={
            overdue.length > 0 ? `${overdue.length} past due` : "none overdue"
          }
          icon={GraduationCap}
        />
        <StatCard
          label="Class average"
          value={classAverage !== null ? `${classAverage.toFixed(1)}%` : "—"}
          sublabel={`${formatNumber(graded.length)} graded submissions`}
          icon={TrendingDown}
        />
      </div>

      {neverStarted.length > 0 ? (
        <Card className="mt-6 border-amber-500/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium">
                {neverStarted.length}{" "}
                {neverStarted.length === 1 ? "student has" : "students have"} not
                submitted anything yet
              </p>
              <p className="mt-0.5 text-muted-foreground">
                They are enrolled but have never handed in. Worth a nudge before
                the term narrows.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {needsResubmission.length > 0 ? (
        <Card className="mt-4">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">
              {needsResubmission.length} awaiting resubmission
            </p>
            <p className="mt-0.5 text-muted-foreground">
              You asked these students to try again. They reappear here once they
              hand in.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing due. {published.length === 0 ? "No assignments published yet." : ""}
              </p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((a) => {
                  const c = Array.isArray(a.cases) ? a.cases[0] : a.cases;
                  const mine = subs.filter((s) => s.assignment_id === a.id);
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/teacher/assignments/${a.id}`}
                        className="group flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm group-hover:underline">
                            {a.title ?? c?.title ?? "Assignment"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            due {new Date(a.due_at!).toLocaleDateString()}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {mine.length} in
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weakest domains</CardTitle>
          </CardHeader>
          <CardContent>
            {weakest.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No graded work yet — this fills in once students start
                submitting.
              </p>
            ) : (
              <ul className="space-y-3">
                {weakest.slice(0, 6).map((row) => (
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
            <p className="mt-4 text-xs text-muted-foreground">
              Weakest first — the list to build revision around.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your batches</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {(batches ?? []).map((b) => {
              const count = students.filter((s) => s.classroom_id === b.id).length;
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/teacher/batches/${b.id}`}
                    className="font-medium hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="tabular">{count} students</span>
                    <Badge variant="outline" className="font-mono">
                      {b.join_code}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
