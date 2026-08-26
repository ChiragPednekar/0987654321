import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireBatchTeacher } from "@/lib/authz";

const bodySchema = z.object({
  user_id: z.string().uuid(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Removes a student from a batch (spec §7).
 *
 * What this does and does not touch is the whole design:
 *
 *   * The membership row goes. The student stops seeing the batch, stops
 *     receiving its assignments, and drops out of the roster and every rollup.
 *   * Their submissions, scores and CE stay. Those are the student's own work
 *     and belong to their account, not to the batch — a teacher tidying a
 *     roster must not be able to delete someone's academic record.
 *   * Their assignment_submissions rows stay too, so a mark already given
 *     remains attached if they are re-enrolled later.
 *
 * A teacher cannot remove themselves or another teacher here; that would leave
 * a batch nobody can administer.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: classroomId } = await params;

  // Proves the caller teaches THIS batch — the check that stops a teacher
  // editing another teacher's roster by changing the URL.
  let actor;
  try {
    actor = await requireBatchTeacher(classroomId);
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? "Invalid request")
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", classroomId)
    .eq("user_id", body.user_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "That student is not in this batch." },
      { status: 404 },
    );
  }

  if (membership.role !== "student") {
    return NextResponse.json(
      { error: "Only students can be removed from a batch." },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("classroom_members")
    .delete()
    .eq("classroom_id", classroomId)
    .eq("user_id", body.user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Removal is not a punishment and should not read as a silent one — the
  // student finds out from their own notifications rather than by noticing a
  // batch has vanished.
  await admin.from("notifications").insert({
    user_id: body.user_id,
    type: "system",
    title: "Removed from a batch",
    body: "You are no longer enrolled in one of your batches. Your solved cases and scores are unchanged.",
    href: "/classrooms",
  });

  await audit(actor, "classroom.remove_student", "classroom_members", classroomId, {
    student_id: body.user_id,
  });

  return NextResponse.json({ ok: true });
}
