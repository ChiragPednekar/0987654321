import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthzError, audit, requireTeacherActor } from "@/lib/authz";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ lockout_id: z.string().uuid() });

/**
 * Lets a student back into a test the camera ended.
 *
 * The detection is a model reading a webcam frame, and it will sometimes be
 * wrong — a dark mug read as a phone, a face in a poster read as a second
 * person. This is how that is put right, so the people who can see the photo
 * are the people who can undo the ending: the admin for anyone, and a teacher
 * for a student in one of the batches they teach. Nobody else, and never the
 * student.
 *
 * The row is updated, never deleted, so who was stopped and who let them back
 * in both stay on the record.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: lockout } = await admin
    .from("exam_lockouts")
    .select("id, user_id, reopened_at")
    .eq("id", body.lockout_id)
    .maybeSingle();

  // 404 for "not yours" as well as "not there", as the batch routes do.
  if (!lockout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (actor.role !== "admin" && !(await teaches(admin, actor.id, lockout.user_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lockout.reopened_at) return NextResponse.json({ ok: true });

  const { error } = await admin
    .from("exam_lockouts")
    .update({ reopened_at: new Date().toISOString(), reopened_by: actor.id })
    .eq("id", lockout.id)
    .is("reopened_at", null);

  if (error) {
    console.error("[proctor] reopen failed", error.message);
    return NextResponse.json({ error: "Could not reopen" }, { status: 500 });
  }

  await audit(actor, "lockout.reopen", "exam_lockouts", lockout.id, {
    student: lockout.user_id,
  });
  return NextResponse.json({ ok: true });
}

/** The teacher teaches a batch the student is a student in. */
async function teaches(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const { data: taught } = await admin
    .from("classroom_members")
    .select("classroom_id")
    .eq("user_id", teacherId)
    .eq("role", "teacher");
  const ids = (taught ?? []).map((r) => r.classroom_id);
  if (ids.length === 0) return false;

  const { count } = await admin
    .from("classroom_members")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", studentId)
    .eq("role", "student")
    .in("classroom_id", ids);
  return (count ?? 0) > 0;
}
