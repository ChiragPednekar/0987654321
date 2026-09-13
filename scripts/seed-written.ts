/**
 * Seeds the written practice formats — guesstimate, RCA, stock pitch, brand
 * teardown, memo, WAT, behavioural.
 *
 *   npm run seed:written
 *   npm run seed:written -- --dry-run
 *
 * Each becomes a `cases` row plus a `rubrics` row and nothing else. No part of
 * src/lib/ai knows these formats exist: the grader reads a scenario, a rubric
 * and an answer, and the rubric is what makes a guesstimate marked like a
 * guesstimate rather than like a case.
 *
 * Idempotent on slug.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { WRITTEN_SEEDS } from "./content/written-formats";

config({ path: ".env.local" });
config({ path: ".env" });

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  // A rubric whose weights do not total 100 silently rescales what every
  // criterion is worth, and nothing downstream would complain.
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const seed of WRITTEN_SEEDS) {
    const total = Object.values(seed.rubric).reduce((n, [w]) => n + w, 0);
    if (total !== 100) problems.push(`${seed.slug}: rubric weights total ${total}, not 100`);
    if (slugs.has(seed.slug)) problems.push(`${seed.slug}: duplicate slug`);
    slugs.add(seed.slug);
    if (Object.keys(seed.rubric).length < 2) problems.push(`${seed.slug}: needs at least 2 criteria`);
  }

  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const byFormat = WRITTEN_SEEDS.reduce<Record<string, number>>((acc, s) => {
    acc[s.format] = (acc[s.format] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`${WRITTEN_SEEDS.length} written exercises, all valid.`);
  for (const [f, n] of Object.entries(byFormat)) {
    console.log(`  ${f.padEnd(16)} ${n}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const seed of WRITTEN_SEEDS) {
    const { data: row, error } = await admin
      .from("cases")
      .upsert(
        {
          slug: seed.slug,
          title: seed.title,
          domain: seed.domain,
          difficulty: seed.difficulty,
          format: seed.format,
          estimated_minutes: seed.minutes,
          scenario: seed.scenario,
          instructions: seed.instructions,
          expected_framework: seed.expected_framework,
          supporting_data: {},
          tags: [seed.format],
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

    const criteria = Object.fromEntries(
      Object.entries(seed.rubric).map(([k, [w]]) => [k, w]),
    );
    const descriptors = Object.fromEntries(
      Object.entries(seed.rubric).map(([k, [, d]]) => [k, d]),
    );

    const { error: rubricError } = await admin.from("rubrics").upsert(
      {
        case_id: row.id,
        criteria,
        descriptors,
        max_score: Object.values(criteria).reduce((a, b) => a + b, 0),
      },
      { onConflict: "case_id" },
    );

    if (rubricError) {
      console.error(`${seed.slug} rubric: ${rubricError.message}`);
      process.exit(1);
    }

    console.log(`  ✓ ${seed.format.padEnd(16)} ${seed.slug}`);
  }

  console.log(`\nSeeded ${WRITTEN_SEEDS.length} exercises.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
