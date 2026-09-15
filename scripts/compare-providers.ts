/**
 * Grades the same answers through two or more providers and compares them.
 *
 *   npm run compare:providers
 *   npm run compare:providers -- --samples=6
 *   npm run compare:providers -- --source=submissions
 *
 * WHY THIS EXISTS
 *
 * Switching the grader is a one-line environment change, which makes it very
 * easy to switch on a hunch. The question that actually matters is not whether
 * another model returns valid JSON — they all do — but whether it grades the
 * same work the same way, and what that costs. This measures both.
 *
 * WHAT IT MEASURES, AND WHY THOSE THINGS
 *
 *   1. Agreement on score. Two graders that differ by a constant offset are
 *      interchangeable after a rescale. Two that disagree per answer are not.
 *   2. ORDERING. The more important one. A grader can be harsh or generous and
 *      still be useful, so long as it puts a strong answer above a weak one.
 *      A grader that reorders them is unusable at any price.
 *   3. Cost from MEASURED tokens, not assumed ones — the same discipline the
 *      usage dashboard uses. Output is priced five times input, so an assumed
 *      split is an assumed bill.
 *   4. Latency, because a grading route has a maxDuration of 120s and a slower
 *      model eats that budget.
 *
 * WHERE THE ANSWERS COME FROM
 *
 * By default a built-in calibration set: the same case answered at three
 * deliberately different levels. That is a sharper test than real submissions
 * when volume is low, because the correct ORDER is known in advance, so a
 * grader either reproduces it or does not. Pass --source=submissions to use
 * real graded work instead once there is enough of it.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database, RubricCriteria } from "../src/lib/types/database";
import { evaluateSubmission } from "../src/lib/ai/evaluate";

config({ path: ".env.local" });
config({ path: ".env" });

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

const SAMPLE_COUNT = Number(flag("samples", "3"));
const SOURCE = flag("source", "calibration");

/** USD per million tokens. Published rates; update when a provider reprices. */
interface Rates {
  input: number;
  output: number;
  cached: number;
}

interface Contender {
  label: string;
  /** Environment applied for this contender's calls. */
  env: Record<string, string | undefined>;
  /** The key that must be present, or the contender is skipped. */
  requires: string;
  rates: Rates;
}

const USD_INR = 88;

const CONTENDERS: Contender[] = [
  {
    label: "Gemini 3.6 Flash",
    requires: "GEMINI_API_KEY",
    env: { AI_PROVIDER: "gemini", OPENAI_BASE_URL: undefined },
    rates: { input: 0.75, output: 3.75, cached: 0.1875 },
  },
  {
    label: "Kimi K3",
    requires: "MOONSHOT_API_KEY",
    env: {
      AI_PROVIDER: "openai",
      OPENAI_BASE_URL: "https://api.moonshot.ai/v1",
      OPENAI_API_KEY: process.env.MOONSHOT_API_KEY,
      OPENAI_MODEL: process.env.MOONSHOT_MODEL || "kimi-k3",
    },
    rates: { input: 3.0, output: 15.0, cached: 0.3 },
  },
];

// ---------------------------------------------------------------------------
// The calibration set: one case, three answers, known order.
// ---------------------------------------------------------------------------

const CALIBRATION_CASE = {
  title: "A dark-store chain whose contribution margin has gone negative",
  domain: "operations" as const,
  difficulty: "medium" as const,
  scenario:
    "A quick-commerce company runs 40 dark stores in three cities. Average order value is Rs 420 and gross margin on goods is 22%. Delivery cost is Rs 62 an order. Each store costs Rs 9 lakh a month to run and serves an average of 1,100 orders a day. Order volume has grown 18% year on year. Contribution margin per order turned negative two quarters ago and management is considering raising the free-delivery threshold from Rs 199 to Rs 349.",
  instructions:
    "Diagnose why contribution margin is negative and recommend what to do. Use the figures given.",
  supporting_data: {},
  expected_framework:
    "Contribution per order is gross margin minus delivery cost: 22% of 420 is Rs 92.40, less Rs 62, leaves Rs 30.40 before store costs. Store cost per order is 9,00,000 / (1,100 x 30) = roughly Rs 27. That leaves about Rs 3 an order, so the business is at breakeven per order, not comfortably negative — which means the stated negative contribution implies either lower AOV than average on delivered orders or higher delivery cost on small baskets. Raising the threshold pushes basket size up but suppresses order frequency, and the elasticity is the crux.",
  model_answer: null,
};

const CALIBRATION_RUBRIC = {
  criteria: {
    structure: 25,
    analysis: 35,
    recommendation: 25,
    communication: 15,
  } as RubricCriteria,
  descriptors: {
    structure: "Breaks the problem into the components that drive contribution before analysing any of them.",
    analysis: "Computes contribution per order from the figures given and identifies which term is the problem.",
    recommendation: "Commits to an action, quantifies its effect, and names the risk.",
    communication: "Clear, ordered, conclusion-first.",
  },
  max_score: 100,
};

/** Ordered strongest to weakest. The grader's job is to reproduce this order. */
const CALIBRATION_ANSWERS: { label: string; expectedRank: number; answer: string }[] = [
  {
    label: "strong",
    expectedRank: 1,
    answer: `Contribution per order is negative because delivery cost is consuming two-thirds of gross profit before any store cost is allocated.

Working it through: gross profit per order is 22% of Rs 420 = Rs 92.40. Delivery at Rs 62 leaves Rs 30.40. Store cost per order is Rs 9,00,000 / (1,100 x 30 days) = Rs 27.27. That leaves Rs 3.13 per order — effectively breakeven, not the loss management describes. The gap tells me the average is hiding the problem: the orders losing money are small baskets below the Rs 199 threshold, where gross profit falls but the Rs 62 delivery cost does not.

So the problem is not the average order, it is the distribution of orders. Before changing the threshold I would want the contribution curve by basket size.

Recommendation: raise the threshold, but to Rs 249 rather than Rs 349, and pair it with a small-basket delivery fee rather than a blanket rule. At Rs 349 the threshold is 83% above current AOV, which will suppress frequency in a business whose only real growth is 18% volume — and frequency is what keeps a dark store's fixed cost amortised. The risk is that basket-building behaviour does not materialise and orders simply fall; I would test in one city for six weeks and watch orders per customer per month, not AOV, because AOV will rise mechanically whatever happens.`,
  },
  {
    label: "medium",
    expectedRank: 2,
    answer: `The contribution margin is negative because costs per order are higher than the margin earned per order.

Gross margin is 22% of Rs 420, which is about Rs 92. Delivery costs Rs 62. So the company keeps about Rs 30 per order. Store costs are Rs 9 lakh a month which is a lot when spread over the orders, and that pushes the number negative.

The main issue is that delivery is expensive relative to the basket size. Quick commerce has this problem generally because customers order small quantities frequently.

I would raise the free delivery threshold as management is considering. Rs 349 would push customers to buy more per order, which spreads the delivery cost over more gross margin. There is a risk that some customers order less often or switch to a competitor, so the company should watch order volumes after the change and be ready to adjust. They could also look at reducing delivery cost by batching orders together.`,
  },
  {
    label: "weak",
    expectedRank: 3,
    answer: `The company is losing money on every order which is a serious problem for the business. Quick commerce is a very competitive industry with thin margins and many players fighting for market share.

There are several issues here. Costs are too high and the margin is too low. The delivery cost is a big expense and the stores also cost a lot to run every month. Growth of 18% is good but growth alone does not fix profitability.

My recommendation is that the company should raise the free delivery threshold to Rs 349 as they are considering. This will improve the economics. They should also focus on operational efficiency, negotiate better terms with suppliers, and consider increasing prices where possible. Marketing should target higher value customers who place larger orders.

Overall the company needs to balance growth with profitability and make sure that unit economics work before scaling further.`,
  },
];

// ---------------------------------------------------------------------------

interface Run {
  contender: string;
  sample: string;
  expectedRank: number;
  score: number;
  maxScore: number;
  percentage: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costInr: number;
  ms: number;
  aiLikelihood: number | null;
  error?: string;
}

function costOf(r: Run["inputTokens"], o: number, cached: number, rates: Rates) {
  // Cached input is billed at the discounted rate; the provider reports it
  // inside the input count, so it is subtracted before pricing the remainder.
  const fresh = Math.max(0, r - cached);
  return (
    ((fresh * rates.input + cached * rates.cached + o * rates.output) / 1e6) *
    USD_INR
  );
}

/** Applies a contender's environment, restoring whatever was there before. */
async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadSamples() {
  if (SOURCE !== "submissions") {
    return CALIBRATION_ANSWERS.slice(0, SAMPLE_COUNT).map((a) => ({
      label: a.label,
      expectedRank: a.expectedRank,
      answer: a.answer,
      caseData: CALIBRATION_CASE,
      rubric: CALIBRATION_RUBRIC,
    }));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase credentials are required for --source=submissions");
  const admin = createClient<Database>(url, key);

  const { data } = await admin
    .from("submissions")
    .select("id, answer, cases(title, domain, difficulty, scenario, instructions, supporting_data, expected_framework, model_answer, rubrics(criteria, descriptors, max_score))")
    .order("created_at", { ascending: false })
    .limit(SAMPLE_COUNT * 3);

  const usable = (data ?? []).filter(
    (row) => row.answer && row.answer.length > 800 && row.cases,
  );

  if (usable.length === 0) {
    throw new Error(
      "No substantial graded submissions found. Run without --source=submissions to use the calibration set.",
    );
  }

  return usable.slice(0, SAMPLE_COUNT).map((row, i) => {
    const kase = Array.isArray(row.cases) ? row.cases[0] : row.cases;
    const rubric = Array.isArray(kase.rubrics) ? kase.rubrics[0] : kase.rubrics;
    return {
      label: `submission ${i + 1}`,
      // Real work has no known correct order, so ordering analysis is skipped.
      expectedRank: 0,
      answer: row.answer as string,
      caseData: kase as never,
      rubric: rubric as never,
    };
  });
}

async function main() {
  const active = CONTENDERS.filter((c) => {
    const present = Boolean(process.env[c.requires]);
    if (!present) {
      console.log(`skipping ${c.label} — ${c.requires} is not set`);
    }
    return present;
  });

  if (active.length === 0) {
    console.error("\nNo provider keys set. Nothing to run.");
    process.exit(1);
  }

  if (active.length === 1) {
    // Still worth running: one provider against the calibration set checks
    // that the grader you already have reproduces the known order, which is
    // the baseline any challenger has to beat.
    console.log(
      `\nOnly ${active[0].label} has a key set, so this is a baseline run rather than a comparison.` +
        "\nFor Kimi, get a key at platform.moonshot.ai and put MOONSHOT_API_KEY in .env.local.",
    );
  }

  const samples = await loadSamples();
  console.log(
    `\nGrading ${samples.length} answer(s) through ${active.length} providers (${SOURCE} set).\n`,
  );

  const runs: Run[] = [];

  for (const contender of active) {
    for (const sample of samples) {
      process.stdout.write(`  ${contender.label} / ${sample.label} … `);
      const started = Date.now();
      try {
        const result = await withEnv(contender.env, () =>
          evaluateSubmission(sample.caseData, sample.rubric, sample.answer),
        );
        const ms = Date.now() - started;
        const costInr = costOf(
          result.inputTokens,
          result.outputTokens,
          result.cachedTokens,
          contender.rates,
        );
        runs.push({
          contender: contender.label,
          sample: sample.label,
          expectedRank: sample.expectedRank,
          score: result.totalScore,
          maxScore: result.maxScore,
          percentage: result.percentage,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cachedTokens: result.cachedTokens,
          costInr,
          ms,
          aiLikelihood: result.aiLikelihood,
        });
        console.log(`${result.totalScore}/${result.maxScore}  ${(ms / 1000).toFixed(1)}s  Rs ${costInr.toFixed(3)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`FAILED — ${message}`);
        runs.push({
          contender: contender.label,
          sample: sample.label,
          expectedRank: sample.expectedRank,
          score: 0, maxScore: 0, percentage: 0,
          inputTokens: 0, outputTokens: 0, cachedTokens: 0,
          costInr: 0, ms: Date.now() - started, aiLikelihood: null,
          error: message,
        });
      }
      // Gemini's free tier allows 5 requests a minute. Pace to stay inside it.
      await sleep(13_000);
    }
  }

  report(runs, active, samples);
}

function report(runs: Run[], active: Contender[], samples: { label: string; expectedRank: number }[]) {
  const ok = runs.filter((r) => !r.error);
  console.log("\n" + "=".repeat(74));
  console.log("SCORES — the same answer, graded by each provider");
  console.log("=".repeat(74));

  const header = ["answer".padEnd(14), ...active.map((c) => c.label.padStart(18))].join("");
  console.log(header);
  for (const sample of samples) {
    const cells = active.map((c) => {
      const run = ok.find((r) => r.contender === c.label && r.sample === sample.label);
      return (run ? `${run.score}/${run.maxScore}` : "—").padStart(18);
    });
    console.log(sample.label.padEnd(14) + cells.join(""));
  }

  // ---- ordering, the part that decides usability --------------------------
  if (samples.every((s) => s.expectedRank > 0)) {
    console.log("\n" + "=".repeat(74));
    console.log("ORDERING — does the grader rank the answers correctly?");
    console.log("=".repeat(74));
    const expected = [...samples].sort((a, b) => a.expectedRank - b.expectedRank).map((s) => s.label);
    for (const c of active) {
      const mine = ok
        .filter((r) => r.contender === c.label)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.sample);
      const correct = mine.length === expected.length && mine.every((m, i) => m === expected[i]);
      console.log(
        `  ${c.label.padEnd(20)} ${mine.join(" > ") || "no runs"}   ${correct ? "correct" : "DOES NOT MATCH " + expected.join(" > ")}`,
      );
    }
    console.log(
      "\n  A grader may be harsh or generous and still be useful. One that reorders\n  a strong answer below a weak one is not usable at any price.",
    );
  }

  // ---- spread between graders ---------------------------------------------
  if (active.length === 2) {
    const [a, b] = active;
    const diffs = samples
      .map((s) => {
        const ra = ok.find((r) => r.contender === a.label && r.sample === s.label);
        const rb = ok.find((r) => r.contender === b.label && r.sample === s.label);
        return ra && rb ? rb.percentage - ra.percentage : null;
      })
      .filter((d): d is number => d !== null);

    if (diffs.length > 0) {
      const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
      const spread = Math.max(...diffs) - Math.min(...diffs);
      console.log("\n" + "=".repeat(74));
      console.log("AGREEMENT");
      console.log("=".repeat(74));
      console.log(`  ${b.label} scores ${mean >= 0 ? "+" : ""}${mean.toFixed(1)} percentage points vs ${a.label} on average.`);
      console.log(`  Spread of that difference across answers: ${spread.toFixed(1)} points.`);
      console.log(
        "\n  A consistent offset is fine — rescale the rubric and they are interchangeable.\n  A wide spread means they disagree per answer, which no rescale fixes.",
      );
    }
  }

  // ---- what it costs -------------------------------------------------------
  console.log("\n" + "=".repeat(74));
  console.log("COST AND SPEED — from measured tokens, not assumed splits");
  console.log("=".repeat(74));
  console.log(
    "provider".padEnd(20) + "in".padStart(8) + "out".padStart(8) +
    "cached".padStart(9) + "Rs/grade".padStart(11) + "median s".padStart(11) +
    "Rs/1000 students".padStart(19),
  );
  for (const c of active) {
    const mine = ok.filter((r) => r.contender === c.label);
    if (mine.length === 0) continue;
    const avg = (f: (r: Run) => number) => mine.reduce((s, r) => s + f(r), 0) / mine.length;
    const times = mine.map((r) => r.ms).sort((x, y) => x - y);
    const median = times[Math.floor(times.length / 2)] / 1000;
    const perGrade = avg((r) => r.costInr);
    // 40 graded answers a year is the realistic engaged student from the
    // cost model; multiply out to a 1,000-seat campus.
    const perCampus = perGrade * 40 * 1000;
    console.log(
      c.label.padEnd(20) +
        Math.round(avg((r) => r.inputTokens)).toString().padStart(8) +
        Math.round(avg((r) => r.outputTokens)).toString().padStart(8) +
        Math.round(avg((r) => r.cachedTokens)).toString().padStart(9) +
        perGrade.toFixed(3).padStart(11) +
        median.toFixed(1).padStart(11) +
        perCampus.toLocaleString("en-IN", { maximumFractionDigits: 0 }).padStart(19),
    );
  }

  const failures = runs.filter((r) => r.error);
  if (failures.length > 0) {
    console.log(`\n${failures.length} call(s) failed:`);
    for (const f of failures) console.log(`  ${f.contender} / ${f.sample}: ${f.error}`);
  }
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
