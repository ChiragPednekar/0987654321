import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAssignmentTeacher } from "@/lib/authz";

const bodySchema = z.object({
  student_id: z.string().uuid(),
  marks: z.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(4_000).optional().nullable(),
  /** Send it back for another attempt instead of closing the review. */
  request_resubmission: z.boolean().default(false),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Records a teacher's verdict on one student's assignment (spec §15, §16).
 *
 * The teacher's mark is authoritative for the course; the AI score sits beside
 * it as advice. Two outcomes are possible — returned with a mark, or sent back
 * for a redo — and both notify the student, because feedback nobody sees is
 * feedback that did not happen.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: assignmentId } = await params;

  // Proves the caller teaches the batch this assignment belongs to. Resolved
  // from the assignment rather than trusted from the client, which is what
  // stops a teacher marking another teacher's class by changing the URL.
  let actor;
  try {
    ({ actor } = await requireAssignmentTeacher(assignmentId));
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

  const { data: assignment } = await admin
    .from("classroom_assignments")
    .select("id, classroom_id, title, max_marks, allow_resubmission, cases(title)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // A mark above the stated maximum is almost always a slip, and a student
  // seeing 30/20 has no way to know which number is wrong.
  if (
    body.marks != null &&
    assignment.max_marks != null &&
    body.marks > Number(assignment.max_marks)
  ) {
    return NextResponse.json(
      { error: `Marks cannot exceed ${assignment.max_marks}.` },
      { status: 400 },
    );
  }

  if (body.request_resubmission && !assignment.allow_resubmission) {
    return NextResponse.json(
      { error: "This assignment does not allow resubmission." },
      { status: 400 },
    );
  }

  const { data: existing } = await admin
    .from("assignment_submissions")
    .select("id")
    .eq("assignment_id", assignmentId)
    .eq("user_id", body.student_id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "That student has not submitted this assignment yet." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("assignment_submissions")
    .update({
      status: body.request_resubmission ? "resubmission_requested" : "reviewed",
      // A resubmission request carries feedback but no final mark — the work is
      // not finished, so a number would be misleading.
      faculty_marks: body.request_resubmission ? null : (body.marks ?? null),
      faculty_remarks: body.remarks ?? null,
      reviewed_by: actor.id,
      reviewed_at: now,
      returned_at: body.request_resubmission ? null : now,
    })
    .eq("id", existing.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const caseRow = Array.isArray(assignment.cases)
    ? assignment.cases[0]
    : assignment.cases;
  const label = assignment.title ?? caseRow?.title ?? "your assignment";

  await admin.from("notifications").insert({
    user_id: body.student_id,
    type: "system",
    title: body.request_resubmission
      ? "Resubmission requested"
      : body.marks != null
        ? `Marked — ${body.marks}${assignment.max_marks ? `/${assignment.max_marks}` : ""}`
        : "Your submission was reviewed",
    body: body.request_resubmission
      ? `Your teacher has asked you to have another go at ${label}.`
      : `Feedback on ${label}.`,
    href: `/classrooms/${assignment.classroom_id}`,
  });

  await audit(
    actor,
    body.request_resubmission ? "submission.request_resubmission" : "submission.review",
    "assignment_submissions",
    existing.id,
    { student_id: body.student_id, marks: body.marks ?? null },
  );

  return NextResponse.json({
    ok: true,
    status: body.request_resubmission ? "resubmission_requested" : "reviewed",
  });
}
