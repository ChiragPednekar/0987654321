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

export const SCENARIOS: ScenarioSeed[] = [
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
  },  {
    slug: "sales-fmcg-kirana-biscuits",
    title: "Get a kirana store to stock a new biscuit brand",
    sector: "FMCG",
    difficulty: "easy",
    max_turns: 10,
    student_role: "Sales officer at a biscuit company",
    buyer_role: "Owner of a neighbourhood kirana store",
    shared_brief:
      "You are a sales officer for a regional biscuit company launching a ₹10 cream biscuit in Lucknow. You are visiting a busy kirana store near a school to get the owner to stock it.",
    student_brief:
      "Product: cream biscuit, ₹10 pack. Retailer margin 12% (the market leader gives about 10%). You can offer: a free display dispenser box, one free pack for every 12 on the first order, weekly visits from the distributor's salesman, and taking back unsold stock that is within its expiry date.\n\nEvidence: in 300 stores in Kanpur the product sells about 30 packs a store a week after the launch month.\n\nYou may NOT offer credit beyond the distributor's standard 7 days.",
    buyer_brief:
      "You are Ramesh Gupta, 48, who has run the store for twenty years. Your shelf near the counter is full of fast-selling brands. Children from the school buy snacks every afternoon, so anything children like sells. You have been stuck before with a new brand that nobody asked for, and the stock expired. You care about margin and about not tying up money. You are friendly but busy with customers, and you lose interest in long speeches.",
    needs: [
      { key: "sells_fast", label: "Confidence it will actually sell here", detail: "He needs a reason to believe children and parents will ask for it — evidence from similar stores, or a promotion that pulls buyers in." },
      { key: "margin", label: "Better margin than what he stocks now", detail: "Every rupee on the shelf has to earn; a higher margin than the leader matters to him." },
      { key: "low_risk", label: "Not getting stuck with unsold stock", detail: "He has lost money on expired stock of a new brand before." },
    ],
    objections: [
      { key: "no_space", label: "No space near the counter", detail: "Resolved by a practical answer such as the free display dispenser that sits on the counter." },
      { key: "dead_stock", label: "New brands do not sell and expire", detail: "Resolved by the take-back of unsold stock and evidence from similar stores." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["dead_stock"] },
  },
  {
    slug: "sales-durables-air-conditioner",
    title: "Help a family choose an air conditioner",
    sector: "Consumer durables",
    difficulty: "easy",
    max_turns: 10,
    student_role: "Sales executive at an electronics store",
    buyer_role: "Customer shopping for an air conditioner",
    shared_brief:
      "You work at a large electronics store in Delhi in May. A customer has walked into the air conditioner section and is looking at the cheapest models.",
    student_brief:
      "Models you can recommend:\n- 1 ton, 3-star fixed speed: ₹28,000.\n- 1.5 ton, 3-star fixed speed: ₹34,000.\n- 1.5 ton, 5-star inverter: ₹42,000. Uses roughly 30–40% less electricity than a 3-star fixed-speed unit in heavy use.\n\nYou can offer: free standard installation, no-cost EMI over 6 months on cards from two banks, and an extended 3-year warranty for ₹2,500.\n\nYou must recommend what suits the customer. Do not invent electricity savings beyond the range above, and do not pressure the customer to buy today.",
    buyer_brief:
      "You are Neha Arora, 38. You need an AC for your bedroom, about 160 square feet on the top floor, which gets very hot. The AC will run 8–10 hours a night for five months a year. Your electricity bill last summer was painful. Your budget in your head is about ₹30,000, and you think a bigger AC is a waste of money. You are wary of salespeople pushing the most expensive product, and you will walk out if you feel pushed.",
    needs: [
      { key: "cooling", label: "A room that actually cools", detail: "A top-floor room of 160 sq ft in Delhi heat needs about 1.5 tons; a 1-ton unit would struggle and run constantly." },
      { key: "bills", label: "Lower electricity bills", detail: "Last summer's bills hurt; with heavy nightly use, efficiency matters." },
      { key: "budget", label: "Staying close to her budget", detail: "About ₹30,000 in her head; spreading the cost may help." },
    ],
    objections: [
      { key: "upsell", label: "Salespeople push the expensive model", detail: "Resolved by asking about her room and use before recommending, and explaining the choice in her terms." },
      { key: "price", label: "The recommended model costs more than she planned", detail: "Resolved by showing the running-cost difference over her usage, or the no-cost EMI." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["upsell", "price"] },
  },
  {
    slug: "sales-pharma-gp-detailing",
    title: "Detail a new diabetes medicine to a general physician",
    sector: "Pharma",
    difficulty: "medium",
    max_turns: 12,
    student_role: "Medical representative at a pharmaceutical company",
    buyer_role: "General physician",
    shared_brief:
      "You are a medical representative for a pharmaceutical company. You have a few minutes with a busy general physician in Nagpur, between patients, to discuss your company's once-daily combination tablet for type 2 diabetes.",
    student_brief:
      "Product: a once-daily fixed-dose combination of two established diabetes medicines, priced about 20% below the two taken separately. Approved for adults with type 2 diabetes not controlled on one medicine.\n\nWhat you can say: one tablet a day instead of two or three; the published study supporting its approval showed blood sugar control similar to the two medicines taken separately; a patient support programme offers free blood sugar testing camps at clinics.\n\nYou may NOT offer gifts, sponsorship or any personal benefit to the doctor, claim it is better than the separate medicines, or discuss uses outside its approval.",
    buyer_brief:
      "You are Dr. Anil Deshmukh, 55, a general physician with a crowded practice; about a third of your patients are diabetic. Your biggest frustration is that patients stop taking their medicines — many are on several tablets a day and cannot afford them all. You are sceptical of reps: you have heard too many exaggerated claims. You want evidence, not adjectives. You will cut the conversation short if the rep talks for a long time without letting you speak, and you will end it at once if offered anything personal.",
    needs: [
      { key: "adherence", label: "Patients who keep taking their medicine", detail: "Fewer tablets a day would help patients who stop taking them." },
      { key: "cost", label: "Lower cost for patients", detail: "Many of his patients cannot afford several separate medicines." },
      { key: "evidence", label: "Evidence it works as well", detail: "He will only switch patients on the basis of the approval data." },
      { key: "monitoring", label: "Help monitoring patients", detail: "Patients rarely come back for blood sugar tests." },
    ],
    objections: [
      { key: "claims", label: "Reps exaggerate", detail: "Resolved by sticking to the approved claims and the study, and admitting what it does not show." },
      { key: "switching", label: "Patients are stable on what they take", detail: "Resolved by identifying which patients would benefit — those missing doses or struggling with cost — rather than switching everyone." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["claims", "switching"] },
  },
  {
    slug: "sales-bfsi-sme-working-capital",
    title: "Offer working capital to a small manufacturer",
    sector: "BFSI",
    difficulty: "medium",
    max_turns: 12,
    student_role: "Relationship manager, small business banking",
    buyer_role: "Owner of a small manufacturing business",
    shared_brief:
      "You are a relationship manager in a bank's small business team in Coimbatore. You are meeting the owner of a textile-machinery parts business with ₹18 crore of annual sales, who banks elsewhere and agreed to a meeting after a referral.",
    student_brief:
      "Products: a cash credit (working capital) limit of up to ₹2 crore against receivables and stock, interest about 10–11% a year depending on assessment; invoice discounting for receivables from large customers; a current account with free digital payments and a dedicated relationship manager.\n\nProcess: sanction in about three weeks after documents. You may NOT promise approval, a specific rate before assessment, or collateral-free lending above the scheme limits.",
    buyer_brief:
      "You are S. Palanisamy, 50. Your large customers pay in 90–120 days, but you pay your steel suppliers in 30, so you are always short of cash and sometimes miss supplier discounts for paying early. Your current bank gives you a ₹60 lakh limit and has been slow to increase it; renewals take months of paperwork. You hate paperwork and switching banks sounds like a headache. You are suspicious of banks that promise much before the loan and disappear after it.",
    needs: [
      { key: "cash_gap", label: "Bridging the gap between paying suppliers and being paid", detail: "His customers pay in 90–120 days but suppliers want payment in 30." },
      { key: "supplier_discount", label: "Capturing early-payment discounts", detail: "He misses discounts from suppliers because he lacks cash." },
      { key: "speed", label: "Faster decisions and renewals", detail: "His current bank takes months to renew or increase his limit." },
    ],
    objections: [
      { key: "switching", label: "Switching banks is a headache", detail: "Resolved by a clear, short plan of what moves and what he has to do, possibly starting with invoice discounting alone." },
      { key: "overpromise", label: "Banks promise and then disappear", detail: "Resolved by being honest about the assessment, the timeline and what is not guaranteed." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["switching", "overpromise"] },
  },
  {
    slug: "sales-b2b-hr-software",
    title: "Sell HR software to a growing IT company",
    sector: "B2B",
    difficulty: "hard",
    max_turns: 14,
    student_role: "Account executive at an HR software company",
    buyer_role: "Head of HR at a mid-sized IT services company",
    shared_brief:
      "You sell cloud software for payroll, attendance, leave and performance reviews. You are meeting the head of HR of a Pune IT services company that has grown from 300 to 900 employees in two years and still runs HR on spreadsheets and an old payroll tool.",
    student_brief:
      "Pricing: ₹180 per employee per month, minimum one year; implementation ₹3 lakh. You may discount up to 15% for a two-year commitment and offer a free 30-day sandbox with their data.\n\nThe product: payroll with Indian statutory compliance (PF, ESI, professional tax, TDS), attendance from biometric devices and a mobile app, leave, performance reviews, and an employee app. It integrates with common accounting software. Implementation takes about 8 weeks.\n\nReference: a 1,200-person IT company in Hyderabad cut payroll processing from five days to one.",
    buyer_brief:
      "You are Kavita Menon, 44, head of HR. Payroll takes your team five days every month and there were errors twice last year that upset employees. Attrition is high and the CEO wants better performance reviews. But the decision is not yours alone: the CFO controls the budget and cares about cost and payroll accuracy, and the IT head worries about data security and integration. Last year a vendor's implementation slipped by four months. You will not commit without a plan you can take to the CFO and IT head. You like vendors who ask good questions.",
    needs: [
      { key: "payroll_time", label: "Payroll done faster and without errors", detail: "Five days a month and two error incidents last year." },
      { key: "reviews", label: "Performance reviews the CEO trusts", detail: "The CEO wants a better review process to tackle attrition." },
      { key: "stakeholders", label: "Something she can sell to the CFO and IT head", detail: "She needs answers on cost and security for the people who decide with her." },
      { key: "implementation", label: "A credible implementation plan", detail: "A previous vendor's implementation slipped by four months." },
    ],
    objections: [
      { key: "budget", label: "The CFO will say it is too expensive", detail: "Resolved by relating cost to time saved and errors avoided, or the two-year discount within authority." },
      { key: "security", label: "IT will block it over data security", detail: "Resolved by offering a session with the IT head and specific answers on where data is stored and who can access it." },
      { key: "delay", label: "Implementations always slip", detail: "Resolved by a week-by-week plan, the sandbox, and the reference customer." },
    ],
    buy_rule: { needsRequired: 3, objectionsRequired: ["budget", "security", "delay"] },
  },
  {
    slug: "sales-b2b-fleet-telematics",
    title: "Sell vehicle tracking to a trucking company",
    sector: "B2B",
    difficulty: "hard",
    max_turns: 14,
    student_role: "Enterprise sales manager at a telematics company",
    buyer_role: "Owner of a trucking company",
    shared_brief:
      "You sell GPS tracking and fuel monitoring for commercial vehicles. You are meeting the owner of a trucking company in Ahmedabad that runs 80 trucks on routes to Mumbai, Delhi and Chennai.",
    student_brief:
      "Pricing: device ₹6,500 per truck (one time) plus ₹450 per truck per month. You may offer the devices on rental at ₹650 a month with no upfront cost, and a 10-truck pilot for 60 days.\n\nThe product: live location, route history, alerts for overspeeding and unscheduled stops, a fuel sensor that detects theft and sudden drops, and trip reports customers can be sent automatically.\n\nReference: a 60-truck fleet in Surat found fuel losses of about 4% and cut them within three months.",
    buyer_brief:
      "You are Hitesh Patel, 46. Fuel is your biggest cost and you suspect some drivers sell diesel on the way, but you cannot prove it. Your big customers keep calling to ask where their consignment is, and your staff ring drivers all day to find out. Good drivers are hard to find and you worry tracking will make them leave. Money is tight after buying new trucks. A cheap tracker you tried two years ago kept failing.",
    needs: [
      { key: "fuel_theft", label: "Stopping fuel theft", detail: "Fuel is the biggest cost and he suspects diesel is being sold on the way." },
      { key: "customer_updates", label: "Answering customers without phoning drivers", detail: "Customers ask for consignment status; his staff ring drivers all day." },
      { key: "cash", label: "Not spending a lot upfront", detail: "Cash is tight after buying new trucks." },
    ],
    objections: [
      { key: "drivers", label: "Drivers will resent being tracked and leave", detail: "Resolved by positioning it with drivers — safety, fewer calls, proof of good driving, or incentives from savings." },
      { key: "reliability", label: "Trackers fail", detail: "Resolved by the pilot with clear success criteria, and the device's service terms." },
      { key: "upfront", label: "Too expensive upfront for 80 trucks", detail: "Resolved by the rental option or relating the cost to fuel losses." },
    ],
    buy_rule: { needsRequired: 2, objectionsRequired: ["drivers", "reliability", "upfront"] },
  },
];

export function validate(s: ScenarioSeed): string[] {
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

if (process.argv[1]?.endsWith("seed-sales.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
