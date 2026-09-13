/**
 * Seeds group discussion topics.
 *
 *   npm run seed:gd
 *
 * Idempotent on title. A GD topic carries no rubric, because the rubric marks
 * how you participated rather than what the topic was and is therefore the
 * same for every discussion.
 *
 * The mix is deliberate. Indian GD panels draw from three pots — abstract
 * prompts that test whether you can build structure from nothing, business and
 * economy topics, and social or policy questions where the point is to
 * disagree well. A bank of only business topics would train students for a
 * third of what they will actually face.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";

config({ path: ".env.local" });
config({ path: ".env" });

type Topic = {
  title: string;
  prompt: string;
  category: "abstract" | "business" | "social" | "case_based";
  difficulty: "easy" | "medium" | "hard";
};

const TOPICS: Topic[] = [
  // ---- business and economy ----------------------------------------------
  {
    title: "Should Indian startups prioritise profitability over growth?",
    prompt: "Consider what changed after 2022, what investors now reward, and whether the answer differs by sector.",
    category: "business",
    difficulty: "medium",
  },
  {
    title: "Is quick commerce good for the Indian retail ecosystem?",
    prompt: "Think about kirana stores, dark-store economics, consumer behaviour and employment.",
    category: "business",
    difficulty: "medium",
  },
  {
    title: "Should India cap foreign ownership in critical technology sectors?",
    prompt: "Weigh capital access and technology transfer against strategic control.",
    category: "business",
    difficulty: "hard",
  },
  {
    title: "Has the MBA lost its value in the age of specialised skills?",
    prompt: "You are the interested party here. Argue past that.",
    category: "business",
    difficulty: "easy",
  },
  {
    title: "Should companies be allowed to fire employees purely for cost reasons?",
    prompt: "Consider labour law, competitiveness, and what a firm owes people it hired.",
    category: "business",
    difficulty: "medium",
  },
  {
    title: "Is the four-day work week viable in Indian services industries?",
    prompt: "Think about client coverage, utilisation-based billing, and what the evidence from trials shows.",
    category: "business",
    difficulty: "medium",
  },
  {
    title: "Are Indian unicorns overvalued?",
    prompt: "Distinguish valuation from business quality, and say what evidence would settle it.",
    category: "business",
    difficulty: "hard",
  },
  {
    title: "Should India push manufacturing or double down on services?",
    prompt: "Consider employment intensity, global demand, infrastructure and existing advantage.",
    category: "business",
    difficulty: "hard",
  },

  // ---- abstract -----------------------------------------------------------
  {
    title: "Blue",
    prompt: "A classic abstract GD prompt. There is no right direction — the panel is watching whether you can impose structure on nothing and take the group somewhere.",
    category: "abstract",
    difficulty: "hard",
  },
  {
    title: "The best decisions are made with incomplete information",
    prompt: "Argue it, or argue against it. Examples matter more than definitions here.",
    category: "abstract",
    difficulty: "medium",
  },
  {
    title: "Failure teaches more than success",
    prompt: "Resist the comfortable consensus. A GD where everyone agrees scores everyone poorly.",
    category: "abstract",
    difficulty: "easy",
  },
  {
    title: "Rules are meant to be broken",
    prompt: "Test the claim rather than restating it. Which rules, broken by whom, at what cost?",
    category: "abstract",
    difficulty: "medium",
  },

  // ---- social and policy --------------------------------------------------
  {
    title: "Should AI-generated content be labelled by law?",
    prompt: "Consider enforceability, who bears the cost, and what problem labelling actually solves.",
    category: "social",
    difficulty: "medium",
  },
  {
    title: "Is remote work widening inequality in India?",
    prompt: "Think about who can work remotely, infrastructure access, and effects on smaller cities.",
    category: "social",
    difficulty: "medium",
  },
  {
    title: "Should higher education be free in India?",
    prompt: "Consider fiscal cost, who currently benefits from subsidy, and alternatives like income-contingent loans.",
    category: "social",
    difficulty: "hard",
  },
  {
    title: "Social media has done more harm than good to public discourse",
    prompt: "A topic where consensus is easy and worthless. The marks are in the disagreement.",
    category: "social",
    difficulty: "easy",
  },
  {
    title: "Should gig platforms be required to provide social security?",
    prompt: "Weigh worker protection against flexibility and platform economics, and say who pays.",
    category: "social",
    difficulty: "medium",
  },

  // ---- case-based ---------------------------------------------------------
  {
    title: "A city wants to ban private cars from its centre. Should it?",
    prompt: "You are advising the municipal commissioner. Consider retail impact, public transport readiness, enforcement and phasing.",
    category: "case_based",
    difficulty: "hard",
  },
  {
    title: "An FMCG brand's biggest product is found to be losing share to a cheaper rival. What should it do?",
    prompt: "The group must reach a recommendation, not merely list options. Someone needs to force the close.",
    category: "case_based",
    difficulty: "medium",
  },
  {
    title: "A hospital chain must choose between opening in a metro or in three Tier 3 towns. Which?",
    prompt: "Consider demand, talent availability, capital efficiency and payer mix. Commit as a group.",
    category: "case_based",
    difficulty: "hard",
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let inserted = 0;
  let updated = 0;

  for (const topic of TOPICS) {
    const { data: existing } = await admin
      .from("gd_topics")
      .select("id")
      .eq("title", topic.title)
      .maybeSingle();

    if (existing) {
      const { error } = await admin.from("gd_topics").update(topic).eq("id", existing.id);
      if (error) throw new Error(error.message);
      updated++;
    } else {
      const { error } = await admin.from("gd_topics").insert(topic);
      if (error) throw new Error(error.message);
      inserted++;
    }
  }

  const byCategory = TOPICS.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1;
    return acc;
  }, {});
  for (const [c, n] of Object.entries(byCategory)) {
    console.log(`  ${c.padEnd(12)} ${n}`);
  }
  console.log(`\nInserted ${inserted}, updated ${updated}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
