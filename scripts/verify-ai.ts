/**
 * End-to-end check of the AI grading pipeline against a real case and rubric.
 *
 *   npm run verify:ai
 *
 * This exercises the same `evaluateSubmission` the submissions route uses —
 * prompt, provider call, structured output, clamping and the server-side
 * arithmetic — so a pass here means grading genuinely works, not that it
 * compiles. v1 shipped this whole pipeline without ever running it once.
 *
 * `server-only` is resolved to an empty module by the --conditions=react-server
 * flag in the npm script, which is what lets a plain Node script import the
 * real server code instead of a duplicate of it.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { evaluateSubmission } from "../src/lib/ai/evaluate";

config({ path: ".env.local" });
config({ path: ".env" });

const SAMPLE_ANSWER = `
Recommendation: take the round, but negotiate the amount down.

Analysis. Cash is ₹14 Cr against ₹12 Cr of annual net burn, so monthly burn is
₹1.0 Cr and runway is roughly 14 months. That is inside the window where a
raise is still voluntary rather than forced, which is the strongest possible
negotiating position and argues against waiting.

Growth is 56% on ₹72 Cr of ARR, so net new ARR is about ₹40 Cr, giving a burn
multiple near 0.3. That is efficient — the company is not buying growth. Net
revenue retention of 123% means the installed base compounds without new
logos, and 79% gross margin means incremental revenue mostly reaches the
bottom line.

The offer is ₹116 Cr at ₹464 Cr pre-money, implying 20% dilution at a post
of ₹580 Cr, or about 8x ARR. For a business growing 56% with these retention
and efficiency metrics, that multiple is defensible but not generous.

Risks. Taking the money: dilution is permanent, and entering two adjacent
markets at once splits focus and typically degrades the efficiency that makes
this company attractive. Not taking it: reaching breakeven on ₹14 Cr requires
cutting growth investment, which lowers the multiple at the next raise, and
leaves no buffer if NRR slips.

What I would monitor: monthly burn multiple, NRR by cohort, and pipeline
coverage in the first adjacent market before funding the second.

Recommendation. Raise, but take ₹80-90 Cr rather than ₹116 Cr, and fund one
adjacent market rather than two, with the second gated on hitting a defined
pipeline milestone. I would accept ~15% dilution at this valuation and reject
terms carrying a participating preference or a liquidation multiple above 1x.
`.trim();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const providerKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;

  if (!providerKey) {
    console.error(
      `AI_PROVIDER is "${provider}" but its API key is not set. Nothing to verify.`,
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: caseData, error: caseError } = await supabase
    .from("cases")
    .select(
      "id, slug, title, domain, difficulty, scenario, instructions, supporting_data, expected_framework, model_answer",
    )
    .eq("slug", "capital-raise-1")
    .maybeSingle();

  if (caseError || !caseData) {
    console.error("Could not load the sample case. Has the library been seeded?");
    process.exit(1);
  }

  const { data: rubric } = await supabase
    .from("rubrics")
    .select("criteria, descriptors, max_score")
    .eq("case_id", caseData.id)
    .maybeSingle();

  if (!rubric) {
    console.error(`"${caseData.title}" has no rubric.`);
    process.exit(1);
  }

  console.log(`Case     : ${caseData.title}`);
  console.log(`Provider : ${provider}`);
  console.log(`Criteria : ${Object.keys(rubric.criteria).join(", ")}`);
  console.log(`Grading…\n`);

  const started = Date.now();
  const result = await evaluateSubmission(caseData, rubric, SAMPLE_ANSWER);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  for (const [criterion, points] of Object.entries(result.breakdown)) {
    const weight = rubric.criteria[criterion];
    console.log(`  ${criterion.padEnd(28)} ${String(points).padStart(3)} / ${weight}`);
  }

  console.log(
    `\n  TOTAL${" ".repeat(24)} ${String(result.totalScore).padStart(3)} / ${result.maxScore}` +
      `  (${result.percentage.toFixed(1)}%)`,
  );
  console.log(`\nVerdict: ${result.feedback.verdict}`);
  console.log(`\nStrengths:`);
  result.feedback.strengths.forEach((s) => console.log(`  + ${s}`));
  console.log(`\nImprovements:`);
  result.feedback.improvements.forEach((s) => console.log(`  → ${s}`));
  console.log(
    `\nmodel=${result.model}  tokens=${result.tokensUsed}  elapsed=${elapsed}s`,
  );

  // The model is an opinion source; these invariants are the trust boundary.
  const problems: string[] = [];
  if (result.totalScore > result.maxScore) problems.push("total exceeds max");
  if (result.totalScore < 0) problems.push("total is negative");
  for (const [criterion, points] of Object.entries(result.breakdown)) {
    const weight = rubric.criteria[criterion];
    if (points > weight) problems.push(`${criterion} exceeds its weight`);
    if (points < 0) problems.push(`${criterion} is negative`);
  }
  const recomputed = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
  if (recomputed !== result.totalScore)
    problems.push("total does not equal the sum of its criteria");

  if (problems.length > 0) {
    console.error(`\n✗ Clamping failed: ${problems.join("; ")}`);
    process.exit(1);
  }

  console.log("\n✓ Pipeline verified: scores clamped to the rubric and totalled server-side.");
}

main().catch((error) => {
  console.error("\n✗ Grading failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
