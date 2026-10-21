/**
 * Seeds the MBB-style case set: every consulting firm on the company pages, at
 * every level, in the interview format that firm uses.
 *
 *   npm run seed:mbb          # write to the database
 *   npm run seed:mbb -- --dry-run
 *
 * Idempotent: upserts on slug, so re-running updates rows in place. Sets
 * firm_style = 'MBB-style', which is what the company pages link to.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { buildMbbCases } from "./templates/mbb";

config({ path: ".env.local" });
config({ path: ".env" });

const DRY_RUN = process.argv.includes("--dry-run");
const FIRM_STYLE = "MBB-style";

/** Same check as the main seed: a failed interpolation lands next to a value. */
const INTERPOLATION_FAILURE = /[₹$€£¥]\s*undefined|undefined\s*(?:Cr|M|B|units|years)\b|undefined\s*[%×]|\bNaN\b|Infinity/;

export function validate(cases: ReturnType<typeof buildMbbCases>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.slug)) problems.push(`duplicate slug: ${c.slug}`);
    seen.add(c.slug);
    if (c.scenario.length < 200) problems.push(`${c.slug}: scenario too short`);
    if (c.modelAnswer.length < 400) problems.push(`${c.slug}: model answer too short`);
    const text = [c.title, c.scenario, c.instructions, c.modelAnswer, c.expectedFramework, JSON.stringify(c.supportingData), JSON.stringify(c.rubric)].join("\n");
    if (INTERPOLATION_FAILURE.test(text)) problems.push(`${c.slug}: failed interpolation`);
    const weights = Object.values(c.rubric.criteria);
    if (weights.reduce((a, b) => a + b, 0) !== 100) problems.push(`${c.slug}: rubric does not sum to 100`);
  }
  return problems;
}

async function main() {
  const cases = buildMbbCases();
  const problems = validate(cases);
  if (problems.length > 0) {
    console.error(`${problems.length} validation problems:`);
    problems.slice(0, 25).forEach((p) => console.error("  " + p));
    process.exit(1);
  }

  const spread = cases.reduce<Record<string, number>>((acc, c) => {
    const key = `${c.companyTrack} ${c.difficulty}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Validated ${cases.length} MBB-style cases.`, spread);

  if (DRY_RUN) {
    const sample = cases.find((c) => c.difficulty === "hard") ?? cases[0];
    console.log("\nSample:\n", sample.title, "\n\n", sample.scenario, "\n\n", sample.instructions, "\n\n", sample.modelAnswer);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const supabase = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: categories, error: catError } = await supabase.from("case_categories").select("id, slug");
  if (catError) throw new Error(`Could not read case_categories: ${catError.message}`);
  const categoryBySlug = new Map((categories ?? []).map((row) => [row.slug, row.id]));

  const rows = cases.map((c) => {
    const categoryId = categoryBySlug.get(c.categorySlug);
    if (!categoryId) throw new Error(`${c.slug}: unknown category ${c.categorySlug}`);
    return {
      slug: c.slug,
      title: c.title,
      domain: c.domain,
      difficulty: c.difficulty,
      category_id: categoryId,
      format: "full_case" as const,
      firm_style: FIRM_STYLE,
      company_track: c.companyTrack,
      estimated_minutes: c.estimatedMinutes,
      scenario: c.scenario,
      instructions: c.instructions,
      supporting_data: c.supportingData,
      expected_framework: c.expectedFramework,
      model_answer: c.modelAnswer,
      tags: c.tags,
      is_published: true,
    };
  });

  const { data: written, error } = await supabase.from("cases").upsert(rows, { onConflict: "slug" }).select("id, slug");
  if (error) throw new Error(`Case upsert failed: ${error.message}`);
  const idBySlug = new Map((written ?? []).map((row) => [row.slug, row.id]));

  const rubrics = cases.map((c) => ({
    case_id: idBySlug.get(c.slug)!,
    criteria: c.rubric.criteria,
    descriptors: c.rubric.descriptors,
    max_score: Object.values(c.rubric.criteria).reduce((a, b) => a + b, 0),
    pass_score: c.rubric.passScore,
  }));
  const { error: rubricError } = await supabase.from("rubrics").upsert(rubrics, { onConflict: "case_id" });
  if (rubricError) throw new Error(`Rubric upsert failed: ${rubricError.message}`);

  console.log(`Done. ${rows.length} MBB-style cases and rubrics are live.`);
}

if (process.argv[1]?.endsWith("seed-mbb.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
