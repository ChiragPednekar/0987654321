import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  student_id: z.string().uuid(),
  marks: z.number().min(0).optional().nullable(),
  remarks: z.string().trim().max(4_000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Records a faculty mark and remark on one student's assignment.
 *
 * Teachers only, checked against classroom_members rather than inferred from
 * anything the client sends — the service role bypasses RLS, so without an
 * explicit check any signed-in user could mark any class.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: assignmentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    .select("id, classroom_id, max_marks, cases(slug, title)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { data: membership } = await admin
    .from("classroom_members")
    .select("role")
    .eq("classroom_id", assignment.classroom_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "teacher") {
    return NextResponse.json(
      { error: "Only teachers can mark assignments." },
      { status: 403 },
    );
  }

  // A mark above the stated maximum is almost always a slip, and a student
  // seeing 30/20 has no way to know which number is wrong.
  if (
    body.marks !== null &&
    body.marks !== undefined &&
    assignment.max_marks !== null &&
    body.marks > Number(assignment.max_marks)
  ) {
    return NextResponse.json(
      { error: `Marks cannot exceed ${assignment.max_marks}.` },
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
    // Marking someone who has not handed in yet is a mistake worth naming
    // rather than silently creating a row for.
    return NextResponse.json(
      { error: "That student has not submitted this assignment yet." },
      { status: 404 },
    );
  }

  const { error } = await admin
    .from("assignment_submissions")
    .update({
      status: "reviewed",
      faculty_marks: body.marks ?? null,
      faculty_remarks: body.remarks ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Feedback nobody sees is feedback that did not happen.
  const caseRow = Array.isArray(assignment.cases)
    ? assignment.cases[0]
    : assignment.cases;

  await admin.from("notifications").insert({
    user_id: body.student_id,
    type: "system",
    title:
      body.marks !== null && body.marks !== undefined
        ? `Marked — ${body.marks}${assignment.max_marks ? `/${assignment.max_marks}` : ""}`
        : "Your submission was reviewed",
    body: caseRow?.title ? `Feedback on ${caseRow.title}.` : null,
    href: `/classrooms`,
  });

  return NextResponse.json({ ok: true });
}
