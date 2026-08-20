/**
 * Seeds market-sizing and mental-math drills (spec §6d).
 *
 *   npm run seed:drills
 *
 * Each drill is a `cases` row with format='drill' plus a set of numeric
 * questions. Idempotent: upserts on slug and replaces that drill's questions.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";

config({ path: ".env.local" });
config({ path: ".env" });

type Q = {
  prompt: string;
  expected: number;
  tolerance_pct?: number;
  unit?: string;
  explanation?: string;
};

type Drill = {
  slug: string;
  title: string;
  domain: "finance" | "consulting" | "product_management";
  difficulty: "easy" | "medium" | "hard";
  minutes: number;
  scenario: string;
  questions: Q[];
};

const DRILLS: Drill[] = [
  {
    slug: "drill-market-sizing-india",
    title: "Market Sizing Sprint: India Consumer",
    domain: "consulting",
    difficulty: "medium",
    minutes: 10,
    scenario:
      "Six sizing questions against the clock. Round aggressively — you are being marked within a ±10% band, not on precision. State assumptions in your head and move.",
    questions: [
      {
        prompt:
          "India has roughly 1.4bn people and about 280m households. If 25% of households own a washing machine and machines last 8 years, how many replacement units are sold per year (in millions)?",
        expected: 8.75,
        tolerance_pct: 12,
        unit: "m units",
        explanation: "280m × 25% = 70m installed base ÷ 8-year life ≈ 8.75m/yr.",
      },
      {
        prompt:
          "A café sells 220 cups a day at ₹180. What is annual revenue in ₹ crore? (365 days)",
        expected: 1.45,
        tolerance_pct: 10,
        unit: "₹ Cr",
        explanation: "220 × 180 = ₹39,600/day × 365 ≈ ₹1.45 Cr.",
      },
      {
        prompt:
          "If a SaaS business has 4,000 customers, 2% monthly churn, what is the average customer lifetime in months?",
        expected: 50,
        tolerance_pct: 5,
        unit: "months",
        explanation: "Lifetime = 1 ÷ churn = 1 ÷ 0.02 = 50 months.",
      },
      {
        prompt:
          "A city of 12m people takes 1.8m metro rides per day. At ₹30 average fare, what is daily fare revenue in ₹ crore?",
        expected: 5.4,
        tolerance_pct: 8,
        unit: "₹ Cr",
        explanation: "1.8m × ₹30 = ₹5.4 Cr per day.",
      },
      {
        prompt:
          "A retailer holds ₹60 Cr of inventory and has ₹480 Cr of COGS. What is inventory turnover (times per year)?",
        expected: 8,
        tolerance_pct: 5,
        unit: "×",
        explanation: "480 ÷ 60 = 8 turns.",
      },
      {
        prompt:
          "A product has 500k MAU, 30% of whom are daily actives. What is DAU in thousands?",
        expected: 150,
        tolerance_pct: 5,
        unit: "k",
        explanation: "500k × 30% = 150k DAU.",
      },
    ],
  },
  {
    slug: "drill-finance-mental-math",
    title: "Finance Mental Math Sprint",
    domain: "finance",
    difficulty: "medium",
    minutes: 10,
    scenario:
      "Six quick valuation and returns calculations. No spreadsheet — these are the numbers you are expected to produce in the room.",
    questions: [
      {
        prompt:
          "A company earns ₹40 Cr EBITDA. Comparables trade at 12× EV/EBITDA. What is implied enterprise value in ₹ crore?",
        expected: 480,
        tolerance_pct: 5,
        unit: "₹ Cr",
        explanation: "40 × 12 = ₹480 Cr.",
      },
      {
        prompt:
          "That company has ₹120 Cr net debt. What is implied equity value in ₹ crore?",
        expected: 360,
        tolerance_pct: 5,
        unit: "₹ Cr",
        explanation: "EV 480 − net debt 120 = ₹360 Cr equity.",
      },
      {
        prompt:
          "An investor buys at ₹100 Cr and exits at ₹300 Cr after 5 years. What is the MOIC?",
        expected: 3,
        tolerance_pct: 3,
        unit: "×",
        explanation: "300 ÷ 100 = 3.0×.",
      },
      {
        prompt:
          "Approximate the IRR for a 3.0× return over 5 years, as a percentage. (Rule of thumb: 3× over 5 years ≈ 25%)",
        expected: 24.6,
        tolerance_pct: 12,
        unit: "%",
        explanation: "3^(1/5) − 1 = 0.246, so ≈ 24.6%.",
      },
      {
        prompt:
          "A business has ₹14 Cr cash and burns ₹1.2 Cr per month. What is runway in months?",
        expected: 11.7,
        tolerance_pct: 8,
        unit: "months",
        explanation: "14 ÷ 1.2 ≈ 11.7 months.",
      },
      {
        prompt:
          "Revenue grows from ₹50 Cr to ₹86 Cr in 3 years. What is the CAGR in percent?",
        expected: 19.8,
        tolerance_pct: 10,
        unit: "%",
        explanation: "(86/50)^(1/3) − 1 ≈ 0.198, so ≈ 19.8%.",
      },
    ],
  },
  {
    slug: "drill-pm-metrics",
    title: "PM Metrics Sprint",
    domain: "product_management",
    difficulty: "easy",
    minutes: 8,
    scenario:
      "Six product-metric calculations. These are the ratios a PM is expected to compute without reaching for a dashboard.",
    questions: [
      {
        prompt:
          "An app has 2m installs and 400k monthly actives. What is the MAU/install ratio as a percentage?",
        expected: 20,
        tolerance_pct: 5,
        unit: "%",
        explanation: "400k ÷ 2m = 20%.",
      },
      {
        prompt:
          "Of 400k MAU, 120k are daily actives. What is the DAU/MAU stickiness ratio in percent?",
        expected: 30,
        tolerance_pct: 5,
        unit: "%",
        explanation: "120k ÷ 400k = 30%.",
      },
      {
        prompt:
          "A funnel converts 40% → 50% → 25% across three steps. What is end-to-end conversion in percent?",
        expected: 5,
        tolerance_pct: 5,
        unit: "%",
        explanation: "0.40 × 0.50 × 0.25 = 0.05 = 5%.",
      },
      {
        prompt:
          "You need 200 conversions from a 4% converting page. How many visitors do you need (in thousands)?",
        expected: 5,
        tolerance_pct: 5,
        unit: "k visitors",
        explanation: "200 ÷ 0.04 = 5,000 visitors.",
      },
      {
        prompt:
          "ARPU is ₹250/month and monthly churn is 5%. What is LTV in rupees?",
        expected: 5000,
        tolerance_pct: 5,
        unit: "₹",
        explanation: "250 ÷ 0.05 = ₹5,000.",
      },
      {
        prompt:
          "CAC is ₹1,250 and LTV is ₹5,000. What is the LTV/CAC ratio?",
        expected: 4,
        tolerance_pct: 5,
        unit: "×",
        explanation: "5000 ÷ 1250 = 4.0×.",
      },
    ],
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const drill of DRILLS) {
    const { data: row, error } = await supabase
      .from("cases")
      .upsert(
        {
          slug: drill.slug,
          title: drill.title,
          domain: drill.domain,
          difficulty: drill.difficulty,
          format: "drill",
          estimated_minutes: drill.minutes,
          scenario: drill.scenario,
          instructions:
            "Answer each question with a number. You are graded within a tolerance band, so round sensibly and keep moving.",
          supporting_data: {},
          tags: ["drill", "mental-math"],
          is_published: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    if (error || !row) {
      console.error(`${drill.slug}: ${error?.message}`);
      process.exit(1);
    }

    // Rebuild questions so a re-run cannot leave stale ones behind.
    await supabase.from("drill_questions").delete().eq("case_id", row.id);

    const { error: qError } = await supabase.from("drill_questions").insert(
      drill.questions.map((q, index) => ({
        case_id: row.id,
        position: index + 1,
        prompt: q.prompt,
        expected: q.expected,
        tolerance_pct: q.tolerance_pct ?? 5,
        unit: q.unit ?? null,
        explanation: q.explanation ?? null,
      })),
    );

    if (qError) {
      console.error(`${drill.slug} questions: ${qError.message}`);
      process.exit(1);
    }

    console.log(`  ${drill.slug}: ${drill.questions.length} questions`);
  }

  console.log(`\nDone. ${DRILLS.length} drills seeded.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
