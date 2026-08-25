import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireAssignmentTeacher } from "@/lib/authz";

const bodySchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  instructions: z.string().trim().max(4_000).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  max_marks: z.number().positive().max(1_000).nullable().optional(),
  allow_resubmission: z.boolean().optional(),
  max_attempts: z.number().int().min(1).max(20).nullable().optional(),
  is_published: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

/** Updates an assignment. Scoped to the batch its owner teaches. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let actor;
  try {
    ({ actor } = await requireAssignmentTeacher(id));
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

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("classroom_assignments")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "assignment.update", "classroom_assignments", id, body);
  return NextResponse.json({ ok: true });
}

/** Deletes an assignment. Submissions cascade; the student's work survives. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  let actor;
  try {
    ({ actor } = await requireAssignmentTeacher(id));
  } catch (error) {
    const { body, status } = authzResponse(error);
    return NextResponse.json(body, { status });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("classroom_assignments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit(actor, "assignment.delete", "classroom_assignments", id, {});
  return NextResponse.json({ ok: true });
}
