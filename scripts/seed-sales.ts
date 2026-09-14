/**
 * Seeds sales role-play scenarios.
 *
 *   npm run seed:sales
 *   npm run seed:sales -- --dry-run
 *
 * Refuses a scenario whose buy rule cannot be met — more needs required than
 * exist, or a required objection that is not defined — because such a buyer
 * could never say yes and the student would be told they failed a sale that
 * was impossible. Idempotent on slug. Companies and people are invented.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import type { BuyRule, SalesNeed, SalesObjection } from "../src/lib/sales/engine";

config({ path: ".env.local" });
config({ path: ".env" });

interface ScenarioSeed {
  slug: string;
  title: string;
  sector: string;
  difficulty: "easy" | "medium" | "hard";
  shared_brief: string;
  student_role: string;
  buyer_role: string;
  student_brief: string;
  buyer_brief: string;
  max_turns: number;
  needs: SalesNeed[];
  objections: SalesObjection[];
  buy_rule: BuyRule;
}

const SCENARIOS: ScenarioSeed[] = [
  {
    slug: "sales-fmcg-modern-trade-listing",
    title: "Get a new drink listed with a supermarket chain",
    sector: "FMCG",
    difficulty: "medium",
    max_turns: 12,
    student_role: "Key account manager at a beverage company",
    buyer_role: "Category manager at a supermarket chain",
    shared_brief:
      "You sell for a mid-sized beverage company launching a ready-to-drink cold coffee in 200 ml cans at ₹60. You have a 30-minute meeting with the beverages category manager of a 90-store supermarket chain in western India to get the product listed.",
    student_brief:
      "Product: cold coffee, 200 ml can, MRP ₹60. Standard retailer margin 18%; you may go up to 22% for the first six months.\n\nYou can offer: a launch promotion funded by your company (₹15 lakh across the chain), free placement of branded chillers in the top 20 stores, a sale-or-return arrangement on the first order, and weekly replenishment from your distributor.\n\nYour evidence: in 40 standalone stores in Pune the product sells about 14 cans a store a day after two months; 38% of buyers have bought again.\n\nYou may NOT offer exclusivity or pay a listing fee.",
    buyer_brief:
      "You are Sunita Rao, 41, category manager for beverages. You are measured on category sales per square foot and gross margin. Shelf space in the chiller is full; adding anything means removing something. You have been burned twice by new beverage brands that sold well for a month on promotion and then stopped moving, leaving you with dead stock. You are polite but short on time, and you dislike sellers who pitch before asking about your business.",
    needs: [
      { key: "velocity", label: "Proof it will sell after the launch spike", detail: "She needs evidence of repeat purchase and sales rate beyond the promotion period, because shelf space is judged per square foot." },
      { key: "margin", label: "Margin at least as good as what it replaces", detail: "Her category is judged on gross margin, so a new product must not dilute it." },
      { key: "chiller_space", label: "A way around the full chiller", detail: "There is no space; she needs a solution that does not mean delisting a proven seller." },
      { key: "supply", label: "Reliable replenishment", detail: "Out-of-stocks on a promoted item hurt her store managers and her numbers." },
    ],
    objections: [
      { key: "dead_stock", label: "New brands die after the promotion", detail: "She has been left with dead stock before. It is resolved by repeat-purchase evidence and reducing her risk, e.g. sale-or-return." },
      { key: "no_space", label: "There is no space in the chiller", detail: "Resolved by a practical space solution, such as the free branded chillers in top stores." },
      { key: "margin_objection", label: "Margin is below category leaders", detail: "Resolved by improving margin within authority, or showing profit per shelf space rather than per unit." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["dead_stock", "no_space"] },
  },
  {
    slug: "sales-bfsi-term-and-health",
    title: "Advise a young salaried customer on protection",
    sector: "BFSI",
    difficulty: "medium",
    max_turns: 12,
    student_role: "Relationship manager at a private bank",
    buyer_role: "Salaried customer",
    shared_brief:
      "You are a relationship manager at a private bank. A 34-year-old customer who has just taken a home loan with the bank has walked in to update his address. The bank sells term insurance, health insurance and investment-linked insurance plans from partner insurers.",
    student_brief:
      "Products you can recommend:\n- Term insurance: ₹1 crore cover to age 60 costs about ₹14,000 a year for a healthy 34-year-old non-smoker.\n- Family floater health insurance: ₹10 lakh cover for a couple and children costs about ₹22,000 a year.\n- A unit-linked insurance plan (ULIP): mixes investment and a small cover, with a five-year lock-in. It pays you the highest incentive.\n\nYou must recommend only what suits the customer's needs. You may not claim returns are guaranteed on a ULIP, and you may not pressure a customer to decide today.",
    buyer_brief:
      "You are Arjun Mehta, 34, a software engineer earning ₹22 lakh a year. You married two years ago; your wife is expecting your first child in five months. You have just taken a ₹60 lakh home loan. Your employer gives you ₹5 lakh of group health cover, which you assume is enough. Your father had a heart procedure last year that cost ₹8 lakh. You think insurance is a waste of money \"if nothing happens\", and a friend lost money in an investment-plus-insurance product, so you distrust bank sales staff pushing products. You will not buy anything complicated.",
    needs: [
      { key: "loan_protection", label: "Protecting his family from the home loan if he dies", detail: "A ₹60 lakh loan and a baby on the way; his wife could not service the EMI alone." },
      { key: "health_gap", label: "Health cover beyond the employer's policy", detail: "₹5 lakh group cover ends if he changes jobs and is small against what his father's procedure cost; the baby adds costs." },
      { key: "simplicity", label: "Something simple he can understand", detail: "He distrusts complicated products after a friend's bad experience." },
    ],
    objections: [
      { key: "waste", label: "Insurance is wasted money if nothing happens", detail: "Resolved by framing term cover as protection of the family's plan, with the cost in context (e.g. a small share of income or the EMI)." },
      { key: "company_cover", label: "The company already covers him", detail: "Resolved by explaining what happens if he changes jobs, and the size of real hospital costs against ₹5 lakh." },
      { key: "distrust", label: "Bank staff push products that pay them", detail: "Resolved by transparency and by NOT pushing the ULIP; recommending the simple, suitable products instead." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["distrust", "waste"] },
  },
  {
    slug: "sales-b2b-distributor-software",
    title: "Sell inventory software to a family-run distributor",
    sector: "B2B",
    difficulty: "hard",
    max_turns: 14,
    student_role: "Account executive at a B2B software company",
    buyer_role: "Owner of a distribution business",
    shared_brief:
      "You sell cloud software that manages inventory, orders and retailer credit for small distributors. You are meeting the owner of a family-run distributor of packaged foods in Indore, who serves about 600 kirana stores with 12 delivery vans.",
    student_brief:
      "Pricing: ₹6,000 a month for up to 10 users, with a one-time setup of ₹40,000. You may waive up to half of the setup fee. You may offer a 60-day paid pilot at half price.\n\nWhat the product does: live stock by warehouse; order taking on salesmen's phones; retailer credit limits and overdue alerts; daily reports on WhatsApp; works in Hindi. Onboarding includes two days of training at the warehouse.\n\nReference: a similar distributor in Bhopal cut stock-outs of top items by about a third and recovered overdue credit faster within four months.",
    buyer_brief:
      "You are Ramesh Agrawal, 52, second-generation owner. You run the business from a register and Excel sheets your nephew maintains. Your real frustrations: fast-moving items run out while slow ones pile up; retailers delay payment and you only notice when the amount is large; and you personally spend two hours every evening checking stock and cash. Your salesmen are not comfortable with apps. You have been sold software before that nobody used, and ₹6,000 a month feels expensive. You worry your data will leak to your principal companies. You respect people who understand the distribution business.",
    needs: [
      { key: "stockouts", label: "Fewer stock-outs of fast movers", detail: "Top items running out loses him sales and credibility with retailers." },
      { key: "credit", label: "Control over retailer credit", detail: "He finds out about overdue payments too late." },
      { key: "owner_time", label: "Getting his evenings back", detail: "He spends two hours a day checking stock and cash himself." },
      { key: "staff_adoption", label: "Something his salesmen will actually use", detail: "His salesmen are not comfortable with apps." },
    ],
    objections: [
      { key: "unused_software", label: "Software he bought before was never used", detail: "Resolved by a credible adoption plan: Hindi interface, on-site training, a pilot with success criteria." },
      { key: "price", label: "₹6,000 a month is expensive", detail: "Resolved by relating cost to money lost on stock-outs or overdue credit, or by the pilot and setup waiver within authority." },
      { key: "data", label: "Data might leak to principal companies", detail: "Resolved by a clear, specific answer on who can see his data." },
    ],
    buy_rule: { needsRequired: 3, objectionsRequired: ["unused_software", "price"] },
  },
];

function validate(s: ScenarioSeed): string[] {
  const problems: string[] = [];
  const say = (m: string) => problems.push(`${s.slug}: ${m}`);
  const needKeys = new Set(s.needs.map((n) => n.key));
  const objectionKeys = new Set(s.objections.map((o) => o.key));
  if (needKeys.size !== s.needs.length) say("duplicate need keys");
  if (objectionKeys.size !== s.objections.length) say("duplicate objection keys");
  if (s.buy_rule.needsRequired < 1 || s.buy_rule.needsRequired > s.needs.length) {
    say(`requires ${s.buy_rule.needsRequired} needs but defines ${s.needs.length}`);
  }
  for (const key of s.buy_rule.objectionsRequired) {
    if (!objectionKeys.has(key)) say(`required objection "${key}" is not defined`);
  }
  // A buyer the student cannot possibly satisfy in the turns available.
  const minimumTurns = s.buy_rule.needsRequired + s.buy_rule.objectionsRequired.length;
  if (minimumTurns > s.max_turns) say(`needs at least ${minimumTurns} turns but allows ${s.max_turns}`);
  return problems;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const problems = SCENARIOS.flatMap(validate);
  const slugs = new Set<string>();
  for (const s of SCENARIOS) {
    if (slugs.has(s.slug)) problems.push(`${s.slug}: duplicate slug`);
    slugs.add(s.slug);
  }
  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Validated ${SCENARIOS.length} sales scenarios.`);
  if (dryRun) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin
    .from("sales_scenarios")
    .upsert(SCENARIOS.map((s) => ({ ...s, is_published: true })), { onConflict: "slug" });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`Seeded ${SCENARIOS.length} sales scenarios.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
