import "server-only";

/**
 * Knowledge checks for the certificate prep courses (src/lib/cert-courses.ts).
 *
 * A module counts as done only when its check is passed — clicking "complete"
 * proves nothing — and the exam unlocks only when every module is done
 * (src/lib/course-progress.ts). Server-only: the answers never reach the
 * browser; the page gets the questions and options, the API grades.
 *
 * Questions are written with the correct option first for readability; the
 * option order shown is a fixed shuffle of the question text, so the server
 * and the page always agree on it and the answer is not always "A".
 */

export const CHECK_PASS_RATIO = 0.75;

export interface CheckQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** What the page may see: no answer, no explanation until graded. */
export type PublicQuestion = Pick<CheckQuestion, "id" | "question" | "options">;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function q(id: string, question: string, correct: string, wrong: [string, string, string], explanation: string): CheckQuestion {
  const at = hash(question) % 4;
  const options = [...wrong];
  options.splice(at, 0, correct);
  return { id, question, options, answer: at, explanation };
}

export const MODULE_CHECKS: Record<string, CheckQuestion[]> = {
  // ------------------------------------------------------------ consulting --
  "consulting-mod-1": [
    q("c1-1", "A revenue branch is split into 'domestic customers', 'online customers' and 'international customers'. What is wrong with it?",
      "It is not mutually exclusive — an online customer is also domestic or international",
      ["It is not collectively exhaustive", "Three branches are too few to be useful", "Nothing — it is MECE"],
      "Online is a channel; domestic and international are geographies. Mixing two dimensions in one level makes branches overlap. Split by one dimension per level."),
    q("c1-2", "Profits are falling while revenue is flat. Which first split of the problem is best?",
      "Profit = revenue − costs, then costs into fixed and variable",
      ["Split by the company's departments", "Split by the four Ps of marketing", "List the competitors first"],
      "With revenue flat, the change must be on the cost side. A profitability tree isolates it quickly and is MECE by construction."),
    q("c1-3", "What does 'hypothesis-driven' mean in a case?",
      "Stating a likely answer early and using the analysis to prove or disprove it",
      ["Collecting all the data before forming any view", "Picking the framework that worked in a past case", "Asking the interviewer what the answer is"],
      "A hypothesis tells you which branch to test first, so the analysis is targeted instead of exhaustive. You revise it as the data comes in."),
    q("c1-4", "Why ask clarifying questions before you structure?",
      "To pin down the objective, scope and constraints so the structure answers the right question",
      ["To show you know the industry's jargon", "To buy time while you think", "Interviewers score the number of questions asked"],
      "A brilliant structure for the wrong objective scores nothing. Confirm the goal (e.g. profit vs. market share), the time frame and any constraints first."),
  ],
  "consulting-mod-2": [
    q("c2-1", "A product sells for ₹500 with a variable cost of ₹300 a unit. Fixed costs are ₹40 lakh a year. What is the breakeven volume?",
      "20,000 units",
      ["8,000 units", "13,333 units", "50,000 units"],
      "Contribution per unit = ₹500 − ₹300 = ₹200. Breakeven = fixed costs ÷ contribution = ₹40,00,000 ÷ ₹200 = 20,000 units."),
    q("c2-2", "Price elasticity of demand is −2. If price is cut by 10%, what happens?",
      "Volume rises about 20%, so revenue rises (about +8%)",
      ["Volume rises about 5%, so revenue falls", "Volume falls about 20%", "Nothing — elasticity only applies to price rises"],
      "Elasticity −2 means volume moves twice the price change in the opposite direction: +20%. Revenue = 0.9 × 1.2 = 1.08, so about +8%."),
    q("c2-3", "A business has high fixed costs and low variable costs. What does that imply?",
      "High operating leverage: a small change in volume moves profit a lot",
      ["Low operating leverage: profit barely moves with volume", "It has no breakeven point", "Its margin is the same at every volume"],
      "Once fixed costs are covered, almost every extra rupee of revenue drops to profit — and a volume fall hurts just as fast."),
    q("c2-4", "What is contribution margin?",
      "Price minus variable cost per unit — what each unit adds towards fixed costs and profit",
      ["Revenue minus all costs", "Gross margin after tax", "Fixed costs divided by units sold"],
      "Contribution margin ignores fixed costs on purpose: it tells you what each extra unit is worth, which drives breakeven and pricing decisions."),
  ],
  "consulting-mod-3": [
    q("c3-1", "Which best tells you whether a market is worth entering?",
      "Its size, its growth and the share of the profit pool the client can realistically capture",
      ["Its size alone", "How many competitors it has", "Whether the client's CEO is enthusiastic"],
      "A big market with thin margins or entrenched rivals can be worse than a small, profitable, growing one. Attractiveness is size × growth × winnable profit."),
    q("c3-2", "In Porter's five forces, plenty of close substitutes for a product means…",
      "Lower profit potential for the industry, because customers can switch easily",
      ["Higher supplier power", "Higher barriers to entry", "Stronger brand loyalty"],
      "Substitutes cap the price an industry can charge. The easier it is to switch, the less pricing power incumbents have."),
    q("c3-3", "When is an acquisition usually preferred over building organically?",
      "When speed matters and a good target is available at a sensible price",
      ["When there is plenty of time and full control at the lowest cost matters most", "When there are no possible targets", "Always — acquisitions rarely fail"],
      "Buying trades money (and integration risk) for time and capabilities. Building is cheaper and fully controlled but slow."),
    q("c3-4", "A new product will take 30% of its sales from the company's existing product. What is that effect called?",
      "Cannibalisation — it should be netted out of the new product's incremental revenue",
      ["Synergy", "Economies of scale", "Operating leverage"],
      "Only incremental revenue counts towards the business case. Sales moved from one of your own products to another create no new value."),
  ],
  "consulting-mod-4": [
    q("c4-1", "According to the Pyramid Principle, where does the recommendation go?",
      "First, followed by the supporting arguments",
      ["At the end, after all the analysis", "Only if the partner asks for it", "In the appendix"],
      "Senior readers want the answer first. Lead with the recommendation, then the three or so reasons, then the evidence behind each."),
    q("c4-2", "What should support a strong final recommendation?",
      "About three distinct, MECE reasons, each backed by evidence from the case",
      ["Every number you calculated during the case", "One reason repeated in different words", "The name of the framework you used"],
      "Three independent pillars are persuasive and easy to follow. A data dump buries the argument; one reason is fragile."),
    q("c4-3", "Why include risks in the final recommendation?",
      "To show the main ways the plan could fail, and how each would be mitigated",
      ["To hedge so you can never be wrong", "Because the rubric rewards length", "To avoid committing to an answer"],
      "A recommendation that names its risks and mitigations is more credible. It still commits to an answer — it does not hedge."),
    q("c4-4", "Which is the strongest 'next step' to close with?",
      "Run a three-month pilot in two cities, with a go/no-go decision on repeat-purchase rate",
      ["Do more research", "Hire another consultancy", "Revisit the question next quarter"],
      "Good next steps are specific, time-bound and tied to a decision metric. Vague next steps read as not having an answer."),
  ],
  // --------------------------------------------------------------- finance --
  "finance-mod-1": [
    q("f1-1", "A company reports a healthy profit but is running out of cash. What is the most likely cause?",
      "Cash is tied up in growing receivables and inventory (working capital)",
      ["Revenue is falling", "Depreciation is too high", "Its tax rate is too low"],
      "Profit is recognised when sales are booked; cash arrives when customers pay. Fast growth with slow collections or rising stock drains cash."),
    q("f1-2", "How does depreciation appear in the cash flow statement?",
      "It is added back to net income, because it is a non-cash expense",
      ["It is subtracted, because it is a cash cost", "It does not appear at all", "It is recorded under financing activities"],
      "Depreciation reduced profit without any cash leaving the business, so the indirect method adds it back to reach operating cash flow."),
    q("f1-3", "Free cash flow differs from EBITDA mainly because free cash flow also subtracts…",
      "Taxes, capital expenditure and increases in working capital",
      ["Only interest", "Revenue", "Only dividends"],
      "EBITDA is a profit measure before many real cash uses. Free cash flow is what is actually left after paying taxes, reinvesting and funding working capital."),
    q("f1-4", "Receivables rise by ₹20 crore during the year. How does operating cash flow compare with net income?",
      "Operating cash flow is ₹20 crore lower",
      ["Operating cash flow is ₹20 crore higher", "There is no difference", "Net income falls by ₹20 crore"],
      "Those sales are in profit but the cash has not been collected, so the increase in receivables is subtracted when bridging to cash."),
  ],
  "finance-mod-2": [
    q("f2-1", "Risk-free rate 7%, beta 1.2, equity risk premium 6%. What is the cost of equity under CAPM?",
      "14.2%",
      ["13.0%", "15.4%", "8.2%"],
      "CAPM: cost of equity = risk-free + beta × premium = 7% + 1.2 × 6% = 14.2%."),
    q("f2-2", "Pre-tax cost of debt is 10% and the tax rate is 25%. What is the after-tax cost of debt?",
      "7.5%",
      ["2.5%", "10%", "12.5%"],
      "Interest is tax-deductible, so after-tax cost = 10% × (1 − 25%) = 7.5%."),
    q("f2-3", "Next year's free cash flow is ₹110 crore, WACC is 12% and long-term growth is 4%. What is the Gordon growth terminal value?",
      "₹1,375 crore",
      ["₹917 crore", "₹2,750 crore", "₹1,100 crore"],
      "Terminal value = FCF ÷ (WACC − g) = 110 ÷ (12% − 4%) = 110 ÷ 0.08 = ₹1,375 crore."),
    q("f2-4", "Unlevered free cash flow should be discounted at…",
      "The WACC",
      ["The cost of equity", "The risk-free rate", "The cost of debt"],
      "Unlevered cash flow belongs to all capital providers, so it is discounted at the blended cost of all capital. Levered (equity) cash flow uses the cost of equity."),
  ],
  "finance-mod-3": [
    q("f3-1", "Why is EV/EBITDA often preferred to P/E when comparing companies?",
      "It is not distorted by differences in debt levels and depreciation policies",
      ["It uses the share price directly", "It works for loss-making companies at the net income level", "It ignores the company's size"],
      "EV and EBITDA both sit before financing and before depreciation, so companies with different leverage or asset bases compare like-for-like."),
    q("f3-2", "The peer median EV/EBITDA is 10×. The target's EBITDA is ₹50 crore and its net debt is ₹100 crore. What is the implied equity value?",
      "₹400 crore",
      ["₹500 crore", "₹600 crore", "₹50 crore"],
      "Enterprise value = 10 × ₹50 crore = ₹500 crore. Equity value = EV − net debt = ₹500 crore − ₹100 crore = ₹400 crore."),
    q("f3-3", "Why are transaction (deal) multiples usually higher than trading multiples?",
      "They include a control premium paid to take over the company",
      ["They use older accounts", "Deal targets grow more slowly", "They exclude debt"],
      "A buyer acquiring control pays above the minority share price for the right to run the business and capture synergies."),
    q("f3-4", "Before applying a multiple, EBITDA should be normalised by…",
      "Adding back one-off items such as a restructuring charge",
      ["Using the worst year on record", "Doubling it to reflect growth", "Leaving it exactly as reported"],
      "Multiples value recurring earnings. One-off gains or charges distort the base and therefore the valuation."),
  ],
  "finance-mod-4": [
    q("f4-1", "A project's NPV at the 12% hurdle rate is positive. What does that mean?",
      "It returns more than 12% and creates value",
      ["Its IRR is below 12%", "It pays back within a year", "It should be rejected"],
      "A positive NPV at the hurdle rate means the cash flows more than repay the cost of capital — equivalently, IRR is above 12%."),
    q("f4-2", "Two mutually exclusive projects: A has the higher IRR, B has the higher NPV. With no capital limit, which should you choose?",
      "B — NPV measures the value created in rupees",
      ["A — the higher IRR always wins", "Neither", "Whichever pays back faster"],
      "IRR is a rate and can favour small projects. When projects are mutually exclusive, choose the one that adds the most value: the higher NPV."),
    q("f4-3", "When is an acquisition accretive?",
      "When the combined earnings per share after the deal is higher than the acquirer's standalone EPS",
      ["When the target is bigger than the acquirer", "When the price is below book value", "When the target carries debt"],
      "Accretion and dilution are measured on the acquirer's EPS. Accretive means each share earns more after the deal than before it."),
    q("f4-4", "In an all-stock deal, the acquirer's P/E is lower than the P/E it is paying for the target. The deal tends to be…",
      "Dilutive",
      ["Accretive", "Neutral", "Impossible to assess"],
      "Issuing shares valued at a low P/E to buy earnings priced at a higher P/E gives away more earnings than it brings in, so EPS falls."),
  ],
  // --------------------------------------------------------------- product --
  "product-mod-1": [
    q("p1-1", "What does the jobs-to-be-done framework ask?",
      "What progress the user is trying to make in a particular situation",
      ["Which features users request most often", "What competitors already offer", "How old the users are"],
      "People 'hire' products to get a job done. Understanding the job reveals what success looks like — feature requests are only guesses at it."),
    q("p1-2", "Which way of segmenting users is usually most useful for product decisions?",
      "By behaviour and need — for example power users versus occasional users",
      ["By age", "By city", "Alphabetically by name"],
      "Behavioural segments share problems and usage patterns, so they point at product changes. Demographics often do not."),
    q("p1-3", "Sign-ups have dropped. Before proposing new features, what should you do first?",
      "Map the user journey to find where people drop off, and why",
      ["Build a new onboarding flow", "Cut the price", "Increase the marketing budget"],
      "Diagnose before you prescribe. Locating the friction point (and checking for external causes) stops you solving the wrong problem."),
    q("p1-4", "What does 'problem validation' mean?",
      "Confirming that enough users have the problem and care enough to change their behaviour",
      ["Building the solution and seeing what happens", "Getting the CEO's sign-off", "Writing the product requirements document"],
      "A real, frequent, painful problem is the precondition for any solution. Validate it with evidence before committing build time."),
  ],
  "product-mod-2": [
    q("p2-1", "What makes a good North Star metric?",
      "It captures the value users get and leads to long-term revenue",
      ["It counts total registered users", "It counts page views", "It moves a lot from day to day"],
      "A North Star should rise only when users get real value — e.g. weekly active teams collaborating — so optimising it grows the business."),
    q("p2-2", "In the AARRR funnel, what is 'activation'?",
      "The first moment a user gets real value from the product",
      ["Signing up for an account", "Paying for the first time", "Referring a friend"],
      "Activation is the 'aha' moment. Sign-ups that never reach it rarely retain, which is why activation is often the biggest lever."),
    q("p2-3", "Customer lifetime value is ₹6,000 and customer acquisition cost is ₹2,500. How does that compare with the common 3× LTV/CAC benchmark?",
      "2.4× — below the usual 3× benchmark",
      ["4.2× — well above it", "0.4× — deeply unprofitable", "Exactly 3×"],
      "LTV/CAC = 6,000 ÷ 2,500 = 2.4×. Under ~3× usually means acquisition is too expensive or customers are not worth enough yet."),
    q("p2-4", "A cohort retention curve flattens at 25% after month three. What does that suggest?",
      "A core of users finds lasting value — the product has a retention floor",
      ["The product retains no one", "Revenue must be falling", "The data is wrong"],
      "A curve that flattens instead of falling to zero means product–market fit for a segment. The job then is raising the floor and finding more users like them."),
  ],
  "product-mod-3": [
    q("p3-1", "RICE = (Reach × Impact × Confidence) ÷ Effort. A feature has reach 2,000, impact 2, confidence 80% and effort 4 person-months. What is its RICE score?",
      "800",
      ["3,200", "400", "1,600"],
      "(2,000 × 2 × 0.8) ÷ 4 = 3,200 ÷ 4 = 800."),
    q("p3-2", "In the Kano model, what is a 'must-have' feature?",
      "One that causes dissatisfaction when missing but adds little satisfaction when present",
      ["One that delights users when present", "One that has no effect on satisfaction", "One whose satisfaction rises in proportion to how well it works"],
      "Must-haves are table stakes — like a working login. Performance features scale with quality; delighters surprise. Prioritise must-haves first."),
    q("p3-3", "What should a minimum viable product do?",
      "Test the riskiest assumption with the least possible build",
      ["Include every feature users have asked for", "Be the finished product", "Avoid putting anything in front of users"],
      "An MVP is a learning tool. Strip scope down to what tests the assumption that would sink the product if it were wrong."),
    q("p3-4", "When is paying down technical debt the right priority?",
      "When it is slowing delivery or causing reliability problems that users feel",
      ["Never — features always come first", "Only after the product launches", "Whenever an engineer asks for it"],
      "Technical debt is worth paying when its interest — slower shipping, outages, bugs — costs more than the features it delays."),
  ],
  "product-mod-4": [
    q("p4-1", "What should a positioning statement make clear?",
      "Who it is for, the problem it solves, and why it is better than the alternative",
      ["Every feature in the product", "Only the price", "The founders' story"],
      "Positioning is a choice of audience and a claim of difference. Without the 'why better than X', it is just a description."),
    q("p4-2", "When does a freemium model work best?",
      "When serving each extra user costs little and free users convert or spread the product",
      ["When every user is expensive to serve", "When the product is a one-time purchase", "When there are no paid features"],
      "Freemium pays for free users through conversion and word of mouth. High marginal costs per user make it a money pit."),
    q("p4-3", "Why roll a launch out in phases?",
      "To limit risk: learn from a small group and fix problems before the full launch",
      ["To delay revenue on purpose", "Because launches have to be slow", "To confuse competitors"],
      "A phased rollout (beta, one region, a percentage of users) contains the damage of anything that breaks and gives real data to tune the launch."),
    q("p4-4", "When does a sales-led go-to-market fit best?",
      "When deal sizes are large and buyers need demos, negotiation and support to decide",
      ["When the product is a cheap consumer app", "When users can sign up and succeed alone in minutes", "When there is no product yet"],
      "A salesforce is expensive per deal, so it fits high-value, complex purchases. Cheap self-serve products grow product-led instead."),
  ],
};

export function moduleCheck(moduleId: string): CheckQuestion[] | null {
  return MODULE_CHECKS[moduleId] ?? null;
}

export function publicCheck(moduleId: string): PublicQuestion[] {
  return (MODULE_CHECKS[moduleId] ?? []).map(({ id, question, options }) => ({ id, question, options }));
}

/** Grades a set of chosen option indexes, in question order. */
export function gradeCheck(moduleId: string, answers: number[]) {
  const questions = MODULE_CHECKS[moduleId] ?? [];
  const results = questions.map((question, i) => ({
    id: question.id,
    chosen: answers[i] ?? -1,
    answer: question.answer,
    correct: answers[i] === question.answer,
    explanation: question.explanation,
  }));
  const correct = results.filter((r) => r.correct).length;
  const total = questions.length;
  return { results, correct, total, passed: total > 0 && correct / total >= CHECK_PASS_RATIO };
}
