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
import type { AssignmentReviewRow } from "@/lib/types/database";

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
      "id, classroom_id, title, instructions, starts_at, due_at, max_marks, allow_resubmission, max_attempts, is_published, cases(slug, title), classrooms(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!assignment) notFound();

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

  const { data: scoreRows } = submissionIds.length
    ? await admin
        .from("scores")
        .select("submission_id, breakdown, feedback")
        .in("submission_id", submissionIds)
    : { data: [] };

  const detailBySubmission = new Map(
    (scoreRows ?? []).map((s) => [s.submission_id, s]),
  );

  const rows: AssignmentReviewRow[] = queue.map((row) => {
    const detail = row.submission_id
      ? detailBySubmission.get(row.submission_id)
      : undefined;
    return {
      ...row,
      // Prefer whatever the RPC gave us; fall back to the direct read.
      ai_breakdown: row.ai_breakdown ?? detail?.breakdown ?? null,
      ai_feedback: row.ai_feedback ?? detail?.feedback ?? null,
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
