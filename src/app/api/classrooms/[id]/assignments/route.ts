import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireBatchTeacher } from "@/lib/authz";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  due_at: z.string().datetime().optional().nullable(),
  note: z.string().trim().max(500).optional(),
  // Null means practice only — the assignment carries no marks.
  max_marks: z.number().positive().max(1000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Assign a case to a classroom from the batch page (spec §11).
 *
 * The quick path, kept alongside POST /api/teacher/assignments — that one is
 * the full form with dates, marks and attempt limits; this is "set this case
 * for this batch" from inside the classroom.
 *
 * Two things were wrong here and are fixed:
 *
 *   * It upserted on `onConflict: "classroom_id,case_id"`, but
 *     20250101000024 dropped that unique constraint deliberately — setting the
 *     same case twice in a term is normal. PostgREST answered 42P10, so this
 *     route had been failing outright. It now inserts, after checking for an
 *     existing open assignment itself.
 *   * It checked classroom membership but not the platform teacher role, so
 *     anyone who had made themselves a classroom's teacher could set work in
 *     it. requireBatchTeacher checks both layers.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let actor;
  try {
    actor = await requireBatchTeacher(id);
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

  // The case id came from the client. A teacher may set a platform case, or one
  // of their own — but not another teacher's private question.
  const { data: caseRow } = await admin
    .from("cases")
    .select("id, title, visibility, owner_classroom_id, created_by, is_published")
    .eq("id", body.case_id)
    .maybeSingle();

  if (!caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const usable =
    (caseRow.visibility === "platform" && caseRow.is_published) ||
    caseRow.created_by === actor.id ||
    caseRow.owner_classroom_id === id;

  if (!usable) {
    return NextResponse.json(
      { error: "That question is not available to this batch." },
      { status: 403 },
    );
  }

  // A case with no rubric cannot be graded, and finding that out when the first
  // student submits is far worse than finding out now.
  const { data: rubric } = await admin
    .from("rubrics")
    .select("case_id")
    .eq("case_id", body.case_id)
    .maybeSingle();

  if (!rubric) {
    return NextResponse.json(
      { error: "That question has no rubric yet, so it cannot be graded." },
      { status: 400 },
    );
  }

  // Setting the same case twice in a term is legitimate, so this is not an
  // error — but doing it by accident from a form with no visible history is
  // easy, so an already-open assignment for the same case is refused rather
  // than silently duplicated.
  const { data: existing } = await admin
    .from("classroom_assignments")
    .select("id")
    .eq("classroom_id", id)
    .eq("case_id", body.case_id)
    .eq("is_published", true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error:
          "That case is already set for this batch. Edit the existing assignment, or set a due date on it instead.",
        assignment_id: existing.id,
      },
      { status: 409 },
    );
  }

  const { data: created, error } = await admin
    .from("classroom_assignments")
    .insert({
      classroom_id: id,
      case_id: body.case_id,
      title: caseRow.title,
      due_at: body.due_at ?? null,
      note: body.note ?? null,
      max_marks: body.max_marks ?? null,
      is_published: true,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "Could not set the assignment." },
      { status: 500 },
    );
  }

  // Students hear about it, the same as they do from the full assignment form.
  const { data: students } = await admin
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", id)
    .eq("role", "student");

  if (students && students.length > 0) {
    await admin.from("notifications").insert(
      students.map((s) => ({
        user_id: s.user_id,
        type: "system" as const,
        title: "New assignment",
        body: caseRow.title,
        href: `/classrooms/${id}`,
      })),
    );
  }

  await audit(actor, "assignment.create", "classroom_assignments", created.id, {
    case_id: body.case_id,
    via: "classroom",
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
