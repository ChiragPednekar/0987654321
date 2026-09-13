import type { WrittenSeed } from "./written-formats";

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

const BEHAVIOURAL_RUBRIC: Record<string, [number, string]> = {
  specificity: [35, "Grounded in the candidate's own history, not in general aspiration."],
  structure: [25, "Situation, action, result — followed without narrating the framework."],
  insight: [25, "Shows what the candidate actually took from it, concretely."],
  delivery: [15, "Sounds spoken, not recited. Right length."],
};

/** Second batch of written exercises. */
export const WRITTEN_SEEDS_MORE: WrittenSeed[] = [
  // ---- guesstimates -------------------------------------------------------
  {
    slug: "g-petrol-pumps-india",
    title: "How many petrol pumps are there in India?",
    format: "guesstimate",
    domain: "operations",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "An energy client wants a rough figure before commissioning a study. India's population is about 140 crore across roughly 6.5 lakh villages and around 4,500 towns and cities.",
    instructions:
      "Estimate the number of petrol pumps in India. Build it from vehicle demand or from geographic coverage, say which you chose and why, and sanity-check the result.",
    expected_framework:
      "Two routes. Demand-side: vehicles on the road × litres per vehicle per year ÷ throughput per pump per year. Supply-side: settlements × pumps per settlement, weighted by size. The demand route is more defensible because throughput per pump is a figure a candidate can reason about (a pump that sells less than a few thousand litres a day does not survive). A good answer picks one, mentions the other as a cross-check, and notes that rural coverage is driven by policy obligation rather than economics.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "g-wedding-market-india",
    title: "What is the annual size of the Indian wedding market?",
    format: "guesstimate",
    domain: "marketing",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "A consumer fund is looking at wedding-adjacent businesses and wants the total addressable spend. India's population is about 140 crore.",
    instructions:
      "Estimate annual wedding spending in India in rupees. Segment by spend tier rather than treating weddings as uniform, and say which segment carries most of the value.",
    expected_framework:
      "Number of weddings first: roughly 2% of the population marries each year, so about 1 crore weddings, though a candidate reasoning from the marriage-age cohort will get there more defensibly. Then segment by tier — a small number of very large weddings contributes disproportionately, so an average spend applied to all weddings badly understates the total. The strongest answers note that the distribution is heavily skewed and that the mean is the wrong statistic.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "g-tier2-gym-members",
    title: "How many paying gym members are there in a Tier 2 Indian city?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "easy",
    minutes: 15,
    scenario:
      "A fitness chain is choosing between expansion cities. Take a representative Tier 2 city of about 20 lakh people.",
    instructions:
      "Estimate the number of people paying for a gym membership in that city. Break the population down before computing, and say what would most change your answer.",
    expected_framework:
      "Filter the population down: working-age share, urban middle-income share, then penetration of paid fitness. Penetration is the assumption carrying all the weight and is far lower in Tier 2 than intuition suggests. A good answer distinguishes paying members from people who exercise, and flags that informal gyms may not be captured in the client's definition.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "g-atms-cash-withdrawn",
    title: "How much cash is withdrawn from ATMs in Delhi in a day?",
    format: "guesstimate",
    domain: "finance",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A bank is sizing its cash logistics contract. Delhi's population is about 2 crore.",
    instructions:
      "Estimate total daily ATM cash withdrawal in Delhi in rupees. Build from users and behaviour, then cross-check against ATM count and capacity.",
    expected_framework:
      "Demand: banked adults × withdrawal frequency × average withdrawal size. Cross-check: number of ATMs × transactions per ATM per day × average withdrawal. The two should reconcile. The interesting judgement is the direction of travel — UPI has cut withdrawal frequency sharply, and a candidate who assumes pre-digital behaviour will overstate by a wide margin.",
    rubric: GUESSTIMATE_RUBRIC,
  },

  // ---- root cause ---------------------------------------------------------
  {
    slug: "rca-margin-erosion",
    title: "Gross margin fell 4 points over two quarters with prices unchanged",
    format: "rca",
    domain: "finance",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "You support the CFO of a mid-sized manufacturer. Gross margin went from 38% to 34% across two quarters. List prices did not change. Volume is up 6%. The procurement head says input costs are flat on a per-kilogram basis. The plant reports no change in yield. The sales mix shifted: the newest product line went from 8% to 21% of volume. Freight cost per order rose 11%. A large customer renegotiated terms last quarter.",
    instructions:
      "Diagnose the erosion. Quantify what you can, rank the candidate causes by how much of the 4 points each could explain, and say what single piece of data would settle it.",
    expected_framework:
      "List price unchanged does not mean realised price unchanged — discounts, the renegotiated customer and mix all move realisation. The mix shift is the biggest suspect: a line going from 8% to 21% of volume will dominate the blended margin if its own margin is lower. The discipline being tested is decomposition — separate price, mix, cost and volume effects and size each, rather than naming a list of possibilities.",
    rubric: {
      decomposition: [35, "Separates price, mix, input cost and freight effects rather than listing causes."],
      quantification: [25, "Puts numbers on how much each candidate could explain."],
      ranking: [20, "Orders the causes by likely contribution, with reasons."],
      next_step: [20, "Names the one piece of data that would settle it."],
    },
  },
  {
    slug: "rca-churn-spike",
    title: "Enterprise churn doubled in one quarter",
    format: "rca",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You run customer success at a B2B SaaS firm. Quarterly logo churn went from 3% to 6%. Net revenue retention fell from 112% to 97%. NPS is unchanged at 41. Support ticket volume is flat. Nine of the fourteen churned accounts were signed in the same two-month window eighteen months ago. Pricing was changed nine months ago for new customers only. A competitor launched an aggressive migration offer last quarter.",
    instructions:
      "Diagnose the spike. Say what the cohort concentration tells you, what it does not, and what you would check first.",
    expected_framework:
      "Nine of fourteen from one signing window is the loudest signal in the data — it points at a cohort with something in common (a channel, a discount, a since-departed sales team, an eighteen-month contract term all expiring together) rather than at a product-wide problem. Unchanged NPS and flat tickets argue against product deterioration. The competitor offer is a plausible trigger but does not explain the cohort concentration on its own.",
    rubric: {
      isolation: [30, "Uses the cohort concentration properly instead of treating churn as uniform."],
      hypotheses: [25, "Generates competing causes and tests them against the evidence given."],
      evidence: [25, "Says what each check would prove, not merely what it would show."],
      conclusion: [20, "Commits to a most-likely cause and names what would falsify it."],
    },
  },

  // ---- stock pitch --------------------------------------------------------
  {
    slug: "sp-it-services-major",
    title: "Pitch: an Indian IT services major at a decade-low multiple",
    format: "stock_pitch",
    domain: "finance",
    difficulty: "hard",
    minutes: 40,
    scenario:
      "A large Indian IT services company trades at 18x earnings against its own ten-year average of 26x. Revenue growth has slowed from 15% to 4%. Headcount fell 3% last year while revenue was flat, so revenue per employee rose. Operating margin improved 120 basis points. The order book is at a record, but the average contract tenure has shortened. Attrition has fallen from 24% to 12%. Management attributes the slowdown to client caution on discretionary spend, and has guided to a recovery in the second half.",
    instructions:
      "Write a buy or sell recommendation. Thesis in the first two lines, then the evidence, then the two risks that would make you wrong and what you would watch to catch them early.",
    expected_framework:
      "The tension is between improving efficiency metrics and deteriorating growth. Rising revenue per employee with falling headcount can mean genuine productivity or it can mean the firm is harvesting rather than investing. A record order book with shorter tenure is genuinely ambiguous — more work, less locked in. The strongest pitches take a view on whether the de-rating prices in a cyclical pause or a structural change in how clients buy, and say explicitly which they believe.",
    rubric: {
      thesis: [30, "A clear, falsifiable call in the opening, not a survey of considerations."],
      evidence: [30, "Uses the figures given and computes what they imply rather than restating them."],
      risks: [25, "Names what would make the call wrong and how it would be spotted early."],
      structure: [15, "Reads like a note a PM would act on: conclusion first, support after."],
    },
  },

  // ---- brand teardown -----------------------------------------------------
  {
    slug: "bt-legacy-biscuit-brand",
    title: "Teardown: a 60-year-old biscuit brand losing young buyers",
    format: "brand_teardown",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "A biscuit brand founded in the 1960s holds 22% value share and the highest household penetration in its category. Buyers over 45 are loyal and buying more. Buyers under 30 have fallen from 31% of volume to 18% in five years. The brand is priced 8% below the category leader. Its packaging and advertising are largely unchanged in a decade. A range of premium and 'healthy' entrants has taken most of the under-30 volume.",
    instructions:
      "Pull the brand's positioning apart. Say what it stands for today, why younger buyers are leaving, and what you would change — including what you would refuse to change.",
    expected_framework:
      "The trap is recommending a wholesale modernisation that alienates the loyal, high-frequency older base which currently pays the bills. A strong teardown separates the equity worth protecting (trust, familiarity, penetration) from the barrier with younger buyers (irrelevance and a value-brand price signal, not price itself), and is willing to argue for a separate sub-brand rather than repositioning the mother brand.",
    rubric: {
      diagnosis: [30, "Identifies where in the funnel the brand is actually losing, using the evidence given."],
      positioning: [25, "Articulates what the brand stands for and to whom, concretely."],
      recommendation: [25, "Commits to changes, including something to protect or refuse."],
      commercial_sense: [20, "Recognises the cost and risk of what is proposed."],
    },
  },

  // ---- memo ---------------------------------------------------------------
  {
    slug: "memo-free-tier-decision",
    title: "Memo: should we kill the free tier?",
    format: "memo",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You are chief of staff to the CEO of a B2B SaaS company. The free tier has 180,000 accounts and costs ₹4.2 crore a year to serve. It converts 1.8% to paid within twelve months. Paid ARPU is ₹36,000 a year. Sales says 40% of enterprise deals began with someone on the free tier. Finance wants it closed. Product says closing it would end inbound growth.",
    instructions:
      "Write a one-page memo recommending a decision. Lead with the recommendation. Assume the CEO reads the first three lines and nothing more if those three lines are weak.",
    expected_framework:
      "Do the arithmetic: 1.8% of 180,000 is 3,240 conversions at ₹36,000, which is ₹11.7 crore against a ₹4.2 crore cost — the direct case already pays for itself before the enterprise-influence argument. The real question is not whether to keep it but whether the cost per free account can be cut, and whether the 40% enterprise figure is causal or merely correlated. A good memo commits and names the weak evidence.",
    rubric: {
      bottom_line: [30, "Recommendation and rationale in the opening lines, readable on their own."],
      analysis: [30, "Engages the numbers given and computes the direct return."],
      risk: [25, "Identifies which piece of evidence is weakest and what would test it."],
      brevity: [15, "One page. Every sentence earns its place."],
    },
  },
  {
    slug: "memo-price-rise-communication",
    title: "Memo: a 9% price rise to the top 20 customers",
    format: "memo",
    domain: "strategy",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "Input costs have risen 14% over eighteen months. Your top 20 customers are 62% of revenue and are on annual contracts, twelve of which renew within four months. Gross margin has fallen from 31% to 24%. A 9% price rise would restore margin. Two of the twenty have publicly tendered for alternative suppliers in the past year. Switching costs for customers are moderate: about three months of qualification.",
    instructions:
      "Write a one-page memo to the commercial director recommending how to take the price rise — or not to. Lead with the recommendation.",
    expected_framework:
      "A flat 9% across twenty accounts of very different risk is the weak answer. The strongest memos segment: take more from accounts with high switching costs and no live tender, less or later from the two that have tested the market, and sequence by renewal date so the firm is not renegotiating twelve contracts at once. Losing one large account can cost more than the entire margin recovery, which is the calculation that should appear.",
    rubric: {
      bottom_line: [30, "Recommendation and rationale in the opening lines, readable on their own."],
      analysis: [30, "Engages the numbers and weighs margin recovery against revenue at risk."],
      risk: [25, "Segments the accounts rather than treating the twenty as one."],
      brevity: [15, "One page. Every sentence earns its place."],
    },
  },

  // ---- WAT ----------------------------------------------------------------
  {
    slug: "wat-gig-economy-regulation",
    title: "WAT: Should gig workers be classified as employees?",
    format: "wat",
    domain: "strategy",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A written ability test, twenty minutes, roughly 300 words.\n\n\"Platform companies should be required to classify gig workers as employees, with the benefits that follow.\"",
    instructions:
      "Argue for or against. Take a clear position, support it with distinct reasons and concrete examples, and address the strongest objection to your own view. Roughly 300 words.",
    expected_framework:
      "The strongest essays engage the actual trade-off rather than asserting a side: employment status brings security and removes flexibility, and the workers themselves are divided on which they want. Weak essays list benefits without cost, or assert that platforms would simply absorb the expense.",
    rubric: WAT_RUBRIC,
  },
  {
    slug: "wat-work-from-office",
    title: "WAT: Is the return-to-office mandate justified?",
    format: "wat",
    domain: "strategy",
    difficulty: "easy",
    minutes: 20,
    scenario:
      "A written ability test, twenty minutes, roughly 300 words.\n\n\"Companies mandating a return to office are protecting culture. Employees resisting are protecting convenience.\"",
    instructions:
      "Argue for or against. Take a clear position, support it with distinct reasons, and address the strongest objection to your own view. Roughly 300 words.",
    expected_framework:
      "The proposition is loaded — it assigns a noble motive to one side and a petty one to the other. Strong essays notice the framing and refuse it, then argue on evidence: what is actually lost remotely, for whom, and whether attendance is a proxy anyone has validated.",
    rubric: WAT_RUBRIC,
  },
  {
    slug: "wat-reservation-private-sector",
    title: "WAT: Should Indian industry adopt diversity targets voluntarily?",
    format: "wat",
    domain: "strategy",
    difficulty: "hard",
    minutes: 20,
    scenario:
      "A written ability test, twenty minutes, roughly 300 words.\n\n\"Indian companies should set and publish their own diversity targets rather than wait for regulation.\"",
    instructions:
      "Argue for or against. Take a clear position, support it with distinct reasons and concrete examples, and address the strongest objection to your own view. Roughly 300 words.",
    expected_framework:
      "A sensitive topic where the marking rewards argument quality, not the position taken. Strong essays distinguish targets from quotas, engage seriously with the measurement problem, and address the strongest counter — that voluntary targets without consequences become public relations.",
    rubric: WAT_RUBRIC,
  },

  // ---- behavioural --------------------------------------------------------
  {
    slug: "beh-tell-me-about-yourself",
    title: "Tell me about yourself",
    format: "behavioural",
    domain: "strategy",
    difficulty: "easy",
    minutes: 10,
    scenario:
      "The first question in almost every interview, and the one most candidates waste by reciting their CV, which the interviewer has already read.",
    instructions:
      "Write your answer as you would say it, in 150-250 words. Give a through-line, not a chronology: what you have been building towards and why the next step follows from it.",
    expected_framework:
      "The CV is already in the interviewer's hand, so repeating it adds nothing. A strong answer has a spine — an interest or capability that connects two or three choices — and lands on why this role is the next step. It should invite a follow-up question rather than close the subject.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-conflict-with-teammate",
    title: "Tell me about a disagreement with a teammate",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 10,
    scenario:
      "Asked to see whether you can disagree without damaging a working relationship. The common failure is choosing a disagreement where you were obviously right.",
    instructions:
      "Write your answer in 150-250 words using situation, action, result. Show what you did to understand the other position, not only how you won.",
    expected_framework:
      "Choosing a conflict where you were plainly correct answers a different question. The strongest answers show genuine engagement with the other view, a decision process rather than a victory, and a relationship that survived. Blaming the teammate is disqualifying.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-leadership-without-authority",
    title: "Describe a time you led without formal authority",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 10,
    scenario:
      "Common in consulting and product interviews, where almost all early work involves influencing people who do not report to you.",
    instructions:
      "Write your answer in 150-250 words. Be concrete about how you got agreement from people who did not have to give it.",
    expected_framework:
      "The interviewer wants the mechanism: what you actually did to build agreement — evidence, a pilot, addressing someone's specific objection. Answers that describe the outcome without the method ('I motivated the team') fail. Naming who resisted and why is a strong signal.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-why-this-firm",
    title: "Why this firm, and not its closest competitor?",
    format: "behavioural",
    domain: "strategy",
    difficulty: "hard",
    minutes: 10,
    scenario:
      "The question that separates candidates who have researched the firm from those who have researched the industry. Generic praise is heard as a lack of interest.",
    instructions:
      "Pick a real firm you would apply to. Write your answer in 150-250 words, naming something specific about that firm that would not be true of its closest competitor.",
    expected_framework:
      "Prestige, culture and 'people' are said by everyone and distinguish nothing. A strong answer names something checkable — a practice area, a client sector, a way of staffing, a recent piece of work — and connects it to the candidate's own interest. The test is whether the answer would still make sense if the competitor's name were swapped in; if it would, it has failed.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-greatest-weakness",
    title: "What is your greatest weakness?",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 10,
    scenario:
      "Asked to test self-awareness and honesty. Nearly every candidate answers with a strength in disguise, and every interviewer has heard it.",
    instructions:
      "Write your answer in 150-250 words. Name a real weakness, its actual cost, and what you do to manage it.",
    expected_framework:
      "'I work too hard' and 'I am a perfectionist' are heard as evasions and cost more than an honest answer would. A strong response names something real but not disqualifying for the role, shows awareness of its cost to others, and describes a concrete management mechanism rather than an intention to improve.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
];
