import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireBatchTeacher } from "@/lib/authz";
import { assignmentNoticeRecipients } from "@/lib/notify";
import { internalError } from "@/lib/http-errors";
import type { AssignmentKind } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  kind: z.enum(["case", "path", "sql", "excel", "aptitude"]),
  id: z.string().uuid(),
});

const bodySchema = z
  .object({
    classroom_id: z.string().uuid(),
    items: z.array(itemSchema).min(1).max(100),
    /** Title for the quiz made from the aptitude questions, when there are any. */
    quiz_title: z.string().trim().min(3).max(200).optional().nullable(),
    instructions: z.string().trim().max(4_000).optional().nullable(),
    starts_at: z.string().datetime().optional().nullable(),
    due_at: z.string().datetime().optional().nullable(),
    max_marks: z.number().positive().max(1_000).optional().nullable(),
    is_published: z.boolean().default(true),
  })
  .refine(
    (b) => !b.starts_at || !b.due_at || new Date(b.due_at) > new Date(b.starts_at),
    { message: "The due date must be after the start date.", path: ["due_at"] },
  );

interface NewAssignment {
  kind: AssignmentKind;
  title: string;
  case_id?: string;
  sql_exercise_id?: string;
  excel_exercise_id?: string;
  question_ids?: string[];
}

/** Aptitude questions in one quiz — the most a sitting shows at once. */
const MAX_QUIZ_QUESTIONS = 50;

/**
 * Adds what a teacher picked in the library to one of their batches.
 *
 * The picker on the library pages collects items of any kind — cases, whole
 * learning paths, SQL and Excel exercises, individual aptitude questions — and
 * sends them here in one go:
 *
 *   * each case becomes a case assignment;
 *   * a learning path becomes one case assignment per step, in order, so its
 *     cases are graded and marked like any other;
 *   * each SQL or Excel exercise becomes its own assignment;
 *   * all the aptitude questions together become ONE quiz.
 *
 * Every id came from the client, so each is checked: platform items must be
 * published; a private question must be the teacher's own or already belong
 * to this batch. Anything that cannot be assigned is skipped and reported,
 * rather than failing the whole batch for one bad pick. Items the batch
 * already has are skipped too, so a double click does not double-assign.
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
  const skipped: { title: string; reason: string }[] = [];
  const ids = (kind: string) => body.items.filter((i) => i.kind === kind).map((i) => i.id);

  // ---- cases, including every step of any picked path ----------------------
  const pathIds = ids("path");
  const { data: steps } = pathIds.length
    ? await admin
        .from("learning_path_steps")
        .select("path_id, case_id, step_order")
        .in("path_id", pathIds)
        .order("step_order")
    : { data: [] as { path_id: string; case_id: string; step_order: number }[] };

  // Order: individually picked cases first, then each path's steps in order.
  const caseOrder: string[] = [];
  for (const id of [...ids("case"), ...pathIds.flatMap((p) => (steps ?? []).filter((s) => s.path_id === p).map((s) => s.case_id))]) {
    if (!caseOrder.includes(id)) caseOrder.push(id);
  }

  const [{ data: caseRows }, { data: rubrics }] = caseOrder.length
    ? await Promise.all([
        admin
          .from("cases")
          .select("id, title, visibility, owner_classroom_id, created_by, is_published")
          .in("id", caseOrder),
        admin.from("rubrics").select("case_id").in("case_id", caseOrder),
      ])
    : [{ data: [] }, { data: [] }];
  const caseById = new Map((caseRows ?? []).map((c) => [c.id, c]));
  const hasRubric = new Set((rubrics ?? []).map((r) => r.case_id));

  // ---- what this batch already has ------------------------------------------
  const { data: existing } = await admin
    .from("classroom_assignments")
    .select("case_id, sql_exercise_id, excel_exercise_id")
    .eq("classroom_id", body.classroom_id);
  const assignedCases = new Set((existing ?? []).map((e) => e.case_id).filter(Boolean));
  const assignedSql = new Set((existing ?? []).map((e) => e.sql_exercise_id).filter(Boolean));
  const assignedExcel = new Set((existing ?? []).map((e) => e.excel_exercise_id).filter(Boolean));

  const rows: NewAssignment[] = [];

  for (const id of caseOrder) {
    const c = caseById.get(id);
    if (!c) {
      skipped.push({ title: "A case", reason: "no longer exists" });
      continue;
    }
    const usable =
      (c.visibility === "platform" && c.is_published) ||
      c.created_by === actor.id ||
      c.owner_classroom_id === body.classroom_id;
    if (!usable) {
      skipped.push({ title: c.title, reason: "is another teacher's private question" });
    } else if (!c.is_published) {
      skipped.push({ title: c.title, reason: "is still a draft — publish it in your question bank first" });
    } else if (!hasRubric.has(id)) {
      skipped.push({ title: c.title, reason: "has no rubric, so it cannot be graded" });
    } else if (assignedCases.has(id)) {
      skipped.push({ title: c.title, reason: "is already assigned to this batch" });
    } else {
      rows.push({ kind: "case", case_id: id, title: c.title });
    }
  }

  // ---- SQL and Excel exercises -----------------------------------------------
  for (const kind of ["sql", "excel"] as const) {
    const wanted = ids(kind);
    if (wanted.length === 0) continue;
    const table = kind === "sql" ? "sql_exercises" : "excel_exercises";
    const { data: exercises } = await admin
      .from(table)
      .select("id, title, is_published, created_by")
      .in("id", wanted);
    const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
    const already = kind === "sql" ? assignedSql : assignedExcel;
    for (const id of wanted) {
      const e = byId.get(id);
      // Platform exercises are published; a teacher's own is not, and only
      // its author may assign it.
      if (!e || !(e.is_published || e.created_by === actor.id)) {
        skipped.push({ title: e?.title ?? `An ${kind.toUpperCase()} exercise`, reason: "is not available" });
      } else if (already.has(id)) {
        skipped.push({ title: e.title, reason: "is already assigned to this batch" });
      } else {
        rows.push(
          kind === "sql"
            ? { kind, sql_exercise_id: id, title: e.title }
            : { kind, excel_exercise_id: id, title: e.title },
        );
      }
    }
  }

  // ---- aptitude questions → one quiz -------------------------------------------
  const questionIds = ids("aptitude");
  if (questionIds.length > 0) {
    const { data: questions } = await admin
      .from("objective_questions")
      .select("id, is_published, created_by")
      .in("id", questionIds);
    const usable = new Set(
      (questions ?? [])
        .filter((q) => q.is_published || q.created_by === actor.id)
        .map((q) => q.id),
    );
    // Keep the order the teacher picked them in; that is the order of the paper.
    const picked = questionIds.filter((id) => usable.has(id));
    if (picked.length < questionIds.length) {
      skipped.push({
        title: `${questionIds.length - picked.length} aptitude question(s)`,
        reason: "are not available",
      });
    }
    if (picked.length > MAX_QUIZ_QUESTIONS) {
      return NextResponse.json(
        { error: `A quiz can hold up to ${MAX_QUIZ_QUESTIONS} questions; ${picked.length} were picked.` },
        { status: 400 },
      );
    }
    if (picked.length > 0) {
      rows.push({
        kind: "aptitude",
        question_ids: picked,
        title: body.quiz_title || `Aptitude quiz — ${picked.length} question${picked.length === 1 ? "" : "s"}`,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Nothing could be added.", created: 0, skipped },
      { status: 400 },
    );
  }

  const { data: created, error } = await admin
    .from("classroom_assignments")
    .insert(
      rows.map((r) => ({
        classroom_id: body.classroom_id,
        kind: r.kind,
        case_id: r.case_id ?? null,
        sql_exercise_id: r.sql_exercise_id ?? null,
        excel_exercise_id: r.excel_exercise_id ?? null,
        question_ids: r.question_ids ?? null,
        title: r.title,
        instructions: body.instructions ?? null,
        starts_at: body.starts_at ?? null,
        due_at: body.due_at ?? null,
        max_marks: body.max_marks ?? null,
        allow_resubmission: true,
        is_published: body.is_published,
        created_by: actor.id,
      })),
    )
    .select("id");

  if (error || !created) {
    return internalError("teacher", error, "Could not add to the batch.");
  }

  // One notification for the lot, not one per item.
  if (body.is_published) {
    const { data: students } = await admin
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", body.classroom_id)
      .eq("role", "student");
    const recipients = await assignmentNoticeRecipients(
      admin,
      (students ?? []).map((s) => s.user_id),
    );
    if (recipients.length > 0) {
      await admin.from("notifications").insert(
        recipients.map((userId) => ({
          user_id: userId,
          type: "system" as const,
          title: created.length === 1 ? "New assignment" : `${created.length} new assignments`,
          body: created.length === 1 ? rows[0].title : rows.map((r) => r.title).slice(0, 3).join(" · "),
          href: `/classrooms/${body.classroom_id}`,
        })),
      );
    }
  }

  await audit(actor, "assignment.bulk_create", "classroom_assignments", null, {
    classroom_id: body.classroom_id,
    created: created.length,
    kinds: rows.map((r) => r.kind),
    published: body.is_published,
  });

  return NextResponse.json({ created: created.length, skipped }, { status: 201 });
}
