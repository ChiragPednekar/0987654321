import Link from "next/link";
import type { Metadata } from "next";
import { requireTeacherActor, batchesTaughtBy } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/teacher/empty-state";
import { Note, Section, SectionEmpty, SectionList } from "@/components/section";
import { DOMAIN_LABEL } from "@/lib/constants";
import { formatDay, formatNumber, plural } from "@/lib/utils";
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

  // eslint-disable-next-line react-hooks/purity -- async server component: renders once per request, so reading the clock here is the request time, not a re-render hazard.
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
      <div className="dashboard-hero flex flex-wrap items-end justify-between gap-4 p-6 sm:p-8">
        <div>
          <h1 className="font-editorial text-[2.6rem] font-normal leading-[1.02] tracking-[-0.02em]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(uniqueStudents.size)}{" "}
            {uniqueStudents.size === 1 ? "student" : "students"} across{" "}
            {formatNumber(batchIds.length)}{" "}
            {batchIds.length === 1 ? "batch" : "batches"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/teacher/discussions">Group discussion</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/questions/new">New question</Link>
          </Button>
          <Button variant="ink" asChild>
            <Link href="/teacher/assignments/new">New assignment</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <StatCard
          label="Students"
          value={formatNumber(uniqueStudents.size)}
          sublabel={`${formatNumber(activeIds.size)} active in ${STALE_DAYS} days`}
        />
        <StatCard
          label="Awaiting review"
          value={formatNumber(awaitingReview.length)}
          sublabel={`${formatNumber(reviewed.length)} already marked`}
          tone={awaitingReview.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Active assignments"
          value={formatNumber(published.length)}
          sublabel={
            overdue.length > 0 ? `${overdue.length} past due` : "none overdue"
          }
          tone={overdue.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Class average"
          value={classAverage !== null ? `${classAverage.toFixed(1)}%` : "—"}
          sublabel={`${formatNumber(graded.length)} graded submissions`}
        />
      </div>

      {neverStarted.length > 0 || needsResubmission.length > 0 ? (
        <div className="mt-8 space-y-3">
          {neverStarted.length > 0 && (
            <Note
              tone="warning"
              title={`${neverStarted.length} ${neverStarted.length === 1 ? "student has" : "students have"} not submitted anything yet`}
            >
              They are enrolled but have never handed in. Worth a nudge before
              the term narrows.
            </Note>
          )}
          {needsResubmission.length > 0 && (
            <Note title={`${needsResubmission.length} awaiting resubmission`}>
              You asked these students to try again. They reappear here once
              they hand in.
            </Note>
          )}
        </div>
      ) : null}

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section
          title="Upcoming deadlines"
          action={
            <Link href="/teacher/assignments" className="text-xs text-muted-foreground hover:text-foreground">
              All assignments
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <SectionEmpty>
              Nothing due. {published.length === 0 ? "No assignments published yet." : ""}
            </SectionEmpty>
          ) : (
            <SectionList>
              {upcoming.map((a) => {
                const c = Array.isArray(a.cases) ? a.cases[0] : a.cases;
                const mine = subs.filter((s) => s.assignment_id === a.id);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/teacher/assignments/${a.id}`}
                      className="group flex items-baseline gap-4 py-3"
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                        {formatDay(a.due_at!)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm group-hover:underline">
                        {a.title ?? c?.title ?? "Assignment"}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular">
                        {mine.length} handed in
                      </span>
                    </Link>
                  </li>
                );
              })}
            </SectionList>
          )}
        </Section>

        <Section title="Weakest domains" description="Weakest first — the list to build revision around.">
          {weakest.length === 0 ? (
            <SectionEmpty>
              No graded work yet — this fills in once students start
              submitting.
            </SectionEmpty>
          ) : (
            <SectionList>
              {weakest.slice(0, 6).map((row) => (
                <li key={row.domain} className="flex items-center gap-3 py-3">
                  <span className="w-36 shrink-0 truncate text-sm">
                    {DOMAIN_LABEL[row.domain as Domain]}
                  </span>
                  <Progress value={row.avg} className="flex-1" />
                  <span className="w-12 shrink-0 text-right font-mono text-sm tabular">
                    {row.avg.toFixed(0)}%
                  </span>
                </li>
              ))}
            </SectionList>
          )}
        </Section>
      </div>

      <Section
        title="Your batches"
        count={(batches ?? []).length}
        action={
          <Link href="/teacher/batches" className="text-xs text-muted-foreground hover:text-foreground">
            Manage batches
          </Link>
        }
      >
        <SectionList>
          {(batches ?? []).map((b) => {
            const count = students.filter((s) => s.classroom_id === b.id).length;
            return (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <Link
                  href={`/teacher/batches/${b.id}`}
                  className="font-medium hover:underline"
                >
                  {b.name}
                </Link>
                <span className="flex items-baseline gap-4 text-xs text-muted-foreground">
                  <span className="tabular">{plural(count, "student")}</span>
                  <span className="font-mono">
                    code <span className="text-foreground">{b.join_code}</span>
                  </span>
                </span>
              </li>
            );
          })}
        </SectionList>
      </Section>
    </div>
  );
}
