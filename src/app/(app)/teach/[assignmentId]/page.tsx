import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewQueue } from "@/components/teach/review-queue";
import { formatNumber } from "@/lib/utils";
import type { AssignmentReviewRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Review submissions" };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;

  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/teach/${assignmentId}`);

  const admin = createAdminClientOrNull();
  if (!admin) redirect("/teach");

  const { data: assignment } = await admin
    .from("classroom_assignments")
    .select("id, classroom_id, due_at, note, max_marks, cases(slug, title), classrooms(name)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) notFound();

  // Teachers only. The rollup below reads other students' answers, which no
  // ordinary session is granted, so this check is the gate.
  const { data: membership } = await admin
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", assignment.classroom_id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (membership?.role !== "teacher") redirect("/classrooms");

  const { data } = await admin.rpc("assignment_review_queue", {
    p_assignment: assignmentId,
  });
  const rows = (data ?? []) as AssignmentReviewRow[];

  const c = Array.isArray(assignment.cases) ? assignment.cases[0] : assignment.cases;
  const room = Array.isArray(assignment.classrooms)
    ? assignment.classrooms[0]
    : assignment.classrooms;

  const submitted = rows.filter((r) => r.submitted_at);
  const pending = submitted.filter((r) => r.status !== "reviewed");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/teach" className="text-sm text-muted-foreground hover:text-foreground">
        ← Teaching
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {c?.title ?? "Assignment"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {room?.name}
          {assignment.due_at
            ? ` · due ${new Date(assignment.due_at).toLocaleDateString()}`
            : ""}
          {assignment.max_marks ? ` · out of ${assignment.max_marks}` : " · practice, no marks"}
        </p>
        {assignment.note ? (
          <p className="mt-2 text-sm">{assignment.note}</p>
        ) : null}
        {c?.slug ? (
          <Link
            href={`/cases/${c.slug}`}
            className="mt-2 inline-block text-sm underline underline-offset-4"
          >
            Open the case yourself
          </Link>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Card className="flex-1 min-w-40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(submitted.length)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}/ {formatNumber(rows.length)}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Waiting on you</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(pending.length)}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Not started</p>
            <p className="mt-1 text-2xl font-semibold tabular">
              {formatNumber(rows.length - submitted.length)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <ReviewQueue
          assignmentId={assignmentId}
          maxMarks={assignment.max_marks ? Number(assignment.max_marks) : null}
          rows={rows}
        />
      </div>
    </div>
  );
}
