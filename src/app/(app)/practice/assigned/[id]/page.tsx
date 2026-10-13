import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ObjectiveRunner } from "@/components/practice/objective-runner";
import { OBJECTIVE_TRACKS } from "@/lib/objective";

export const metadata: Metadata = { title: "Quiz" };

/**
 * A quiz a teacher set for their batch, from questions they picked in the
 * aptitude library. The student sits it here, under the same exam conditions
 * as any aptitude set; submitting it hands the score in to the teacher.
 */
export default async function AssignedQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/practice/assigned/${id}`);

  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("classroom_assignments")
    .select("id, classroom_id, title, kind, question_ids, is_published, instructions, due_at")
    .eq("id", id)
    .maybeSingle();

  const { data: membership } = assignment
    ? await admin
        .from("classroom_members")
        .select("role")
        .eq("classroom_id", assignment.classroom_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (
    !assignment ||
    assignment.kind !== "aptitude" ||
    !membership ||
    (!assignment.is_published && membership.role !== "teacher")
  ) {
    notFound();
  }

  // The runner wants a track for its labels; a mixed quiz is shown under the
  // track of its first question.
  const { data: first } = await admin
    .from("objective_questions")
    .select("track")
    .eq("id", assignment.question_ids?.[0] ?? "")
    .maybeSingle();
  const track = OBJECTIVE_TRACKS.find((t) => t.value === first?.track) ?? OBJECTIVE_TRACKS[0];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href={`/classrooms/${assignment.classroom_id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Your batch
      </Link>
      {assignment.instructions ? (
        <p className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">{assignment.instructions}</p>
      ) : null}
      {assignment.due_at ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Due {new Date(assignment.due_at).toLocaleString()}
        </p>
      ) : null}
      <div className="mt-4">
        <ObjectiveRunner
          track={track}
          assignment={{
            id: assignment.id,
            title: assignment.title ?? "Quiz",
            count: assignment.question_ids?.length ?? 0,
            classroomId: assignment.classroom_id,
          }}
        />
      </div>
    </div>
  );
}
