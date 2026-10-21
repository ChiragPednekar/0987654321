import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, authzResponse, requireTeacherActor } from "@/lib/authz";
import { internalError } from "@/lib/http-errors";
import { slugify } from "@/lib/utils";
import { STORE_HIDDEN_SETUP, STORE_SCHEMA_NOTE, STORE_SETUP } from "@/lib/sql/datasets";
import { inspectSetup } from "@/lib/sql/runner";
import { EXCEL_DATASETS } from "@/lib/excel/datasets";
import type { Grid } from "@/lib/excel/runner";
import { checkExcelExercise, checkSqlExercise, parsePastedGrid } from "@/lib/teacher-exercises";

export const dynamic = "force-dynamic";

const common = {
  title: z.string().trim().min(4).max(200),
  prompt: z.string().trim().min(10).max(4_000),
  topic: z.string().trim().min(2).max(60),
  difficulty: z.enum(["easy", "medium", "hard"]),
  hint: z.string().trim().max(1_000).optional().nullable(),
  /** Run the checks and show the result, without saving. */
  check_only: z.boolean().default(false),
};

const sqlSchema = z.object({
  kind: z.literal("sql"),
  ...common,
  dataset: z.enum(["store", "custom"]),
  setup_sql: z.string().max(60_000).optional().nullable(),
  hidden_setup_sql: z.string().max(60_000).optional().nullable(),
  schema_note: z.string().trim().max(2_000).optional().nullable(),
  solution_sql: z.string().trim().min(1).max(8_000),
  order_matters: z.boolean().default(false),
});

const excelSchema = z.object({
  kind: z.literal("excel"),
  ...common,
  dataset: z.enum(["sales", "people", "stock", "pnl", "custom"]),
  /** Pasted from Excel or Sheets: tab- or comma-separated rows. */
  grid_text: z.string().max(40_000).optional().nullable(),
  hidden_grid_text: z.string().max(40_000).optional().nullable(),
  answer_label: z.string().trim().min(1).max(60).default("the answer cell"),
  solution_formula: z.string().trim().min(2).max(2_000),
  tolerance: z.number().min(0).max(1_000).default(0.000001),
});

const bodySchema = z.discriminatedUnion("kind", [sqlSchema, excelSchema]);

const MAX_GRID_ROWS = 200;
const MAX_GRID_COLS = 20;

/**
 * Lets any teacher write an SQL or Excel exercise.
 *
 * The answer is checked before it is saved, the way the seeders check the
 * platform's own (see src/lib/teacher-exercises.ts): it must run on both
 * datasets, return something on both, and come out differently on each.
 * `check_only` runs exactly those checks and returns what the answer produced,
 * so the form can show the teacher their result before they commit to it.
 *
 * Saved unpublished and owned by the teacher, like their aptitude questions:
 * out of the public library, opened by the author and by students in a batch
 * it is assigned to. The second dataset and the answer are withheld from
 * clients by the same column grants as every platform exercise.
 */
export async function POST(request: NextRequest) {
  let actor;
  try {
    actor = await requireTeacherActor();
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
        ? `${error.issues[0]?.path.join(".")}: ${error.issues[0]?.message}`
        : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = body.kind === "sql" ? "sql_exercises" : "excel_exercises";
  const base = `t-${slugify(body.title).slice(0, 40) || body.kind}`;
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await admin.from(table).select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  if (body.kind === "sql") {
    const custom = body.dataset === "custom";
    const setup = custom ? (body.setup_sql ?? "").trim() : STORE_SETUP;
    const hidden = custom ? (body.hidden_setup_sql ?? "").trim() : STORE_HIDDEN_SETUP;
    if (custom && (!setup || !hidden)) {
      return NextResponse.json(
        { error: "Paste both datasets: the one students see, and a second with the same tables and different rows." },
        { status: 400 },
      );
    }

    const check = await checkSqlExercise({
      setup,
      hidden,
      solution: body.solution_sql,
      orderMatters: body.order_matters,
      customData: custom,
    });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });
    if (body.check_only) return NextResponse.json({ ok: true, preview: check.value });

    // Students are shown the tables and columns; write them out if the
    // teacher did not.
    let schemaNote = custom ? body.schema_note?.trim() || "" : STORE_SCHEMA_NOTE;
    if (!schemaNote) {
      const shape = await inspectSetup(setup);
      schemaNote = shape.ok
        ? shape.tables.map((t) => `${t.name}(${t.columns.join(", ")})`).join("\n")
        : "";
    }

    const { data: created, error } = await admin
      .from("sql_exercises")
      .insert({
        slug,
        title: body.title,
        prompt: body.prompt,
        topic: body.topic,
        difficulty: body.difficulty,
        schema_note: schemaNote,
        setup_sql: setup,
        hidden_setup_sql: hidden,
        solution_sql: body.solution_sql,
        order_matters: body.order_matters,
        hint: body.hint || null,
        is_published: false,
        created_by: actor.id,
      })
      .select("id, slug")
      .single();
    if (error || !created) return internalError("teacher", error, "Could not save the exercise.");

    await audit(actor, "sql_exercise.create", "sql_exercises", created.id, { dataset: body.dataset });
    return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
  }

  // ---- Excel --------------------------------------------------------------------
  let grid: Grid;
  let hidden: Grid;
  if (body.dataset === "custom") {
    grid = parsePastedGrid(body.grid_text ?? "");
    hidden = parsePastedGrid(body.hidden_grid_text ?? "");
    if (grid.length < 2 || hidden.length < 2) {
      return NextResponse.json(
        { error: "Paste both sheets, each with a header row and at least one row of data." },
        { status: 400 },
      );
    }
    const tooBig = (g: Grid) =>
      g.length > MAX_GRID_ROWS || g.some((row) => row.length > MAX_GRID_COLS);
    if (tooBig(grid) || tooBig(hidden)) {
      return NextResponse.json(
        { error: `Keep each sheet to ${MAX_GRID_ROWS} rows and ${MAX_GRID_COLS} columns.` },
        { status: 400 },
      );
    }
  } else {
    const preset = EXCEL_DATASETS.find((d) => d.key === body.dataset)!;
    grid = preset.grid;
    hidden = preset.hidden;
  }

  const check = checkExcelExercise({
    grid,
    hidden,
    solution: body.solution_formula,
    tolerance: body.tolerance,
  });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });
  if (body.check_only) return NextResponse.json({ ok: true, preview: check.value });

  const { data: created, error } = await admin
    .from("excel_exercises")
    .insert({
      slug,
      title: body.title,
      prompt: body.prompt,
      topic: body.topic,
      difficulty: body.difficulty,
      grid,
      hidden_grid: hidden,
      answer_label: body.answer_label,
      solution_formula: body.solution_formula,
      tolerance: body.tolerance,
      hint: body.hint || null,
      is_published: false,
      created_by: actor.id,
    })
    .select("id, slug")
    .single();
  if (error || !created) return internalError("teacher", error, "Could not save the exercise.");

  await audit(actor, "excel_exercise.create", "excel_exercises", created.id, { dataset: body.dataset });
  return NextResponse.json({ id: created.id, slug: created.slug }, { status: 201 });
}
