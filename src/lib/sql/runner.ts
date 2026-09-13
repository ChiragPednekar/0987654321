/**
 * Deliberately NOT marked `server-only`.
 *
 * The seeder validates every reference solution by running it against both
 * datasets before writing anything, and that is the check which stops a broken
 * solution failing students who wrote a correct query. A `server-only` import
 * makes the module unloadable from a plain script, so the guard would have
 * cost the validation.
 *
 * Nothing is lost by dropping it: this module imports node:fs, which Next
 * refuses to bundle into a client component anyway, with a clearer message
 * than server-only would give.
 */
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

/**
 * Runs a student's SQL and decides whether it is right.
 *
 * ---------------------------------------------------------------------------
 * Executing untrusted code, and where
 * ---------------------------------------------------------------------------
 * Grading a query means running it, which is why this was left until last.
 * Three options were considered and two rejected.
 *
 * Running it against the production Postgres — even as a read-only role — is
 * out. It exposes the whole schema to anyone who can type information_schema,
 * and one careless cross join would take the site down for everybody.
 *
 * A separate sandboxed Postgres is the textbook answer and needs infrastructure
 * that does not exist on this stack.
 *
 * So: SQLite compiled to WebAssembly, in memory, created fresh per request and
 * thrown away. The WASM sandbox has no filesystem and no network, so there is
 * nothing for a query to reach even if it escapes SQLite's own semantics. The
 * database is built from the exercise's own seed rows and contains nothing but
 * them.
 *
 * The residual risk is worth stating plainly: a query CAN still burn CPU — a
 * cross join of three tables, a recursive CTE that never terminates. sql.js
 * offers no interrupt, so the mitigations are bounded fixtures, a statement
 * deny-list, a row cap, and the route's own maxDuration as the backstop. A
 * hung query costs one function invocation and affects nobody else.
 *
 * ---------------------------------------------------------------------------
 * Why every exercise has a second, hidden dataset
 * ---------------------------------------------------------------------------
 * Comparing a result set against an expected one has a famous hole: the
 * student can skip the question and write the answer out as literals, such as
 * selecting 'Mumbai', 450 union all selecting 'Pune', 310. That produces the
 * right rows without querying anything.
 *
 * So a submission runs twice: against the dataset the student can see, and
 * against a hidden variant with the same schema and different rows. A correct
 * query answers both. A hardcoded one answers the first and fails the second,
 * and the failure message says exactly that.
 */

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Refused outright rather than sandboxed around.
 *
 * ATTACH and the pragmas reach outside the single in-memory database; the
 * write statements would let a student mutate the fixture and then pass by
 * making the data match their query. None has a legitimate use in an exercise
 * that asks a question about data.
 */
const FORBIDDEN = [
  "attach",
  "detach",
  "pragma",
  "vacuum",
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "replace",
  "load_extension",
  "writefile",
  "readfile",
];

export interface Guard {
  ok: boolean;
  reason?: string;
}

/**
 * Checks the statement before it reaches SQLite.
 *
 * Comments are stripped first, because a line comment followed by ATTACH would
 * otherwise walk straight past a naive scan. Word boundaries matter too: an
 * exercise about a created_at column must not be refused for containing
 * "create".
 */
export function guardQuery(sql: string): Guard {
  const withoutComments = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ");

  const normalised = withoutComments.toLowerCase();

  if (!normalised.trim()) return { ok: false, reason: "Write a query first." };

  // One statement only. A trailing semicolon is fine; a second statement is
  // how a deny-list gets walked past.
  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (statements.length > 1) {
    return { ok: false, reason: "Write a single SELECT statement." };
  }

  for (const word of FORBIDDEN) {
    if (new RegExp(`\\b${word}\\b`).test(normalised)) {
      return {
        ok: false,
        reason: `${word.toUpperCase()} is not allowed here — these exercises are read-only.`,
      };
    }
  }

  if (!/^\s*(select|with)\b/i.test(withoutComments.trim())) {
    return { ok: false, reason: "Start with SELECT (or WITH)." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type Cell = string | number | null;
export type Row = Cell[];

export interface ResultSet {
  columns: string[];
  rows: Row[];
}

/** Numbers differing only by floating-point noise are the same answer. */
function cellKey(cell: Cell): string {
  if (cell === null) return "\\u0000null";
  if (typeof cell === "number") {
    return Number.isInteger(cell) ? String(cell) : cell.toFixed(6);
  }
  return cell;
}

function rowKey(row: Row): string {
  return row.map(cellKey).join("\\u0001");
}

export interface Comparison {
  correct: boolean;
  reason?: string;
}

/**
 * Compares two result sets.
 *
 * Column NAMES are deliberately not compared. Whether a student writes
 * count(*), count(*) as n, or as total says nothing about whether they
 * understood the question, and failing them for it would be the most
 * infuriating thing this grader could do. Column COUNT is compared, because
 * selecting the wrong number of columns is a real error.
 *
 * Row order is compared only when the exercise asks for it — which is exactly
 * when the student was told to write an ORDER BY.
 */
export function compareResults(
  expected: ResultSet,
  actual: ResultSet,
  orderMatters: boolean,
): Comparison {
  if (actual.columns.length !== expected.columns.length) {
    return {
      correct: false,
      reason: `Expected ${expected.columns.length} column(s), got ${actual.columns.length}.`,
    };
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      correct: false,
      reason: `Expected ${expected.rows.length} row(s), got ${actual.rows.length}.`,
    };
  }

  if (orderMatters) {
    for (let i = 0; i < expected.rows.length; i++) {
      if (rowKey(expected.rows[i]) !== rowKey(actual.rows[i])) {
        return {
          correct: false,
          reason: `Row ${i + 1} does not match. This exercise depends on the order, so check your ORDER BY.`,
        };
      }
    }
    return { correct: true };
  }

  // Multiset comparison: duplicates must match in number too, or a query that
  // forgot its GROUP BY could pass.
  const counts = new Map<string, number>();
  for (const row of expected.rows) {
    const key = rowKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of actual.rows) {
    const key = rowKey(row);
    const left = counts.get(key);
    if (!left) return { correct: false, reason: "The rows do not match." };
    counts.set(key, left - 1);
  }

  return { correct: true };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/** Above this, the student has almost certainly written a cross join. */
export const MAX_RESULT_ROWS = 500;

let sqlPromise: Promise<SqlJsStatic> | null = null;

/**
 * Loads the WASM once per warm instance.
 *
 * The binary is read from disk and handed over directly rather than letting
 * sql.js fetch it by URL: there is no origin to fetch from inside a serverless
 * function, and a locateFile guess is exactly the kind of thing that works
 * locally and 404s in production.
 */
function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const file = fs.readFileSync(
      path.join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"),
    );
    // Node hands back a Buffer, which is a view over a possibly larger pool.
    // sql.js wants a plain ArrayBuffer, so slice out exactly this file's bytes
    // rather than passing the pool and hoping the offsets line up.
    sqlPromise = initSqlJs({
      wasmBinary: file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      ) as ArrayBuffer,
    });
  }
  return sqlPromise;
}

export interface RunResult {
  ok: boolean;
  result?: ResultSet;
  error?: string;
  truncated?: boolean;
}

/**
 * Builds a fresh database from setup, runs query, throws it away.
 *
 * Nothing survives the call: the database lives in WASM memory and is closed
 * in a finally block, so one student's statement cannot reach another's data
 * because the other's data does not exist by then.
 */
export async function runQuery(setup: string, query: string): Promise<RunResult> {
  const guard = guardQuery(query);
  if (!guard.ok) return { ok: false, error: guard.reason };

  const SQL = await getSql();
  let db: Database | null = null;

  try {
    db = new SQL.Database();
    db.run(setup);

    const statement = db.prepare(query);
    const columns: string[] = [];
    const rows: Row[] = [];
    let truncated = false;

    while (statement.step()) {
      if (columns.length === 0) columns.push(...statement.getColumnNames());
      if (rows.length >= MAX_RESULT_ROWS) {
        truncated = true;
        break;
      }
      rows.push(statement.get() as Row);
    }
    if (columns.length === 0) columns.push(...statement.getColumnNames());
    statement.free();

    return { ok: true, result: { columns, rows }, truncated };
  } catch (error) {
    // SQLite's own messages are the most useful thing to show: "no such
    // column: regoin" beats anything that paraphrases it.
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The query failed.",
    };
  } finally {
    db?.close();
  }
}
