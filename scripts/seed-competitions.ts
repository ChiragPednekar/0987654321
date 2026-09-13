/**
 * Seeds case competitions.
 *
 *   npm run seed:competitions
 *
 * Deadlines are set relative to the seed run so a freshly seeded instance has
 * one competition open, one closed with results out, and one not yet open —
 * which is the only way to see the embargo and the closed state working
 * without waiting a week.
 *
 * Idempotent on slug.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { CompetitionRow, Database } from "../src/lib/types/database";

config({ path: ".env.local" });
config({ path: ".env" });

const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days: number) => new Date(now + days * day).toISOString();

const RUBRIC = {
  criteria: {
    problem_framing: 20,
    analysis: 30,
    recommendation: 25,
    feasibility: 15,
    communication: 10,
  },
  descriptors: {
    problem_framing:
      "Identifies the real question rather than restating the brief, and says what is out of scope.",
    analysis:
      "Uses the numbers given, computes what they imply, and reasons from stated assumptions.",
    recommendation:
      "Commits to a specific course of action with a sequence and an owner, not a list of options.",
    feasibility:
      "Engages honestly with cost, timeline, capability and what could go wrong.",
    communication:
      "Reads like something a jury could act on. Structured, concise, no padding.",
  },
  max_score: 100,
};

/**
 * Typed explicitly rather than inferred. Two entries have `results_at: null`
 * and one has a string, so inference widens the array to a union the upsert
 * cannot accept — and the failure only shows at the call site, a hundred lines
 * from the cause.
 */
const COMPETITIONS: Omit<CompetitionRow, "id" | "created_at" | "is_published">[] = [
  {
    slug: "kirana-next-hundred-million",
    title: "The next hundred million kirana orders",
    sponsor: "CaseCode Open",
    brief:
      "A quick-commerce platform has 8 million monthly transacting users across 14 cities and is growing 40% year on year, but is losing ₹34 on every order after accounting for delivery and discounts. It has ₹900 crore of runway at the current burn.\n\nThe board has rejected two proposals already: raising delivery fees (the growth team says it will cost 20% of orders) and cutting the catalogue to high-margin SKUs (the category team says it destroys the value proposition).\n\nA third option is on the table: partnering with existing kirana stores as fulfilment nodes rather than operating dark stores. There are roughly 13 million kirana stores in India. Nobody at the company has modelled it properly.",
    instructions:
      "Advise the board. Recommend whether to pursue the kirana partnership model, and if so how. Quantify the unit economics of your recommendation against the current model, name the two assumptions it depends on most, and set out a 12-month sequence with what has to be true at each stage to continue.",
    expected_framework:
      "The strongest entries model the per-order economics explicitly — the dark-store model's fixed cost per order against a partnership model's variable margin share — rather than arguing qualitatively. Note the trade: kiranas remove rent and inventory risk but introduce assortment inconsistency and a harder service promise. Weak entries treat 13 million stores as a market size rather than asking how many are within a viable delivery radius of demand.",
    min_team_size: 2,
    max_team_size: 4,
    opens_at: at(-7),
    closes_at: at(14),
    results_at: null,
    ...RUBRIC,
  },
  {
    slug: "ev-two-wheeler-service-network",
    title: "Building a service network you cannot afford",
    sponsor: "CaseCode Open",
    brief:
      "An electric two-wheeler manufacturer sells 22,000 units a month across 60 cities and has a service presence in 18 of them. Warranty claims take an average of 11 days to close. Net promoter score has fallen from 54 to 19 in eighteen months, and the fall correlates almost exactly with distance from the nearest service centre.\n\nA company-owned service centre costs ₹1.1 crore to set up and ₹18 lakh a month to run. The CFO will approve ₹80 crore of capital in total. Covering all 60 cities company-owned would cost ₹66 crore of capital and ₹1,080 crore a year to operate, which is not possible.",
    instructions:
      "Recommend how to give buyers in all 60 cities a credible service promise within the capital available. Quantify your proposal, state what service level it actually delivers, and be explicit about what you are choosing not to do.",
    expected_framework:
      "The constraint makes company-owned coverage arithmetically impossible, so the entry must find another model: authorised third-party workshops, mobile service vans, a hub-and-spoke arrangement, or a parts-and-training franchise. The strongest entries pick one, cost it, and state the service level honestly rather than promising parity. Entries that recommend a smaller company-owned network without addressing the other 42 cities have not answered the question.",
    min_team_size: 2,
    max_team_size: 4,
    opens_at: at(-30),
    closes_at: at(-3),
    results_at: at(-1),
    ...RUBRIC,
  },
  {
    slug: "campus-placement-reform",
    title: "Redesigning campus placements",
    sponsor: "CaseCode Open",
    brief:
      "A top-20 Indian business school places 94% of its cohort within two weeks, and has done for a decade. Its problem is what happens next: 38% of graduates leave their first employer within eighteen months, against a peer-school average of 22%. Recruiters have started asking for a smaller allocation.\n\nThe placement process compresses 180 students and 60 recruiters into five days, ranked by day and slot. Students accept the first offer they receive; the process forbids declining.",
    instructions:
      "Redesign the process. Your recommendation must improve eighteen-month retention without reducing the placement rate, and must be acceptable to recruiters who currently benefit from the compressed format. Say who loses under your design and why they will tolerate it.",
    expected_framework:
      "The accept-the-first-offer rule is the mechanism producing the mismatch, and the strongest entries identify it rather than proposing more counselling. The real difficulty is that the compressed format exists because recruiters want it, so any redesign has to be traded against something they value — earlier access, better information, guaranteed slots. Entries that only consider the student side have not engaged with why the system is as it is.",
    min_team_size: 3,
    max_team_size: 4,
    opens_at: at(3),
    closes_at: at(24),
    results_at: null,
    ...RUBRIC,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const problems: string[] = [];
  for (const c of COMPETITIONS) {
    const total = Object.values(c.criteria).reduce((a, b) => a + b, 0);
    if (total !== c.max_score) {
      problems.push(`${c.slug}: criteria total ${total}, max_score ${c.max_score}`);
    }
    if (new Date(c.closes_at) <= new Date(c.opens_at)) {
      problems.push(`${c.slug}: closes before it opens`);
    }
    if (c.results_at && new Date(c.results_at) < new Date(c.closes_at)) {
      problems.push(`${c.slug}: results published before the deadline`);
    }
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const c of COMPETITIONS) {
    const { error } = await admin.from("competitions").upsert(c, { onConflict: "slug" });
    if (error) {
      console.error(`${c.slug}: ${error.message}`);
      process.exit(1);
    }
    const state =
      new Date(c.opens_at) > new Date()
        ? "not open yet"
        : new Date(c.closes_at) <= new Date()
          ? c.results_at
            ? "closed, results out"
            : "closed, results embargoed"
          : "open";
    console.log(`  ✓ ${c.slug.padEnd(34)} ${state}`);
  }
  console.log(`\nSeeded ${COMPETITIONS.length} competitions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
