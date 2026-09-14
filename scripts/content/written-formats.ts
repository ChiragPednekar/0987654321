/**
 * Seed content for the written formats added in 20250101000038.
 *
 * Each entry is a `cases` row plus its rubric. The rubric is where the format
 * actually lives: a guesstimate that rewarded "recommendation" would be
 * marking the wrong thing, and the grader knows nothing about formats beyond
 * what the rubric tells it.
 */

export interface WrittenSeed {
  slug: string;
  title: string;
  format:
    | "guesstimate"
    | "stock_pitch"
    | "brand_teardown"
    | "rca"
    | "wat"
    | "memo"
    | "behavioural"
    | "product_sense"
    | "metrics"
    | "prioritisation"
    | "research_note"
    | "gtm_plan"
    | "marketing_mix"
    | "campaign_critique";
  domain: "finance" | "consulting" | "product_management" | "marketing" | "strategy" | "operations";
  difficulty: "easy" | "medium" | "hard";
  minutes: number;
  scenario: string;
  instructions: string;
  expected_framework: string;
  /** key -> [weight, descriptor] */
  rubric: Record<string, [number, string]>;
}

const GUESSTIMATE_RUBRIC: Record<string, [number, string]> = {
  structure: [30, "Breaks the number into a chain of quantities that multiply to the answer, stated before any arithmetic."],
  assumptions: [30, "States each assumption explicitly with a reason. A defensible wrong number beats an unstated right one."],
  arithmetic: [20, "The maths is actually done and is correct given the assumptions."],
  sanity_check: [20, "Tests the answer against something known, and says what would move it most."],
};

const WAT_RUBRIC: Record<string, [number, string]> = {
  position: [25, "Takes a clear position in the opening and holds it."],
  argument: [35, "Reasons are distinct, ordered, and actually support the position."],
  evidence: [20, "Uses concrete examples or figures rather than assertion."],
  expression: [20, "Tight, readable prose. No padding, no throat-clearing."],
};

export const WRITTEN_SEEDS: WrittenSeed[] = [
  // ---- guesstimates -------------------------------------------------------
  {
    slug: "g-chai-cups-mumbai",
    title: "How many cups of chai are sold in Mumbai on a weekday?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "easy",
    minutes: 15,
    scenario:
      "You are asked this in the first ten minutes of a consulting interview. There is no data in the room and no internet. The interviewer wants to watch you think, not to check your answer against a source.\n\nMumbai's population is roughly 2 crore (20 million).",
    instructions:
      "Estimate the number of cups of chai sold in Mumbai on an ordinary weekday. Break the number down before you compute anything, state every assumption and why you chose it, do the arithmetic, then sanity-check the result.",
    expected_framework:
      "Segment the population by chai behaviour rather than treating it as one block: office-goers who buy 2-3 cups from a tapri, households who make it at home (and so buy none), students, and travellers. Multiply segment size by cups bought per person per day. Exclude home-made chai explicitly — it is the single biggest swing factor and the most common thing candidates forget to separate.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "g-ac-units-india-year",
    title: "How many air conditioners are sold in India in a year?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A durables client wants a sense of the market before commissioning real research. India's population is about 140 crore (1.4 billion), roughly 30 crore households.",
    instructions:
      "Estimate annual AC unit sales in India. Separate first-time buyers from replacement demand, and say which of your assumptions the answer is most sensitive to.",
    expected_framework:
      "Two independent streams that must be added, not confused: new penetration (households crossing the income threshold each year × units per household) and replacement (installed base ÷ average life). Candidates who model only penetration understate badly once the installed base is large. Segment households by income band and by climate zone — an AC is near-compulsory in Delhi and optional in Bengaluru.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "g-swiggy-orders-bengaluru",
    title: "How many food delivery orders happen in Bengaluru per day?",
    format: "guesstimate",
    domain: "product_management",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A product manager at a delivery platform is sizing a city before a pricing change. Bengaluru's population is roughly 1.3 crore (13 million).",
    instructions:
      "Estimate daily food delivery orders in Bengaluru across all platforms. Build it from the user side, then cross-check it from the supply side.",
    expected_framework:
      "Demand side: smartphone-owning population × share who order online × orders per week ÷ 7. Supply side as the cross-check: number of listed restaurants × orders per restaurant per day. The two should land within a factor of two; saying so, and explaining a gap, is worth more than either number alone.",
    rubric: GUESSTIMATE_RUBRIC,
  },

  // ---- root cause ---------------------------------------------------------
  {
    slug: "rca-signup-drop",
    title: "Signups fell 22% last Tuesday and have not recovered",
    format: "rca",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You run growth at a B2C subscription app. On Tuesday 12th, new signups fell 22% day-on-day and have stayed at the lower level for six days.\n\nWhat you know: traffic is flat. The signup page loads normally. Paid spend is unchanged. App store rating is unchanged at 4.3. A release shipped on the 11th containing a new onboarding screen, an analytics SDK upgrade, and a copy change on the pricing page. Support tickets are up 4%, all unrelated to signup.",
    instructions:
      "Diagnose the fall. Say what you would check first and why, what each result would rule in or out, and what you believe the most likely cause is. Do not propose fixes until you have named the cause.",
    expected_framework:
      "Separate 'fewer people tried' from 'fewer people succeeded' before anything else — traffic being flat already points at conversion, not acquisition. Then segment: platform, geography, funnel step. The release is the obvious suspect but contains three changes, and the analytics SDK upgrade is the trap: an instrumentation change can make signups *appear* to fall without any real drop. The strongest first check is whether a second, independent source (payments, database row count) shows the same fall.",
    rubric: {
      isolation: [30, "Narrows the problem before explaining it — segments, splits, and rules things out in a sensible order."],
      hypotheses: [25, "Generates competing causes rather than fixating on the first plausible one."],
      evidence: [25, "Says what each check would prove, not merely what it would show."],
      conclusion: [20, "Commits to a most-likely cause and names what would falsify it."],
    },
  },

  // ---- stock pitch --------------------------------------------------------
  {
    slug: "sp-listed-qsr-chain",
    title: "Pitch: a listed QSR chain trading at 62x earnings",
    format: "stock_pitch",
    domain: "finance",
    difficulty: "hard",
    minutes: 40,
    scenario:
      "A listed quick-service restaurant chain trades at 62x trailing earnings against a sector median of 38x. Revenue has grown 24% a year for three years, almost entirely from new store additions; same-store sales growth was 3% last year and 1% in the most recent quarter. Store count is 1,180, up from 610 three years ago. EBITDA margin has been flat at 14% through the expansion. Net debt is 1.2x EBITDA. A competitor announced 400 new stores in the same catchments.",
    instructions:
      "Write a buy or sell recommendation. State your thesis in the first two lines, then the evidence, then the two risks that would make you wrong and what you would watch to catch them early.",
    expected_framework:
      "The question is whether growth is coming from the concept or from the capital. Flat margins through a doubling of store count says scale is not yet being converted into operating leverage, and 1% same-store growth says new stores are not filling. A 62x multiple on store-count growth reprices sharply the moment additions slow. A strong pitch commits to a direction, prices it, and names the falsifier — the strongest bull case is that new stores are dilutive only during a maturation curve.",
    rubric: {
      thesis: [30, "A clear, falsifiable call in the opening, not a survey of considerations."],
      evidence: [30, "Uses the figures given and computes what they imply rather than restating them."],
      risks: [25, "Names what would make the call wrong and how it would be spotted early."],
      structure: [15, "Reads like a note a PM would act on: conclusion first, support after."],
    },
  },

  // ---- brand teardown -----------------------------------------------------
  {
    slug: "bt-premium-ev-two-wheeler",
    title: "Teardown: a premium EV two-wheeler brand losing share",
    format: "brand_teardown",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "An Indian electric two-wheeler brand launched at a premium, built early cult appeal through design and a direct-to-consumer model, and reached 18% category share. It has since fallen to 9%. Cheaper rivals now match the range figure. Its service network is 60 cities against a rival's 340. Brand recall is still the highest in the category. Its marketing continues to lead on design and technology.",
    instructions:
      "Pull the brand's positioning apart. Say what it stands for today, where the positioning has stopped matching how people actually buy, and what you would change — including what you would stop doing.",
    expected_framework:
      "Highest recall with falling share is the diagnostic: awareness is not the problem, so spending more on awareness is the wrong answer. The purchase barrier has moved from desire to confidence — service coverage on a vehicle you depend on daily. A strong teardown separates brand equity (intact) from the purchase funnel (broken at consideration), and is willing to say the design-led message should be cut back rather than added to.",
    rubric: {
      diagnosis: [30, "Identifies where in the funnel the brand is actually losing, using the evidence given."],
      positioning: [25, "Articulates what the brand stands for and to whom, concretely."],
      recommendation: [25, "Commits to changes, including something to stop."],
      commercial_sense: [20, "Recognises the cost and time of what is proposed."],
    },
  },

  // ---- memo ---------------------------------------------------------------
  {
    slug: "memo-warehouse-consolidation",
    title: "Memo: consolidate four warehouses into two?",
    format: "memo",
    domain: "operations",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You are chief of staff to the COO of a mid-sized distributor. Four regional warehouses cost ₹31 crore a year to run in total and hold ₹88 crore of inventory. Operations proposes consolidating into two, claiming ₹9 crore of annual savings and a ₹22 crore inventory release. Consolidation would push average delivery distance from 140 km to 265 km; the service promise is next-day. One-time cost is ₹14 crore.",
    instructions:
      "Write a one-page memo to the COO recommending a decision. Lead with the recommendation. Assume they will read the first three lines and nothing else if those three lines are weak.",
    expected_framework:
      "Recommendation first, then the two or three reasons, then what it depends on. The real question is whether next-day delivery survives 265 km, because a broken service promise costs revenue that does not appear in the ₹9 crore. Payback on ₹14 crore against ₹9 crore is under two years before the inventory release, which is attractive enough that the decision turns on service risk rather than on the arithmetic.",
    rubric: {
      bottom_line: [30, "Recommendation and rationale in the opening lines, readable on their own."],
      analysis: [30, "Engages the numbers given, including payback and the inventory release."],
      risk: [25, "Identifies the service-level exposure as the live issue, not the cost."],
      brevity: [15, "One page. Every sentence earns its place."],
    },
  },

  // ---- written ability ----------------------------------------------------
  {
    slug: "wat-ai-entry-level-hiring",
    title: "WAT: Should firms still hire entry-level analysts?",
    format: "wat",
    domain: "strategy",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A written ability test, twenty minutes, roughly 300 words. You are given a proposition and asked to argue.\n\n\"Automation has made the entry-level analyst role redundant. Firms should hire fewer graduates and more experienced staff.\"",
    instructions:
      "Argue for or against. Take a clear position, support it with distinct reasons and concrete examples, and address the strongest objection to your own view. Roughly 300 words.",
    expected_framework:
      "The strongest essays refuse the framing's hidden assumption — that the entry-level role exists to produce output rather than to produce senior staff. Cutting the intake solves a cost problem this year and creates a capability gap in five. Whichever side is taken, the objection must be met head-on rather than ignored, and examples should be specific.",
    rubric: WAT_RUBRIC,
  },
  {
    slug: "wat-profit-vs-purpose",
    title: "WAT: Is a company's only duty to its shareholders?",
    format: "wat",
    domain: "strategy",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A written ability test, twenty minutes, roughly 300 words.\n\n\"A company's only duty is to its shareholders. Everything else is public relations.\"",
    instructions:
      "Argue for or against. Take a clear position, support it with distinct reasons, and address the strongest objection to your own view. Roughly 300 words.",
    expected_framework:
      "Avoid the two easy failure modes: a list of stakeholder platitudes, or an economics-textbook restatement. The strongest essays make the argument concrete — where long-run shareholder interest and other duties actually diverge, and what a firm does then.",
    rubric: WAT_RUBRIC,
  },

  // ---- behavioural --------------------------------------------------------
  {
    slug: "beh-why-mba",
    title: "Why do you want an MBA?",
    format: "behavioural",
    domain: "strategy",
    difficulty: "easy",
    minutes: 10,
    scenario:
      "The second question in almost every placement interview, and the one most candidates answer with a rehearsed paragraph that could belong to anyone in the room.",
    instructions:
      "Write your answer as you would say it, in 150-250 words. Be specific to your own history: what you did, what it showed you that you lacked, and why this is the way to get it.",
    expected_framework:
      "A good answer is a chain: something concrete you did, a gap it exposed, why the MBA closes that gap, and what you intend to do after. Vague ambition ('grow as a leader', 'broaden my horizons') reads as an answer that would fit anybody. The test is whether a listener could distinguish your answer from the next candidate's.",
    rubric: {
      specificity: [35, "Grounded in the candidate's own history, not in general aspiration."],
      logic: [30, "The experience, the gap and the decision actually connect."],
      forward_view: [20, "Says what comes after, concretely enough to be asked about."],
      delivery: [15, "Sounds spoken, not recited. Right length."],
    },
  },
  {
    slug: "beh-failure-story",
    title: "Tell me about a time you failed",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 10,
    scenario:
      "Asked to find out whether you can hold responsibility without either collapsing or deflecting. The common failure is choosing a 'failure' that is secretly a success.",
    instructions:
      "Write your answer in 150-250 words using situation, action, result and what changed afterwards. Choose something that actually went wrong and that you owned.",
    expected_framework:
      "The interviewer is testing ownership and learning, not the size of the disaster. Answers that pick a disguised success ('I worked too hard') fail immediately. The strongest answers name the decision that was wrong, take responsibility without theatrical self-blame, and show a specific later behaviour that changed as a result.",
    rubric: {
      honesty: [30, "A real failure, genuinely owned, not a disguised success."],
      structure: [25, "Situation, action, result — followed without narrating the framework."],
      learning: [30, "A specific change in later behaviour, not a stated resolution."],
      delivery: [15, "Sounds spoken, not recited. Right length."],
    },
  },
];
