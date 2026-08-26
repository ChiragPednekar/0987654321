/**
 * Fails if the application references a table or function the migrations do not
 * create.
 *
 *   npm run check:schema
 *
 * Why this exists. `src/lib/types/database.ts` is written by hand, so it is a
 * statement of intent rather than a reflection of the database. When
 * `usage_events`, `audit_log`, `platform_overview`, `admin_user_list`,
 * `cases.visibility` and `cases.owner_classroom_id` were applied straight to
 * production and never written into a migration, the types still declared all
 * six — so `tsc` passed, lint passed, the build passed, and CI was green while
 * teacher question creation, assignment creation and the admin dashboard were
 * broken on every environment built from the migrations. Two of the failures
 * were silent, because recordUsage() and audit() swallow their own errors.
 *
 * Nothing in the pipeline could have caught that. This can: it compares what
 * the code asks the database for against what the migrations actually create.
 *
 * It is deliberately a text comparison rather than a live database check, so it
 * runs in CI on a fork with no credentials and no Postgres. That makes it
 * approximate in one direction — it cannot verify column-level references — so
 * a `columns` allowlist covers the ones worth asserting by hand.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "supabase/migrations";
const SOURCE_ROOTS = ["src"];

/** Objects the migrations legitimately do not create. */
const EXTERNAL = new Set([
  // Supabase manages these.
  "users_view",
]);

/** Column references worth asserting by hand, as `table.column`. */
const COLUMNS: { table: string; column: string }[] = [
  { table: "cases", column: "visibility" },
  { table: "cases", column: "owner_classroom_id" },
  { table: "classroom_assignments", column: "is_published" },
  { table: "classroom_assignments", column: "allow_resubmission" },
  { table: "classroom_assignments", column: "max_attempts" },
  { table: "assignment_submissions", column: "attempt_number" },
  { table: "assignment_submissions", column: "returned_at" },
  { table: "institutions", column: "is_suspended" },
  { table: "institutions", column: "contract_value_inr" },
  { table: "institutions", column: "grading_quota" },
  { table: "usage_events", column: "cost_inr" },
  { table: "audit_log", column: "actor_email" },
  { table: "users", column: "deactivated_at" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

const migrationSql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
  .join("\n");

const definedTables = new Set(
  [...migrationSql.matchAll(/create\s+(?:table|view)(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-z_]+)/gi)]
    .map((m) => m[1].toLowerCase()),
);

const definedFunctions = new Set(
  [...migrationSql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_]+)/gi)]
    .map((m) => m[1].toLowerCase()),
);

const sourceFiles = SOURCE_ROOTS.flatMap((root) => walk(root));

const usedTables = new Map<string, string>();
const usedFunctions = new Map<string, string>();

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/\.from\("([a-z_]+)"\)/g)) {
    if (!usedTables.has(match[1])) usedTables.set(match[1], file);
  }
  for (const match of text.matchAll(/\.rpc\("([a-z_]+)"/g)) {
    if (!usedFunctions.has(match[1])) usedFunctions.set(match[1], file);
  }
}

const problems: string[] = [];

for (const [table, file] of usedTables) {
  if (!definedTables.has(table) && !EXTERNAL.has(table)) {
    problems.push(`table  public.${table}  — used in ${file}`);
  }
}

for (const [fn, file] of usedFunctions) {
  if (!definedFunctions.has(fn)) {
    problems.push(`rpc    public.${fn}()  — called in ${file}`);
  }
}

/**
 * Everything the migrations say about one table: its `create table` body plus
 * every `alter table` aimed at it.
 *
 * Scoped rather than searched globally, because a bare word match is worthless
 * here — `visibility` appears in a policy comment and in an unrelated
 * `group_posts` policy, which is exactly how a missing `cases.visibility` would
 * slip past this check while `cases.owner_classroom_id` got caught.
 */
function statementsFor(table: string): string {
  const chunks: string[] = [];

  const create = new RegExp(
    `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\)`,
    "i",
  ).exec(migrationSql);
  if (create) chunks.push(create[1]);

  for (const alter of migrationSql.matchAll(
    new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\b([\\s\\S]*?);`, "gi"),
  )) {
    chunks.push(alter[1]);
  }

  return chunks.join("\n");
}

for (const { table, column } of COLUMNS) {
  const scoped = statementsFor(table);
  if (!new RegExp(`\\b${column}\\b`, "i").test(scoped)) {
    problems.push(
      scoped
        ? `column public.${table}.${column}  — never created`
        : `column public.${table}.${column}  — table public.${table} not found either`,
    );
  }
}

if (problems.length > 0) {
  console.error(
    "\nThe application references database objects that no migration creates:\n",
  );
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(
    "\nAdd a migration under supabase/migrations/ that creates them. If the object\n" +
      "already exists in production, write the migration idempotently (`if not\n" +
      "exists`, `create or replace`) so it is safe to apply there too.\n",
  );
  process.exit(1);
}

console.log(
  `Schema references OK — ${usedTables.size} tables and ${usedFunctions.size} functions ` +
    `used by the app all exist in ${MIGRATIONS}.`,
);
