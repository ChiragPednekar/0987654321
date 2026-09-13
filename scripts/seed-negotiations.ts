/**
 * Seeds negotiation exercises.
 *
 *   npm run seed:negotiations
 *
 * Every case is built so that the two sides rank the issues differently. That
 * is the whole design: if both wanted the same thing in the same order there
 * would be nothing to trade and the exercise would be haggling over one
 * number. The payoff tables are checked below to make sure each case actually
 * has value waiting to be found.
 *
 * Idempotent on slug.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { maxJointValue, type NegotiationSetup } from "../src/lib/negotiation/engine";

config({ path: ".env.local" });
config({ path: ".env" });

type Case = {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  shared_brief: string;
  student_role: string;
  counterparty_role: string;
  student_brief: string;
  counterparty_brief: string;
  issues: { key: string; label: string; options: { key: string; label: string }[] }[];
  student_payoffs: Record<string, Record<string, number>>;
  counterparty_payoffs: Record<string, Record<string, number>>;
  student_batna: number;
  counterparty_batna: number;
};

const CASES: Case[] = [
  {
    slug: "supplier-contract-renewal",
    title: "Renewing a components contract",
    difficulty: "medium",
    shared_brief:
      "Vardhan Industries has bought moulded components from Kesari Polymers for four years. The contract is up for renewal and both sides want to continue, but on better terms than last time. Four things are open: unit price, payment terms, a volume commitment, and who holds buffer stock.",
    student_role: "Procurement lead at Vardhan Industries (the buyer)",
    counterparty_role: "Sales head at Kesari Polymers (the seller)",
    student_brief:
      "Your CFO has told you to get the landed cost down — price is what your performance is judged on this year. Your plant has space, so holding buffer stock yourself costs you little. You would prefer not to commit to volume, but it is not what you will be measured on.",
    counterparty_brief:
      "You are the sales head at Kesari Polymers. Your factory has just been expanded and the board is judging you on capacity utilisation, so a firm volume commitment is worth more to you than anything else in this deal — it lets you plan production and stop chasing spot orders. You can be flexible on price if you get it.\n\nYour cash position is comfortable, so payment terms are a secondary concern, though sooner is better. Holding buffer stock is genuinely expensive for you: your warehouse is full and you would have to rent space.\n\nDo not volunteer that the volume commitment is what you care about. If the buyer asks what matters most to you, you may say that certainty of demand helps you, but make them trade for it.",
    issues: [
      {
        key: "price",
        label: "Unit price",
        options: [
          { key: "p88", label: "₹88" },
          { key: "p94", label: "₹94" },
          { key: "p100", label: "₹100" },
        ],
      },
      {
        key: "terms",
        label: "Payment terms",
        options: [
          { key: "d30", label: "30 days" },
          { key: "d60", label: "60 days" },
          { key: "d90", label: "90 days" },
        ],
      },
      {
        key: "volume",
        label: "Volume commitment",
        options: [
          { key: "none", label: "No commitment" },
          { key: "half", label: "60% of last year, committed" },
          { key: "full", label: "100% of last year, committed" },
        ],
      },
      {
        key: "buffer",
        label: "Who holds buffer stock",
        options: [
          { key: "buyer", label: "Vardhan holds it" },
          { key: "seller", label: "Kesari holds it" },
        ],
      },
    ],
    student_payoffs: {
      price: { p88: 36, p94: 22, p100: 6 },
      terms: { d30: 4, d60: 12, d90: 20 },
      volume: { none: 14, half: 9, full: 4 },
      buffer: { buyer: 6, seller: 12 },
    },
    counterparty_payoffs: {
      price: { p88: 8, p94: 18, p100: 28 },
      terms: { d30: 16, d60: 10, d90: 3 },
      volume: { none: 2, half: 20, full: 34 },
      buffer: { buyer: 16, seller: 2 },
    },
    student_batna: 40,
    counterparty_batna: 42,
  },
  {
    slug: "first-job-offer",
    title: "Negotiating your first offer",
    difficulty: "easy",
    shared_brief:
      "You have an offer from a mid-sized consulting firm. HR has asked you to come back with what it would take to sign. Four things are negotiable: base salary, joining bonus, the start date, and which office you are based in.",
    student_role: "The candidate",
    counterparty_role: "HR business partner at the firm",
    student_brief:
      "You want the money, but you also have a family reason to be in Pune rather than Gurgaon, and you would like six weeks before starting. You have one other offer that is slightly worse overall — real, but not one you want to use as a threat unless you have to.",
    counterparty_brief:
      "You are the HR business partner. Your salary bands are tight and going above the mid-point needs an approval you would rather not ask for, so base salary is where you are least flexible. A joining bonus comes from a different budget and is far easier for you to give.\n\nYou need bodies in Gurgaon — that is where the staffing gap is — so the office matters to you more than the candidate is likely to guess. A later start date is mildly inconvenient but survivable.\n\nBe warm and professional. Do not reveal that the joining bonus is cheap for you, and do not volunteer how badly you need Gurgaon. If the candidate asks directly what is easiest for you to move, you may say the bonus is more flexible than base.",
    issues: [
      {
        key: "base",
        label: "Base salary",
        options: [
          { key: "b18", label: "₹18 lakh" },
          { key: "b20", label: "₹20 lakh" },
          { key: "b22", label: "₹22 lakh" },
        ],
      },
      {
        key: "bonus",
        label: "Joining bonus",
        options: [
          { key: "none", label: "None" },
          { key: "two", label: "₹2 lakh" },
          { key: "four", label: "₹4 lakh" },
        ],
      },
      {
        key: "start",
        label: "Start date",
        options: [
          { key: "soon", label: "In 2 weeks" },
          { key: "six", label: "In 6 weeks" },
        ],
      },
      {
        key: "office",
        label: "Base office",
        options: [
          { key: "pune", label: "Pune" },
          { key: "gurgaon", label: "Gurgaon" },
        ],
      },
    ],
    student_payoffs: {
      base: { b18: 6, b20: 16, b22: 26 },
      bonus: { none: 2, two: 10, four: 18 },
      start: { soon: 3, six: 12 },
      office: { pune: 20, gurgaon: 4 },
    },
    counterparty_payoffs: {
      base: { b18: 28, b20: 16, b22: 4 },
      bonus: { none: 14, two: 10, four: 5 },
      start: { soon: 12, six: 6 },
      office: { pune: 3, gurgaon: 26 },
    },
    student_batna: 38,
    counterparty_batna: 40,
  },
  {
    slug: "distribution-partnership",
    title: "Entering a new state through a distributor",
    difficulty: "hard",
    shared_brief:
      "A packaged foods brand wants to enter Tamil Nadu and is talking to an established regional distributor. Four things are open: the distributor's margin, whether the territory is exclusive, who funds in-store promotion, and how long the initial term runs.",
    student_role: "National sales head at the brand",
    counterparty_role: "Owner of the regional distributor",
    student_brief:
      "Your board has approved the entry but not a large promotion budget, so funding in-store activity yourself would hurt. You are wary of exclusivity because it is hard to undo. Margin matters but you have some room. A long term is fine if the rest is right.",
    counterparty_brief:
      "You own the distributor. You have seen national brands enter, take your shelf relationships, and then appoint a second distributor two years later — so exclusivity and a long term are what actually protect you, and they matter far more to you than a point or two of margin.\n\nYou have your own promoter team already on payroll, so funding in-store promotion costs you much less than the brand probably assumes.\n\nYou are a shrewd, experienced negotiator. Open by pressing hard on margin, because that is what brands expect you to care about — but what you must not leave without is exclusivity and a term of at least three years. Do not explain why.",
    issues: [
      {
        key: "margin",
        label: "Distributor margin",
        options: [
          { key: "m8", label: "8%" },
          { key: "m11", label: "11%" },
          { key: "m14", label: "14%" },
        ],
      },
      {
        key: "exclusive",
        label: "Territory exclusivity",
        options: [
          { key: "no", label: "Non-exclusive" },
          { key: "yes", label: "Exclusive" },
        ],
      },
      {
        key: "promo",
        label: "In-store promotion funding",
        options: [
          { key: "brand", label: "Brand funds it" },
          { key: "split", label: "Split 50/50" },
          { key: "dist", label: "Distributor funds it" },
        ],
      },
      {
        key: "term",
        label: "Initial term",
        options: [
          { key: "one", label: "1 year" },
          { key: "three", label: "3 years" },
          { key: "five", label: "5 years" },
        ],
      },
    ],
    student_payoffs: {
      margin: { m8: 24, m11: 15, m14: 5 },
      exclusive: { no: 14, yes: 6 },
      promo: { brand: 2, split: 12, dist: 24 },
      term: { one: 10, three: 9, five: 7 },
    },
    counterparty_payoffs: {
      margin: { m8: 6, m11: 13, m14: 20 },
      exclusive: { no: 2, yes: 26 },
      promo: { brand: 14, split: 10, dist: 5 },
      term: { one: 2, three: 18, five: 24 },
    },
    student_batna: 40,
    counterparty_batna: 44,
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
  for (const c of CASES) {
    const setup: NegotiationSetup = {
      issues: c.issues,
      studentPayoffs: c.student_payoffs,
      counterpartyPayoffs: c.counterparty_payoffs,
      studentBatna: c.student_batna,
      counterpartyBatna: c.counterparty_batna,
    };

    // Every option needs a score on both sides, or one side is silently
    // indifferent to a choice the other is arguing about.
    for (const issue of c.issues) {
      for (const option of issue.options) {
        if (c.student_payoffs[issue.key]?.[option.key] === undefined) {
          problems.push(`${c.slug}: student has no payoff for ${issue.key}/${option.key}`);
        }
        if (c.counterparty_payoffs[issue.key]?.[option.key] === undefined) {
          problems.push(`${c.slug}: counterparty has no payoff for ${issue.key}/${option.key}`);
        }
      }
    }

    /**
     * There must be a deal both sides prefer to walking away, or the exercise
     * is unwinnable and the student will conclude they negotiated badly when
     * the case was impossible.
     */
    const max = maxJointValue(setup);
    if (max < c.student_batna + c.counterparty_batna) {
      problems.push(
        `${c.slug}: no zone of agreement — best joint value ${max} is below the two walk-aways (${c.student_batna} + ${c.counterparty_batna})`,
      );
    }

    /**
     * And the issues must be ranked differently, or there is nothing to trade.
     * Checked by seeing whether any issue has a different best option for each
     * side.
     */
    const tradeable = c.issues.some((issue) => {
      const bestFor = (t: Record<string, Record<string, number>>) =>
        issue.options.reduce((best, o) =>
          (t[issue.key]?.[o.key] ?? 0) > (t[issue.key]?.[best.key] ?? 0) ? o : best,
        ).key;
      return bestFor(c.student_payoffs) !== bestFor(c.counterparty_payoffs);
    });
    if (!tradeable) {
      problems.push(`${c.slug}: both sides want the same option on every issue — nothing to trade`);
    }
  }

  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const c of CASES) {
    const { error } = await admin.from("negotiation_cases").upsert(c, { onConflict: "slug" });
    if (error) {
      console.error(`${c.slug}: ${error.message}`);
      process.exit(1);
    }
    const setup: NegotiationSetup = {
      issues: c.issues,
      studentPayoffs: c.student_payoffs,
      counterpartyPayoffs: c.counterparty_payoffs,
      studentBatna: c.student_batna,
      counterpartyBatna: c.counterparty_batna,
    };
    console.log(
      `  ✓ ${c.slug.padEnd(30)} max joint ${maxJointValue(setup)} vs walk-aways ${c.student_batna}+${c.counterparty_batna}`,
    );
  }
  console.log(`\nSeeded ${CASES.length} negotiations.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
