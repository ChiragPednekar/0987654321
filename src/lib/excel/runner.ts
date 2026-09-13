/**
 * Excel exercise evaluation.
 *
 * Deliberately not `server-only`: scripts/seed-excel.ts runs every reference
 * formula through this same code before a row reaches the database, which is
 * the only reason the answer keys can be trusted. Nothing here touches the
 * network or the filesystem, so there is no secret to leak into a bundle.
 *
 * The design mirrors src/lib/sql/runner.ts, for the same reason: comparing a
 * student's ANSWER against the reference answer on one dataset cannot tell a
 * formula apart from a typed-in constant. Every exercise therefore carries a
 * second grid with the same shape and different numbers, and a submission is
 * only correct if it matches on both.
 */
import {
  ALLOWED,
  FormulaError,
  FormulaParser,
  buildFunctions,
  substituteFor,
} from "./functions";

export type CellValue = string | number | boolean | null;
export type Grid = CellValue[][];

const SHEET = "Sheet1";
const MAX_FORMULA_CHARS = 300;

/** Default numeric tolerance: enough for float drift, tight enough to catch a rounding mistake. */
const DEFAULT_TOLERANCE = 1e-6;

/** A1:B9, A:A or 2:9 — with or without $ anchors. */
const RANGE = String.raw`\$?[A-Z]{1,3}\$?\d+\s*:\s*\$?[A-Z]{1,3}\$?\d+|\$?[A-Z]{1,3}\s*:\s*\$?[A-Z]{1,3}|\$?\d+\s*:\s*\$?\d+`;
const OPERATOR = String.raw`[-+*/^&<>=]`;
const RANGE_OPERAND = new RegExp(
  String.raw`(?:${OPERATOR})\s*(?:${RANGE})|(?:${RANGE})\s*(?:${OPERATOR})`,
  "i",
);
/** A range in grouping brackets — not a function call's — so (C2:C6)*(D2:D6) is seen for what it is. */
const GROUPED_RANGE = new RegExp(String.raw`(?<![A-Za-z0-9_.])\(\s*(${RANGE})\s*\)`, "gi");
const STRING_LITERAL = /"(?:[^"]|"")*"/g;

/**
 * The criteria functions whose formulajs implementations ignore wildcards and
 * silently return 0 for COUNTIF(B2:B6,"A*"). MATCH and VLOOKUP honour them, and
 * the conformance test pins that, so they are deliberately not listed.
 */
const WILDCARD_BLIND = new Set([
  "COUNTIF",
  "COUNTIFS",
  "SUMIF",
  "SUMIFS",
  "AVERAGEIF",
  "AVERAGEIFS",
  "MAXIFS",
  "MINIFS",
]);

export interface Guard {
  ok: boolean;
  /** Why it was refused, phrased for the student. */
  reason?: string;
  /** The formula with a leading "=" removed, ready for the parser. */
  formula?: string;
}

/**
 * Refuse before evaluating, so the student gets "XLOOKUP isn't available here"
 * rather than a bare #NAME? they have to decode.
 */
export function guardFormula(input: string): Guard {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Write a formula first." };

  const body = trimmed.startsWith("=") ? trimmed.slice(1).trim() : trimmed;
  if (!body) return { ok: false, reason: "Write a formula after the =." };

  if (body.length > MAX_FORMULA_CHARS) {
    return {
      ok: false,
      reason: `Keep the formula under ${MAX_FORMULA_CHARS} characters.`,
    };
  }

  /**
   * Only Sheet1 exists. A cross-sheet reference would otherwise fail with a
   * #REF! that reads like a mistake in the student's ranges.
   */
  if (/[A-Za-z0-9_']+\s*!/.test(body)) {
    return {
      ok: false,
      reason: "There is only one sheet here — refer to cells directly, like B2:B40.",
    };
  }

  // Function names: an identifier immediately followed by an opening bracket.
  const called = new Set<string>();
  for (const match of body.matchAll(/([A-Za-z][A-Za-z0-9._]*)\s*\(/g)) {
    called.add(match[1].toUpperCase());
  }

  for (const name of called) {
    if (ALLOWED.has(name)) continue;
    const substitute = substituteFor(name);
    return {
      ok: false,
      reason: substitute
        ? `${name} is not available here. Use ${substitute} instead.`
        : `${name} is not available here. The functions you can use are listed beside the grid.`,
    };
  }

  /**
   * The parser has no element-wise array arithmetic: C2:C6*D2:D6 multiplies
   * the FIRST cell of each range and returns that, with no error. In Excel it is
   * an array formula and answers correctly, so a student who wrote valid Excel
   * would be marked wrong. Refusing says what to write instead.
   */
  const literals = body.match(STRING_LITERAL) ?? [];
  let bare = body.replace(STRING_LITERAL, '""');
  for (let previous = ""; previous !== bare; ) {
    previous = bare;
    bare = bare.replace(GROUPED_RANGE, "$1");
  }
  if (RANGE_OPERAND.test(bare)) {
    return {
      ok: false,
      reason:
        "Arithmetic or comparisons across a whole range (like C2:C6*D2:D6) are not supported here. Use SUMPRODUCT(C2:C6,D2:D6) to multiply ranges, or SUMIFS and COUNTIFS for conditions.",
    };
  }

  if (
    [...called].some((name) => WILDCARD_BLIND.has(name)) &&
    literals.some((literal) => /[*?~]/.test(literal))
  ) {
    return {
      ok: false,
      reason:
        'Wildcards (* and ?) in criteria are not supported here. Match the full text instead, like "West".',
    };
  }

  return { ok: true, formula: body };
}

export interface Evaluation {
  ok: boolean;
  value?: CellValue;
  /** Excel's own error text (#N/A, #DIV/0!) or a parser message. */
  error?: string;
}

function cellOf(grid: Grid, row: number, col: number): CellValue {
  const line = grid[row - 1];
  if (!line) return null;
  const value = line[col - 1];
  return value === undefined ? null : value;
}

function widthOf(grid: Grid): number {
  return grid.reduce((widest, row) => Math.max(widest, row.length), 0);
}

/**
 * Evaluate one formula against one grid.
 *
 * The formula is evaluated from a cell placed beyond the right edge of the
 * data, so that a whole-column reference (A:A) cannot pick up the answer cell
 * itself and produce a circular reference the student did not write.
 */
export function evaluateFormula(grid: Grid, formula: string): Evaluation {
  const parser = new FormulaParser({
    functions: buildFunctions(),
    onCell: ({ row, col }) => cellOf(grid, row, col),
    onRange: (ref) => {
      const rows: CellValue[][] = [];
      const lastRow = Math.min(ref.to.row, grid.length);
      for (let row = ref.from.row; row <= lastRow; row++) {
        const line: CellValue[] = [];
        for (let col = ref.from.col; col <= ref.to.col; col++) {
          line.push(cellOf(grid, row, col));
        }
        rows.push(line);
      }
      return rows;
    },
  });

  const position = { sheet: SHEET, row: 1, col: widthOf(grid) + 3 };

  try {
    const value = parser.parse(formula, position);

    if (value instanceof FormulaError || value instanceof Error) {
      return { ok: false, error: (value as Error).name ?? "#VALUE!" };
    }

    // A formula returning a range (an unspilled array) is not an answer.
    if (Array.isArray(value)) {
      const flat = value.flat();
      if (flat.length !== 1) {
        return {
          ok: false,
          error: "That returns a range of values rather than one answer.",
        };
      }
      return { ok: true, value: (flat[0] ?? null) as CellValue };
    }

    return { ok: true, value: (value ?? null) as CellValue };
  } catch (error) {
    if (error instanceof FormulaError) {
      return { ok: false, error: error.name };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That formula could not be read.",
    };
  }
}

export interface Comparison {
  match: boolean;
  reason?: string;
}

/**
 * Compare a student's value against the reference value.
 *
 * Numbers get a tolerance because an honest formula and an honest reference can
 * differ in the last bits of a float. Text is trimmed and compared without
 * case, because "West" and "west" are the same answer to a question about a
 * region and marking one wrong teaches nothing.
 */
export function compareValues(
  expected: CellValue,
  actual: CellValue,
  tolerance = DEFAULT_TOLERANCE,
): Comparison {
  if (typeof expected === "number") {
    if (typeof actual !== "number" || !Number.isFinite(actual)) {
      return { match: false, reason: `Expected a number, got ${describe(actual)}.` };
    }
    const difference = Math.abs(expected - actual);
    const scale = Math.max(1, Math.abs(expected));
    if (difference <= tolerance * scale) return { match: true };
    return { match: false, reason: `Expected ${round(expected)}, got ${round(actual)}.` };
  }

  if (typeof expected === "boolean") {
    if (actual === expected) return { match: true };
    return { match: false, reason: `Expected ${expected}, got ${describe(actual)}.` };
  }

  if (expected === null) {
    if (actual === null || actual === "") return { match: true };
    return { match: false, reason: `Expected a blank, got ${describe(actual)}.` };
  }

  const wanted = String(expected).trim().toLowerCase();
  const got = String(actual ?? "").trim().toLowerCase();
  if (wanted === got) return { match: true };
  return { match: false, reason: `Expected ${describe(expected)}, got ${describe(actual)}.` };
}

export type Verdict =
  | { correct: true; value: CellValue }
  | { correct: false; stage: "refused"; reason: string }
  | { correct: false; stage: "error"; error: string }
  | { correct: false; stage: "visible"; reason: string; value: CellValue }
  | { correct: false; stage: "hidden"; reason: string }
  /** The reference formula itself fails. Never the student's fault, never recorded against them. */
  | { correct: false; stage: "misconfigured"; detail: string };

export const HIDDEN_REASON =
  "Right on the numbers you can see, wrong on a second grid with the same columns and different numbers. A formula that only works on this data is not a formula — check whether you have typed a value in by hand.";

/**
 * Mark one formula: four evaluations, the reference and the student's on each
 * grid. The reference is evaluated rather than stored, so editing a seed grid
 * cannot leave a stale expected value behind it.
 */
export function markFormula(exercise: {
  grid: Grid;
  hidden_grid: Grid;
  solution_formula: string;
  tolerance?: number | string | null;
}, input: string): Verdict {
  const tolerance =
    exercise.tolerance === null || exercise.tolerance === undefined
      ? DEFAULT_TOLERANCE
      : Number(exercise.tolerance);

  const guard = guardFormula(input);
  if (!guard.ok || !guard.formula) {
    return { correct: false, stage: "refused", reason: guard.reason ?? "That formula is not allowed." };
  }

  const reference = guardFormula(exercise.solution_formula);
  if (!reference.ok || !reference.formula) {
    return { correct: false, stage: "misconfigured", detail: `reference refused: ${reference.reason}` };
  }

  const mine = evaluateFormula(exercise.grid, guard.formula);
  if (!mine.ok) {
    return { correct: false, stage: "error", error: mine.error ?? "#VALUE!" };
  }

  const expected = evaluateFormula(exercise.grid, reference.formula);
  if (!expected.ok) {
    return { correct: false, stage: "misconfigured", detail: `reference fails on grid: ${expected.error}` };
  }

  const onVisible = compareValues(expected.value ?? null, mine.value ?? null, tolerance);
  if (!onVisible.match) {
    return {
      correct: false,
      stage: "visible",
      reason: onVisible.reason ?? "Not the expected answer.",
      value: mine.value ?? null,
    };
  }

  // Right on the grid they can see. Now the one that decides it.
  const expectedHidden = evaluateFormula(exercise.hidden_grid, reference.formula);
  if (!expectedHidden.ok) {
    return {
      correct: false,
      stage: "misconfigured",
      detail: `reference fails on hidden grid: ${expectedHidden.error}`,
    };
  }

  const mineHidden = evaluateFormula(exercise.hidden_grid, guard.formula);
  if (
    !mineHidden.ok ||
    !compareValues(expectedHidden.value ?? null, mineHidden.value ?? null, tolerance).match
  ) {
    return { correct: false, stage: "hidden", reason: HIDDEN_REASON };
  }

  return { correct: true, value: mine.value ?? null };
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function describe(value: CellValue): string {
  if (value === null) return "a blank";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}
