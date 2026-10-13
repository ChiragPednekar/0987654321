import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AuthzError, requireAssignmentTeacher } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReviewQueue } from "@/components/teach/review-queue";
import { formatNumber } from "@/lib/utils";
import { photosForFindings } from "@/lib/proctor-evidence";
import type { AssignmentReviewRow } from "@/lib/types/database";
import { assignmentTarget, type AssignmentTarget } from "@/lib/assignments";

export const metadata: Metadata = { title: "Assignment" };

export default async function AssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    await requireAssignmentTeacher(id);
  } catch (error) {
    if (error instanceof AuthzError) notFound();
    throw error;
  }

  const admin = createAdminClient();

  const { data: assignment } = await admin
    .from("classroom_assignments")
    .select(
      "id, classroom_id, title, instructions, starts_at, due_at, max_marks, allow_resubmission, max_attempts, is_published, kind, question_ids, cases(slug, title), sql_exercises(slug, title), excel_exercises(slug, title), classrooms(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

  // SQL, Excel and aptitude work is marked by the platform, not read and
  // graded, so it gets a results table instead of the case review queue.
  const target = assignmentTarget(assignment);
  if (target.kind !== "case") {
    const roomRow = Array.isArray(assignment.classrooms) ? assignment.classrooms[0] : assignment.classrooms;
    return (
      <AutoMarkedAssignment
        id={id}
        title={assignment.title ?? target.itemTitle}
        roomName={(roomRow as { name?: string } | null)?.name ?? ""}
        dueAt={assignment.due_at}
        instructions={assignment.instructions}
        isPublished={assignment.is_published}
        target={target}
      />
    );
  }

  const { data } = await admin.rpc("assignment_review_queue", { p_assignment: id });
  const queue = (data ?? []) as AssignmentReviewRow[];

  /**
   * The AI's per-criterion split and written feedback, read straight from
   * `scores`.
   *
   * 20250101000025 extends assignment_review_queue to return these, but the
   * function is only as new as the last migration actually applied to the
   * database in front of it — and a teacher marking work is exactly the wrong
   * moment to discover the deployment is a migration behind. Reading the two
   * columns here means the breakdown shows up either way, and the page stops
   * depending on which version of the RPC it is talking to.
   *
   * One extra query for the whole queue, not one per student.
   */
  const submissionIds = queue
    .map((row) => row.submission_id)
    .filter((value): value is string => Boolean(value));

  const [{ data: scoreRows }, { data: integrityRows }] = await Promise.all([
    submissionIds.length
      ? admin
          .from("scores")
          .select("submission_id, breakdown, feedback")
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] }),
    submissionIds.length
      ? admin
          .from("submission_integrity")
          .select("id, user_id, created_at, server_elapsed_seconds, submission_id, severity, score, penalty_pct, flags, ai_likelihood, signals")
          .in("submission_id", submissionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const detailBySubmission = new Map(
    (scoreRows ?? []).map((s) => [s.submission_id, s]),
  );

  const integrityBySubmission = new Map(
    (integrityRows ?? []).map((i) => [i.submission_id, i]),
  );

  /**
   * Camera evidence for this assignment's submissions only. The page is
   * already limited to the assignment's own teacher (requireAssignmentTeacher),
   * and the photos are matched to each finding's own attempt window, so a
   * teacher sees exactly the photos from attempts handed in to them — the
   * "reviewer" the consent notice tells students about.
   */
  const photosByFinding = await photosForFindings(admin, integrityRows ?? []);

  const rows: AssignmentReviewRow[] = queue.map((row) => {
    const detail = row.submission_id
      ? detailBySubmission.get(row.submission_id)
      : undefined;
    const integ = row.submission_id
      ? integrityBySubmission.get(row.submission_id)
      : undefined;
    return {
      ...row,
      // Prefer whatever the RPC gave us; fall back to the direct read.
      ai_breakdown: row.ai_breakdown ?? detail?.breakdown ?? null,
      ai_feedback: row.ai_feedback ?? detail?.feedback ?? null,
      integrity: integ
        ? {
            severity: integ.severity as "clean" | "suspect" | "severe",
            score: integ.score,
            penalty_pct: integ.penalty_pct,
            flags: integ.flags ?? [],
            ai_likelihood: integ.ai_likelihood,
            signals: (integ.signals as Record<string, unknown>) ?? {},
            photos: photosByFinding.get(integ.id) ?? [],
          }
        : null,
    };
  });

  const c = Array.isArray(assignment.cases) ? assignment.cases[0] : assignment.cases;
  const room = Array.isArray(assignment.classrooms)
    ? assignment.classrooms[0]
    : assignment.classrooms;

  const submitted = rows.filter((r) => r.submitted_at);
  const notStarted = rows.filter((r) => !r.submitted_at);
  const awaiting = submitted.filter(
    (r) => r.status === "submitted" || r.status === "ai_graded",
  );
  const reviewed = submitted.filter((r) => r.status === "reviewed");
  const resub = submitted.filter((r) => r.status === "resubmission_requested");

  const aiScored = submitted.filter((r) => r.ai_percentage !== null);
  const avgAi = aiScored.length
    ? aiScored.reduce((a, r) => a + Number(r.ai_percentage), 0) / aiScored.length
    : null;
  const marked = submitted.filter((r) => r.faculty_marks !== null);
  const avgMark = marked.length
    ? marked.reduce((a, r) => a + Number(r.faculty_marks), 0) / marked.length
    : null;

  // Score distribution in quintiles — enough shape to spot a bimodal class
  // without pretending to more precision than 20 students support.
  const buckets = [0, 0, 0, 0, 0];
  for (const r of aiScored) {
    const pct = Number(r.ai_percentage);
    buckets[Math.min(4, Math.floor(pct / 20))] += 1;
  }
  const maxBucket = Math.max(...buckets, 1);

  return (
    <div>
      <Link href="/teacher/assignments" className="text-sm text-muted-foreground hover:text-foreground">
        ← Assignments
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {assignment.title ?? c?.title ?? "Assignment"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {room?.name}
            {assignment.due_at ? ` · due ${new Date(assignment.due_at).toLocaleString()}` : ""}
            {assignment.max_marks ? ` · out of ${assignment.max_marks}` : " · practice, no marks"}
          </p>
        </div>
        {!assignment.is_published ? <Badge variant="outline">Draft</Badge> : null}
      </div>

      {assignment.instructions ? (
        <Card className="mt-4">
          <CardContent className="p-4 text-sm">{assignment.instructions}</CardContent>
        </Card>
      ) : null}

      {c?.slug ? (
        <Link href={`/cases/${c.slug}`} className="mt-3 inline-block text-sm underline underline-offset-4">
          Open the case yourself
        </Link>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Submitted", `${submitted.length} / ${rows.length}`, `${notStarted.length} not started`],
          ["Awaiting review", String(awaiting.length), `${reviewed.length} marked`],
          ["AI average", avgAi !== null ? `${avgAi.toFixed(1)}%` : "—", `${aiScored.length} graded`],
          ["Your average", avgMark !== null ? avgMark.toFixed(1) : "—",
            assignment.max_marks ? `out of ${assignment.max_marks}` : "no marks set"],
        ].map(([label, value, sub]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {resub.length > 0 ? (
        <Card className="mt-4">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">{resub.length} awaiting resubmission</p>
            <p className="mt-0.5 text-muted-foreground">
              You sent these back. They return to the queue when handed in again.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {aiScored.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {buckets.map((n, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 text-muted-foreground tabular">
                    {i * 20}–{i * 20 + 19}%
                  </span>
                  <Progress value={(n / maxBucket) * 100} className="flex-1" />
                  <span className="w-8 shrink-0 text-right tabular">{n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {notStarted.length > 0 ? (
        <Card className="mt-6 border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base">
              Not started ({formatNumber(notStarted.length)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {notStarted.map((r) => r.full_name ?? r.email).join(", ")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6">
        <ReviewQueue
          assignmentId={id}
          maxMarks={assignment.max_marks ? Number(assignment.max_marks) : null}
          allowResubmission={assignment.allow_resubmission}
          rows={rows}
        />
      </div>
    </div>
  );
}

/**
 * Results for work the platform marks itself: a solved SQL or Excel exercise,
 * or an aptitude quiz scored against its key. No answer to read and no AI
 * grade, so the page is who has done it, how they scored, and who has not
 * started.
 */
async function AutoMarkedAssignment({
  id,
  title,
  roomName,
  dueAt,
  instructions,
  isPublished,
  target,
}: {
  id: string;
  title: string;
  roomName: string;
  dueAt: string | null;
  instructions: string | null;
  isPublished: boolean;
  target: AssignmentTarget;
}) {
  const admin = createAdminClient();
  const [{ data: queue }, { data: work }] = await Promise.all([
    admin.rpc("assignment_review_queue", { p_assignment: id }),
    admin
      .from("assignment_submissions")
      .select("user_id, auto_score, auto_max, attempt_number")
      .eq("assignment_id", id),
  ]);
  const rows = (queue ?? []) as AssignmentReviewRow[];
  const byUser = new Map((work ?? []).map((w) => [w.user_id, w]));
  const done = rows.filter((r) => r.submitted_at);
  const notStarted = rows.filter((r) => !r.submitted_at);
  const quiz = target.kind === "aptitude";
  const pcts = done
    .map((r) => byUser.get(r.user_id))
    .filter((w): w is NonNullable<typeof w> => Boolean(w?.auto_max))
    .map((w) => (Number(w.auto_score) / Number(w.auto_max)) * 100);
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;

  return (
    <div>
      <Link href="/teacher/assignments" className="text-sm text-muted-foreground hover:text-foreground">
        ← Assignments
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {target.kindLabel}
            {quiz ? ` · ${target.itemTitle}` : ""}
            {roomName ? ` · ${roomName}` : ""}
            {dueAt ? ` · due ${new Date(dueAt).toLocaleString()}` : ""}
          </p>
        </div>
        {!isPublished ? <Badge variant="outline">Draft</Badge> : null}
      </div>

      {instructions ? (
        <Card className="mt-4">
          <CardContent className="p-4 text-sm">{instructions}</CardContent>
        </Card>
      ) : null}

      {target.href ? (
        <Link href={target.href} className="mt-3 inline-block text-sm underline underline-offset-4">
          {quiz ? "Take the quiz yourself" : "Open the exercise yourself"}
        </Link>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          [quiz ? "Submitted" : "Solved", `${done.length} / ${rows.length}`, `${notStarted.length} not yet`],
          [quiz ? "Average score" : "Solve rate", quiz ? (avg !== null ? `${avg.toFixed(0)}%` : "—") : rows.length ? `${Math.round((done.length / rows.length) * 100)}%` : "—", quiz ? `${pcts.length} marked` : "of the batch"],
          ["Marked by", "Platform", quiz ? "against the answer key" : "checked against a hidden dataset"],
        ].map(([label, value, sub]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Students ({formatNumber(rows.length)})</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students in this batch yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const w = byUser.get(r.user_id);
                return (
                  <li key={r.user_id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.full_name ?? r.email}</span>
                    {r.submitted_at ? (
                      <>
                        <span className="tabular">
                          {quiz && w?.auto_max
                            ? `${Number(w.auto_score)} / ${Number(w.auto_max)}`
                            : "Solved"}
                        </span>
                        <span className="text-xs text-muted-foreground tabular">
                          {quiz
                            ? `attempt ${w?.attempt_number ?? 1}`
                            : `${w?.attempt_number ?? 1} ${w?.attempt_number === 1 ? "try" : "tries"}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.submitted_at).toLocaleString()}
                        </span>
                        {r.is_late ? <Badge variant="outline">Late</Badge> : null}
                      </>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600">Not started</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
