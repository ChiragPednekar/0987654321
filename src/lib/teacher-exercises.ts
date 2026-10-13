import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { compareResults, inspectSetup, runQuery, type ResultSet } from "@/lib/sql/runner";
import { compareValues, evaluateFormula, guardFormula, type CellValue, type Grid } from "@/lib/excel/runner";

/**
 * Teacher-written SQL and Excel exercises: checking them before they are
 * saved, and deciding who may open one.
 *
 * The platform's own exercises are checked by their seeders (scripts/seed-sql.ts,
 * scripts/seed-excel.ts), which refuse a reference answer that fails, comes
 * back empty, or comes back the same on both datasets. A teacher gets the same
 * checks at save time, because the same three mistakes break a student's
 * attempt in the same three ways:
 *
 *   * an answer that fails marks every student wrong;
 *   * an empty answer cannot tell a right query from one that does nothing;
 *   * an answer that is the same on both datasets can be typed in by hand —
 *     the second dataset is the whole anti-cheating design.
 */

type Admin = SupabaseClient<Database>;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

export interface SqlCheck {
  visible: ResultSet;
  hiddenRows: number;
}

export async function checkSqlExercise(input: {
  setup: string;
  hidden: string;
  solution: string;
  orderMatters: boolean;
  /** The platform dataset is already known to be good; a teacher's is not. */
  customData: boolean;
}): Promise<Check<SqlCheck>> {
  if (input.customData) {
    const [seen, unseen] = await Promise.all([inspectSetup(input.setup), inspectSetup(input.hidden)]);
    if (!seen.ok) return { ok: false, error: `Your visible data: ${seen.error}` };
    if (!unseen.ok) return { ok: false, error: `Your second dataset: ${unseen.error}` };
    const shape = (tables: { name: string; columns: string[] }[]) =>
      tables.map((t) => `${t.name}(${t.columns.join(",")})`).join(" ");
    if (shape(seen.tables) !== shape(unseen.tables)) {
      return {
        ok: false,
        error: "The second dataset must have the same tables and columns as the visible one — only the rows should differ.",
      };
    }
  }

  const [onVisible, onHidden] = await Promise.all([
    runQuery(input.setup, input.solution),
    runQuery(input.hidden, input.solution),
  ]);
  if (!onVisible.ok || !onVisible.result) {
    return { ok: false, error: `Your answer query fails on the visible data: ${onVisible.error}` };
  }
  if (!onHidden.ok || !onHidden.result) {
    return { ok: false, error: `Your answer query fails on the second dataset: ${onHidden.error}` };
  }
  if (onVisible.truncated || onHidden.truncated) {
    return { ok: false, error: "Your answer returns too many rows. Ask for a summary rather than a listing." };
  }
  if (onVisible.result.rows.length === 0 || onHidden.result.rows.length === 0) {
    return {
      ok: false,
      error: `Your answer returns no rows on the ${onVisible.result.rows.length === 0 ? "visible data" : "second dataset"}, so a student's empty query would pass. Change the question or the data so it returns something on both.`,
    };
  }
  if (compareResults(onVisible.result, onHidden.result, input.orderMatters).correct) {
    return {
      ok: false,
      error: "Your answer gives the same result on both datasets, so a student could type the answer in without writing a query. Ask for something that differs between them.",
    };
  }
  return { ok: true, value: { visible: onVisible.result, hiddenRows: onHidden.result.rows.length } };
}

export interface ExcelCheck {
  visible: CellValue;
}

export function checkExcelExercise(input: {
  grid: Grid;
  hidden: Grid;
  solution: string;
  tolerance: number;
}): Check<ExcelCheck> {
  const header = (g: Grid) => JSON.stringify(g[0] ?? []);
  if (header(input.grid) !== header(input.hidden)) {
    return { ok: false, error: "The second sheet must have the same header row as the visible one." };
  }

  const guard = guardFormula(input.solution);
  if (!guard.ok || !guard.formula) {
    return { ok: false, error: `Your answer formula: ${guard.reason ?? "not allowed."}` };
  }
  const onVisible = evaluateFormula(input.grid, guard.formula);
  if (!onVisible.ok) return { ok: false, error: `Your answer formula fails on the visible sheet: ${onVisible.error}` };
  const onHidden = evaluateFormula(input.hidden, guard.formula);
  if (!onHidden.ok) return { ok: false, error: `Your answer formula fails on the second sheet: ${onHidden.error}` };

  const blank = (v: CellValue | undefined) => v === null || v === undefined || v === "";
  if (blank(onVisible.value) || blank(onHidden.value)) {
    return { ok: false, error: "Your answer formula comes out blank, so there is nothing to mark against." };
  }
  if (compareValues(onVisible.value ?? null, onHidden.value ?? null, input.tolerance).match) {
    return {
      ok: false,
      error: "Your answer is the same on both sheets, so a student could type the number in. Ask for something that differs between them.",
    };
  }
  return { ok: true, value: { visible: onVisible.value ?? null } };
}

/**
 * Turns text pasted from Excel or Google Sheets into a grid.
 *
 * Copying cells gives tab-separated lines; a CSV export gives commas. Numbers
 * formatted with thousands separators ("1,200") come back as numbers, TRUE and
 * FALSE as booleans, empty cells as blanks. Trailing empty rows are dropped.
 */
export function parsePastedGrid(text: string): Grid {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  return lines.map((line) =>
    line.split(sep).map((raw): CellValue => {
      const cell = raw.trim();
      if (cell === "") return null;
      if (/^(true|false)$/i.test(cell)) return cell.toLowerCase() === "true";
      if (/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(cell)) return Number(cell.replace(/,/g, ""));
      return cell;
    }),
  );
}

/**
 * May this account open this exercise?
 *
 * Platform exercises (published) are open to anyone signed in, as before. A
 * teacher's own is open to its author, to anyone in a batch it has been
 * assigned to, and to everyone once an assignment of it is shared publicly —
 * the assignment is the grant, as it is for a teacher's case.
 */
export async function canOpenExercise(
  admin: Admin,
  kind: "sql" | "excel",
  exercise: { id: string; is_published: boolean; created_by: string | null },
  userId: string,
): Promise<boolean> {
  if (exercise.is_published) return true;
  if (exercise.created_by === userId) return true;

  const { data: memberships } = await admin
    .from("classroom_members")
    .select("classroom_id")
    .eq("user_id", userId);
  const batches = (memberships ?? []).map((m) => m.classroom_id);

  // A teacher may share an assignment publicly (is_public), which opens a
  // case to everyone through the cases policy; the same goes for an exercise.
  const { count } = await admin
    .from("classroom_assignments")
    .select("id", { count: "exact", head: true })
    .eq(kind === "sql" ? "sql_exercise_id" : "excel_exercise_id", exercise.id)
    .eq("is_published", true)
    .or(batches.length ? `is_public.eq.true,classroom_id.in.(${batches.join(",")})` : "is_public.eq.true");
  return (count ?? 0) > 0;
}
