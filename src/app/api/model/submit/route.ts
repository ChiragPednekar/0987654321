import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  case_id: z.string().uuid(),
  duration_seconds: z.number().int().min(0).max(86_400).default(0),
  // cell id → the number the user entered. Blank cells are absent rather than
  // sent as null, matching the drill contract.
  cells: z.record(z.string().uuid(), z.number().finite()),
});

export interface ModelResult {
  correct: number;
  total: number;
  cells: {
    id: string;
    row_index: number;
    col_index: number;
    label: string;
    correct: boolean;
    answered: number | null;
    expected: number;
    unit: string | null;
    formula: string | null;
    explanation: string | null;
  }[];
}

/**
 * Grades a Model Workspace build (spec §5).
 *
 * Arithmetic rather than AI, for the same reason drills are: a financial model
 * has one right number per cell, and a tolerance band checks that far better
 * — and far more cheaply — than a language model can. `expected`, `formula`
 * and `explanation` are withheld from the client by column grant, so they are
 * read here with the service role; otherwise the whole model would be one REST
 * call away.
 */
export async function POST(request: NextRequest) {
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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: cells } = await admin
    .from("model_cells")
    .select(
      "id, row_index, col_index, label, expected, tolerance_pct, unit, formula, explanation",
    )
    .eq("case_id", body.case_id)
    .order("row_index")
    .order("col_index");

  if (!cells || cells.length === 0) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  const graded = cells.map((cell) => {
    const answered = body.cells[cell.id];
    const expected = Number(cell.expected);

    // Relative tolerance, except around zero where a percentage band would
    // collapse to an exact-match requirement.
    const band =
      expected === 0
        ? Number(cell.tolerance_pct) / 100
        : Math.abs(expected) * (Number(cell.tolerance_pct) / 100);

    const correct =
      typeof answered === "number" && Math.abs(answered - expected) <= band;

    return {
      id: cell.id,
      row_index: cell.row_index,
      col_index: cell.col_index,
      label: cell.label,
      correct,
      answered: typeof answered === "number" ? answered : null,
      expected,
      unit: cell.unit,
      formula: cell.formula,
      explanation: cell.explanation,
    };
  });

  const correct = graded.filter((c) => c.correct).length;

  await admin.from("model_attempts").insert({
    user_id: user.id,
    case_id: body.case_id,
    cells: body.cells,
    correct,
    total: graded.length,
    duration_seconds: body.duration_seconds,
  });

  return NextResponse.json<ModelResult>({
    correct,
    total: graded.length,
    cells: graded,
  });
}
