/**
 * Seeds Model Workspace cases (the DCF and comps builds).
 *
 *   npm run seed:models
 *   npm run seed:models -- --dry-run     (prints every computed cell)
 *
 * Expected values are computed from each case's inputs by the functions in
 * scripts/content/model-cases.ts, in row then column order, and rounded to two
 * decimals. The seeder refuses a case whose cells collide, whose values are not
 * finite, or whose labels repeat (labels are how later cells refer to earlier
 * ones). Idempotent on slug; a re-seed replaces that case's cells.
 *
 * The one existing model case (model-saas-unit-economics) was created directly
 * in production and is not touched here.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { MODEL_CASES, type ModelCaseSeed } from "./content/model-cases";

config({ path: ".env.local" });
config({ path: ".env" });

function compute(seed: ModelCaseSeed): { values: Record<string, number>; problems: string[] } {
  const values: Record<string, number> = {};
  const problems: string[] = [];
  const positions = new Set<string>();

  const ordered = [...seed.cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of ordered) {
    const at = `${cell.row},${cell.col}`;
    if (positions.has(at)) problems.push(`${seed.slug}: two cells at row ${cell.row}, col ${cell.col}`);
    positions.add(at);
    if (cell.label in values) problems.push(`${seed.slug}: duplicate label "${cell.label}"`);

    const raw = cell.value(values);
    if (!Number.isFinite(raw)) {
      problems.push(`${seed.slug}: "${cell.label}" is not a finite number — does it refer to a later cell?`);
      continue;
    }
    values[cell.label] = Math.round(raw * 100) / 100;
  }
  return { values, problems };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const problems: string[] = [];
  const computed = new Map<string, Record<string, number>>();

  for (const seed of MODEL_CASES) {
    const result = compute(seed);
    problems.push(...result.problems);
    computed.set(seed.slug, result.values);
    console.log(`\n${seed.slug}`);
    for (const [label, value] of Object.entries(result.values)) {
      console.log(`  ${label.padEnd(30)} ${value.toLocaleString("en-IN")}`);
    }
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  if (dryRun) {
    console.log(`\nDry run: ${MODEL_CASES.length} model cases valid. Nothing written.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const seed of MODEL_CASES) {
    const { data: row, error } = await admin
      .from("cases")
      .upsert(
        {
          slug: seed.slug,
          title: seed.title,
          domain: "finance",
          difficulty: seed.difficulty,
          format: "model",
          estimated_minutes: seed.minutes,
          scenario: seed.scenario,
          instructions: seed.instructions,
          supporting_data: seed.supporting,
          tags: seed.tags,
          is_published: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error || !row) {
      console.error(`${seed.slug}: ${error?.message}`);
      process.exit(1);
    }

    // Replace rather than merge, so a removed or moved cell does not linger.
    const { error: deleteError } = await admin.from("model_cells").delete().eq("case_id", row.id);
    if (deleteError) {
      console.error(`${seed.slug} cells: ${deleteError.message}`);
      process.exit(1);
    }

    const values = computed.get(seed.slug)!;
    const { error: cellError } = await admin.from("model_cells").insert(
      seed.cells.map((cell) => ({
        case_id: row.id,
        row_index: cell.row,
        col_index: cell.col,
        label: cell.label,
        expected: values[cell.label],
        tolerance_pct: cell.tolerancePct ?? 2,
        unit: cell.unit,
        formula: cell.formula,
        explanation: cell.explanation,
      })),
    );
    if (cellError) {
      console.error(`${seed.slug} cells: ${cellError.message}`);
      process.exit(1);
    }
    console.log(`Seeded ${seed.slug} with ${seed.cells.length} cells.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
