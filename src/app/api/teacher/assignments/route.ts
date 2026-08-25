import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireBatchTeacher } from "@/lib/authz";

const bodySchema = z
  .object({
    classroom_id: z.string().uuid(),
    case_id: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    instructions: z.string().trim().max(4_000).optional().nullable(),
    starts_at: z.string().datetime().optional().nullable(),
    due_at: z.string().datetime().optional().nullable(),
    max_marks: z.number().positive().max(1_000).optional().nullable(),
    allow_resubmission: z.boolean().default(true),
    max_attempts: z.number().int().min(1).max(20).optional().nullable(),
    is_published: z.boolean().default(true),
  })
  .refine(
    (b) => !b.starts_at || !b.due_at || new Date(b.due_at) > new Date(b.starts_at),
    { message: "The due date must be after the start date.", path: ["due_at"] },
  );

/**
 * Creates an assignment (spec §10).
 *
 * Publishing is explicit. A draft is invisible to students and the attachment
 * trigger ignores it, so a half-written assignment cannot collect submissions.
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? `${error.issues[0]?.path.join(".")}: ${error.issues[0]?.message}`
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let actor;
  try {
    actor = await requireBatchTeacher(body.classroom_id);
  } catch (error) {
    const { body: b, status } = authzResponse(error);
    return NextResponse.json(b, { status });
  }

  const admin = createAdminClient();

  // The case id came from the client. A teacher may assign a platform case, or
  // one of their own — but not another teacher's private question.
  const { data: caseRow } = await admin
    .from("cases")
    .select("id, visibility, owner_classroom_id, created_by, is_published")
    .eq("id", body.case_id)
    .maybeSingle();

  if (!caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const usable =
    (caseRow.visibility === "platform" && caseRow.is_published) ||
    caseRow.created_by === actor.id ||
    caseRow.owner_classroom_id === body.classroom_id;

  if (!usable) {
    return NextResponse.json(
      { error: "That question is not available to this batch." },
      { status: 403 },
    );
  }

  // A rubric is what grading clamps against; without one the case cannot be
  // scored, and finding that out at submission time is far worse.
  const { data: rubric } = await admin
    .from("rubrics").select("case_id").eq("case_id", body.case_id).maybeSingle();

  if (!rubric) {
    return NextResponse.json(
      { error: "That question has no rubric yet, so it cannot be graded." },
      { status: 400 },
    );
  }

  const { data: created, error } = await admin
    .from("classroom_assignments")
    .insert({
      classroom_id: body.classroom_id,
      case_id: body.case_id,
      title: body.title,
      instructions: body.instructions ?? null,
      starts_at: body.starts_at ?? null,
      due_at: body.due_at ?? null,
      max_marks: body.max_marks ?? null,
      allow_resubmission: body.allow_resubmission,
      max_attempts: body.max_attempts ?? null,
      is_published: body.is_published,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create the assignment." },
      { status: 500 },
    );
  }

  // Students only hear about it once it is actually published.
  if (body.is_published) {
    const { data: students } = await admin
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", body.classroom_id)
      .eq("role", "student");

    if (students && students.length > 0) {
      await admin.from("notifications").insert(
        students.map((s) => ({
          user_id: s.user_id,
          type: "system" as const,
          title: "New assignment",
          body: body.title,
          href: `/classrooms/${body.classroom_id}`,
        })),
      );
    }
  }

  await audit(actor, "assignment.create", "classroom_assignments", created.id, {
    title: body.title, published: body.is_published,
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
