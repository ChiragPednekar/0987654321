import type { WrittenSeed } from "./written-formats";

/**
 * Written-format expansion. Every format that sat at two or three scenarios —
 * thin enough that a student working through a track exhausted it in one
 * sitting and started seeing repeats.
 *
 * Rubrics are restated here rather than imported because the existing banks
 * declare theirs as file-local consts. The weights match the established ones
 * exactly, so a stock pitch is marked the same whichever file its scenario
 * happens to live in. (Worth unifying one day; duplicating a rubric is how a
 * format quietly ends up marked two different ways.)
 *
 * Every company is invented or described generically, as in the existing
 * banks. A pitch that says "sell" about a real listed company would be a claim
 * about that company rather than a practice problem.
 */

const GUESSTIMATE_RUBRIC: Record<string, [number, string]> = {
  structure: [30, "Breaks the number into a chain of quantities that multiply to the answer, stated before any arithmetic."],
  assumptions: [30, "States each assumption explicitly with a reason. A defensible wrong number beats an unstated right one."],
  arithmetic: [20, "Computes cleanly, carries units, and keeps the magnitudes straight."],
  sanity: [20, "Checks the result against something known and says whether it looks too high or too low."],
};

const WAT_RUBRIC: Record<string, [number, string]> = {
  position: [30, "Takes a clear position in the opening lines rather than surveying both sides and stopping."],
  argument: [30, "Supports the position with reasons and examples that actually bear on it."],
  balance: [20, "Acknowledges the strongest counter-argument and answers it."],
  expression: [20, "Clear, economical prose within the word limit, organised into coherent paragraphs."],
};

const BEHAVIOURAL_RUBRIC: Record<string, [number, string]> = {
  situation: [20, "Sets the context concretely — where, when, what was at stake — without a long preamble."],
  action: [35, "Says what THEY did, in the first person singular, with the reasoning behind each choice."],
  result: [25, "Gives an outcome with a number or an observable consequence, not 'it went well'."],
  reflection: [20, "Says what they would do differently and what the experience changed about how they work."],
};

const RCA_RUBRIC: Record<string, [number, string]> = {
  isolation: [30, "Narrows the problem down the funnel or the segment tree before theorising about causes."],
  hypotheses: [25, "Generates causes that are mutually exclusive and could each be tested with available data."],
  evidence: [25, "Uses the figures given to rule causes in or out rather than asserting one."],
  action: [20, "Ends with what to do next and what would confirm the diagnosis."],
};

const STOCK_PITCH_RUBRIC: Record<string, [number, string]> = {
  thesis: [30, "A clear, falsifiable call in the opening, not a survey of considerations."],
  evidence: [30, "Uses the figures given and computes what they imply rather than restating them."],
  risks: [25, "Names what would make the call wrong and how it would be spotted early."],
  structure: [15, "Reads like a note a PM would act on: conclusion first, support after."],
};

const BRAND_TEARDOWN_RUBRIC: Record<string, [number, string]> = {
  diagnosis: [30, "Identifies what the brand actually stands for today, from evidence rather than from the brand's own claims."],
  gap: [25, "Names the gap between the promise and the experience, or between the target and the actual buyer."],
  recommendation: [30, "Proposes specific changes with reasons, and says what should stay untouched."],
  feasibility: [15, "Checks the recommendation against cost, channel and the existing customer base."],
};

const MEMO_RUBRIC: Record<string, [number, string]> = {
  recommendation: [30, "Opens with the decision being asked for, stated in one sentence."],
  reasoning: [30, "Three or four reasons that stand on the evidence given, in descending order of weight."],
  objections: [20, "Anticipates the reader's strongest objection and answers it in the memo."],
  brevity: [20, "Fits the length, has no throat-clearing, and could be acted on without a meeting."],
};

const PRODUCT_SENSE_RUBRIC: Record<string, [number, string]> = {
  user: [25, "Chooses a specific user segment and a specific problem before proposing anything, and says why that segment."],
  insight: [25, "Identifies a real need or pain point with a reason it is unmet today, not a generic 'users want convenience'."],
  solution: [25, "Proposes a concrete solution tied to the need, and prioritises within it rather than listing features."],
  tradeoffs_metrics: [25, "Names what the solution costs or risks and how success would be measured."],
};

const METRICS_RUBRIC: Record<string, [number, string]> = {
  north_star: [30, "Picks one primary metric that captures value delivered to users, and explains why it beats the obvious alternatives."],
  tree: [30, "Breaks it into input metrics a team can actually move, in a coherent hierarchy."],
  guardrails: [20, "Names the counter-metrics that would expose gaming or harm, and why each matters here."],
  judgement: [20, "Says what they would do if the numbers disagreed, and avoids vanity metrics."],
};

const PRIORITISATION_RUBRIC: Record<string, [number, string]> = {
  criteria: [25, "Sets explicit criteria tied to the stated goal before ranking anything."],
  evaluation: [30, "Applies the criteria to each option honestly, using the figures given, including effort and risk."],
  decision: [25, "Commits to an order and says clearly what is not being done and why."],
  communication: [20, "Explains how the decision would be defended to the stakeholders who lose out."],
};

const RESEARCH_NOTE_RUBRIC: Record<string, [number, string]> = {
  call: [25, "States rating, target value and the core thesis in the opening lines."],
  valuation: [30, "Derives the target from the figures given with a clear method, and shows the arithmetic."],
  drivers: [25, "Identifies the two or three variables the thesis actually depends on, with evidence."],
  risks: [20, "Names what would break the call and the signal that would show it early."],
};

const GTM_RUBRIC: Record<string, [number, string]> = {
  segment: [25, "Chooses a beachhead customer segment and justifies it over the alternatives."],
  proposition: [20, "States the value proposition and pricing in terms that segment cares about."],
  channels: [30, "Picks channels and a sequence that fit the segment and the budget, with rough economics."],
  milestones: [25, "Sets measurable milestones and says what result would change the plan."],
};

const MARKETING_MIX_RUBRIC: Record<string, [number, string]> = {
  diagnosis: [25, "Works out from the figures which part of the mix is actually causing the problem."],
  consistency: [25, "Keeps product, price, place and promotion consistent with each other and with the target customer."],
  recommendation: [30, "Makes specific changes with reasons, rather than touching every lever."],
  economics: [20, "Checks the recommendation against margin or unit economics."],
};

const CAMPAIGN_CRITIQUE_RUBRIC: Record<string, [number, string]> = {
  objective: [25, "Establishes what the campaign was trying to achieve before judging whether it worked."],
  evidence: [30, "Reads the numbers given and says what they do and do not show."],
  critique: [25, "Separates the idea from the execution and from the media choice."],
  alternative: [20, "Proposes what should have been done instead, at the same budget."],
};

export const WRITTEN_SEEDS_EXPANSION: WrittenSeed[] = [
  // ---- stock pitch --------------------------------------------------------
  {
    slug: "sp-cement-capacity-cycle",
    title: "Pitch: a cement maker at the top of a capacity cycle",
    format: "stock_pitch",
    domain: "finance",
    difficulty: "hard",
    minutes: 40,
    scenario:
      "A regional cement producer trades at 14x EV/EBITDA against a five-year median of 9x. Volumes grew 11% last year on a capacity utilisation of 88%, the highest in a decade. Realisation per tonne rose 7%. The company has announced a greenfield plant adding 40% to capacity, commissioning in 30 months, funded by debt that takes net debt from 0.8x to 2.1x EBITDA. Two competitors in the same region announced expansions within the same quarter. Coal and freight together are 42% of cost and have fallen 18% over the year.",
    instructions:
      "Write a buy or sell recommendation. State the call in the first two lines, then the evidence, then the two risks that would make you wrong and what you would watch to catch them early.",
    expected_framework:
      "The tension is that everything good here is cyclical and everything committed is structural. Utilisation at 88%, rising realisations and falling input costs are all peak-cycle conditions, and the multiple has rerated to match. Meanwhile three producers are adding capacity into the same region with a 30-month lag — the classic setup for realisations to break just as the debt lands. A strong pitch prices the cycle rather than the year: what does EBITDA look like at mid-cycle utilisation and normalised coal? The bull case is that regional demand absorbs the additions and the freight advantage of a local plant is real. Either way the falsifier is observable — quarterly realisation per tonne, and whether the competing plants actually get commissioned.",
    rubric: STOCK_PITCH_RUBRIC,
  },
  {
    slug: "sp-lending-nbfc-growth",
    title: "Pitch: an NBFC growing its book 40% a year",
    format: "stock_pitch",
    domain: "finance",
    difficulty: "hard",
    minutes: 40,
    scenario:
      "A non-bank lender in used-vehicle finance has grown its loan book 40% a year for three years to Rs 18,000 crore. Gross NPAs are 1.9%, down from 3.4% three years ago. Net interest margin is 7.8%. Cost of funds has risen 90 basis points over the year and the company has passed on 40 basis points. Average loan tenure is 42 months. Provision coverage is 52%. The stock trades at 3.4x book against a sector median of 2.1x. Eighty per cent of incremental disbursement in the last year went to first-time borrowers with no formal credit history.",
    instructions:
      "Write a buy or sell recommendation. Lead with the call, support it with the figures given, and name what would make you wrong.",
    expected_framework:
      "The central question is whether the falling NPA ratio is credit quality or arithmetic. A book growing 40% a year has a denominator that outruns the numerator: loans written this year have not had time to go bad, so a rapidly growing book mechanically reports a falling NPA percentage. Against 42-month tenure and 80% first-time borrowers, the vintage is untested. Margin is also compressing — 90 basis points of cost absorbed against 40 passed on. A strong pitch asks what NPAs look like on a static-pool basis and what coverage of 52% implies if they normalise. The bull case is genuine underwriting edge in a segment banks cannot serve.",
    rubric: STOCK_PITCH_RUBRIC,
  },
  {
    slug: "sp-saas-decelerating",
    title: "Pitch: a SaaS company whose growth is slowing",
    format: "stock_pitch",
    domain: "finance",
    difficulty: "medium",
    minutes: 35,
    scenario:
      "An enterprise software company grew revenue 46%, 38% and 29% in the last three years. Net revenue retention has fallen from 128% to 111%. Gross margin is steady at 78%. Sales and marketing is 52% of revenue, up from 44%. The company turned free-cash-flow positive last quarter for the first time. It trades at 9x forward revenue against a peer median of 6x. Customer count grew 34% last year while revenue grew 29%.",
    instructions:
      "Write a buy or sell recommendation with the call in the opening lines, the evidence, and the risks that would falsify it.",
    expected_framework:
      "Customers growing faster than revenue means average contract value is falling — the company is adding smaller customers, which fits net revenue retention dropping 17 points. Rising sales and marketing as a share of revenue against decelerating growth says each rupee of new revenue is getting more expensive. The bull case is that the first free-cash-flow quarter marks a deliberate shift from growth to efficiency and the multiple should hold on that. The bear case is that 9x forward revenue prices growth the company no longer has. A strong pitch picks one and names the quarter's data that would settle it.",
    rubric: STOCK_PITCH_RUBRIC,
  },

  // ---- brand teardown -----------------------------------------------------
  {
    slug: "bt-heritage-tea-brand",
    title: "Teardown: a heritage tea brand losing young buyers",
    format: "brand_teardown",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "A 70-year-old packaged tea brand holds 22% share of the value segment in its home state and 4% nationally. Its advertising has used the same family-reunion theme for two decades. Buyers under 30 index at half the national average. Its price is 8% below the market leader. Modern trade is 11% of its sales against 34% for the category. A new direct-to-consumer brand selling single-estate tea at four times the price has taken 2% national share in 18 months, almost entirely from buyers under 35 in metros.",
    instructions:
      "Diagnose what the brand stands for today, name the gap that is costing it younger buyers, and recommend what to change and what to leave alone.",
    expected_framework:
      "The weak answer chases the D2C entrant with a premium line and abandons the position that funds the business. The brand's actual equity is trust and familiarity in its home market, which is worth defending. The gap is distribution and occasion, not messaging: 11% modern trade against a category at 34% means younger urban buyers physically do not encounter it. A strong teardown separates the value core (keep the price, keep the heritage, fix availability) from a genuinely different occasion — office, gifting, single-serve — and says what it would cost. It also questions whether 2% national share taken by a four-times-price brand is competition for the same buyer at all.",
    rubric: BRAND_TEARDOWN_RUBRIC,
  },
  {
    slug: "bt-fitness-chain-positioning",
    title: "Teardown: a gym chain caught in the middle",
    format: "brand_teardown",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "A gym chain operates 90 clubs across eight cities at Rs 2,400 a month. Below it, budget chains charge Rs 900 with basic equipment. Above it, boutique studios charge Rs 6,000 for classes with named trainers. Membership has been flat for two years; renewals are 38%. Exit surveys say 'not using it enough' more than any other reason. Average visits per member per month is 4.2. Its advertising emphasises equipment breadth and club count.",
    instructions:
      "Work out what the brand stands for today, name the gap, and recommend specific changes with reasons. Say what should not change.",
    expected_framework:
      "Renewals of 38% against 4.2 visits a month is the whole diagnosis: people are not leaving because of price or equipment, they are leaving because they did not build a habit. Advertising equipment breadth speaks to a purchase decision the member has already made and says nothing about the usage problem. The middle position is defensible — it is the pricing that is stuck, not the brand — if the promise changes from access to attendance. Structured programmes, booked slots, cohorts and accountability are what the boutique competitor is actually selling at Rs 6,000. Strong answers say what to stop paying for (equipment breadth advertising) to fund it.",
    rubric: BRAND_TEARDOWN_RUBRIC,
  },
  {
    slug: "bt-regional-airline-service",
    title: "Teardown: an airline whose promise and experience disagree",
    format: "brand_teardown",
    domain: "marketing",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "A regional airline positions itself on 'the warmest crew in the sky' and spends 60% of its marketing budget on that message. On-time performance is 71% against a market average of 82%. Net promoter score is +12 overall, but −30 among passengers whose flight was delayed more than an hour, which is 19% of passengers. Crew ratings in post-flight surveys average 4.6 out of 5. Fares are at market. Complaints about rebooking and communication during disruption are the largest single category.",
    instructions:
      "Diagnose the brand as it is experienced, name the gap between promise and delivery, and recommend what to change.",
    expected_framework:
      "The crew claim is true — 4.6 out of 5 — which is what makes this interesting. The brand is not lying; it is promising on a dimension that cannot survive the moment it matters most. Warmth is experienced in the cabin and irrelevant at a rebooking desk, and 19% of passengers leave with an NPS of −30. Strong answers see that the marketing budget is buying a promise the operation cannot keep during disruption, and redirect it to the disruption experience itself — proactive rebooking, communication, compensation — which is where warmth would actually be proved. Weak answers recommend fixing on-time performance, which is an operations programme, not a brand recommendation, and does not address the 71% that will still be late.",
    rubric: BRAND_TEARDOWN_RUBRIC,
  },

  // ---- root cause analysis ------------------------------------------------
  {
    slug: "rca-delivery-time-slip",
    title: "Delivery times have slipped in one city",
    format: "rca",
    domain: "operations",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "A food delivery platform's median delivery time in one city rose from 28 to 39 minutes over six weeks. Order volume is flat. Rider count is up 4%. Restaurant preparation time is unchanged at a median of 11 minutes. The rise is concentrated in one of the city's five zones, where median time went from 26 to 51 minutes. That zone added 40 new restaurant partners in the period, mostly in a single high-rise commercial complex. Rider acceptance rate in the zone fell from 88% to 61%.",
    instructions:
      "Isolate where the problem is, give the two or three causes worth testing, say which the data supports, and recommend what to do next.",
    expected_framework:
      "The isolation is handed over: one zone, not the city. The interesting figure is acceptance rate collapsing to 61% — riders are declining these orders, which means something about them is unattractive. Forty new restaurants in a single high-rise commercial complex is the likely mechanism: tower pickups mean lifts, security desks and long walks that are unpaid waiting time for the rider. Preparation time being unchanged rules out the kitchens. Rider count up 4% rules out raw supply. Strong answers test the hypothesis with pickup-to-dispatch time inside that complex specifically, and recommend paying for the waiting rather than adding riders.",
    rubric: RCA_RUBRIC,
  },
  {
    slug: "rca-support-ticket-surge",
    title: "Support tickets doubled without a release",
    format: "rca",
    domain: "operations",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "A B2B software company's support tickets rose from 1,200 to 2,500 a month. No release shipped in the period. Active accounts grew 6%. The increase is almost entirely 'how do I' questions rather than bug reports. Tickets from accounts older than a year are flat; the rise is in accounts onboarded in the last four months. The company changed onboarding three months earlier from a live 90-minute session to a self-serve video series, to cut cost. Activation rate — accounts completing setup within 14 days — is unchanged at 71%.",
    instructions:
      "Isolate the problem, give the causes worth testing, say which the evidence supports, and recommend a next step.",
    expected_framework:
      "The segmentation is decisive: old accounts flat, new accounts driving it, and the onboarding change lands in the same window. Activation being unchanged is the trap — it says people still finish setup, so the change looks successful on the metric it was judged by, while the cost has moved downstream into support. Strong answers name that the saving was not a saving but a transfer, and quantify it: 1,300 extra tickets a month against the cost of the live sessions removed. The next step is not restoring the old onboarding wholesale but finding which parts of the 90 minutes the videos failed to carry, which the ticket topics will show.",
    rubric: RCA_RUBRIC,
  },
  {
    slug: "rca-conversion-drop-mobile",
    title: "Checkout conversion fell on mobile only",
    format: "rca",
    domain: "product_management",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "An e-commerce site's checkout conversion fell from 3.1% to 2.4% over two weeks. Desktop is unchanged at 4.0%. Mobile fell from 2.8% to 1.9%. Traffic mix is unchanged. Add-to-cart rate is unchanged on both. The drop is entirely between the payment page and order confirmation. A payment provider was added three weeks ago and now handles 45% of mobile transactions. Its published success rate is 94% against the incumbent's 97%. Mobile page load time rose from 2.1 to 3.8 seconds on the payment page in the same period.",
    instructions:
      "Isolate the failure, list the candidate causes, use the figures to rule them in or out, and say what you would do next.",
    expected_framework:
      "Two candidate causes arrive together, which is the point. The provider's 3-point success gap on 45% of transactions explains roughly 1.35 points of a 45-point relative fall — real but not the whole story. The load time nearly doubling on the payment page specifically is the larger suspect and would hit mobile far harder than desktop. Strong answers separate them with data that already exists: payment success rate by provider, and conversion by load-time bucket. Weak answers pick the new provider because it is the obvious change and stop. The recommendation should be able to act on both without waiting for a perfect attribution.",
    rubric: RCA_RUBRIC,
  },

  // ---- memo ---------------------------------------------------------------
  {
    slug: "memo-four-day-week-pilot",
    title: "Memo: whether to run a four-day-week pilot",
    format: "memo",
    domain: "strategy",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You lead a 240-person services firm. Attrition is 26% against an industry 19%, and exit interviews cite burnout most often. A four-day week at full pay has been proposed for the 90-person delivery team as a six-month pilot. Utilisation would need to rise from 68% to 85% to hold revenue flat. Two competitors have announced similar pilots. Recruiting cost is Rs 1.4 lakh per replacement hire. Client contracts specify response times, not working days.",
    instructions:
      "Write a one-page memo to the board recommending for or against the pilot. Open with the recommendation. Anticipate the strongest objection.",
    expected_framework:
      "The decision turns on whether 68% to 85% utilisation is plausible or wishful. That is a 25% productivity improvement asserted, not evidenced, and a memo that waves at it has not done the work. Against it sits a real number: 26% attrition on 240 people at Rs 1.4 lakh a replacement is roughly Rs 87 lakh a year. The strongest objection is client response times, which the scenario quietly answers — contracts specify response, not days, so coverage can be staggered. A good memo commits, sizes the downside of the pilot specifically (six months, 90 people, measurable), and names the metric that would end it early.",
    rubric: MEMO_RUBRIC,
  },
  {
    slug: "memo-exit-a-product-line",
    title: "Memo: whether to discontinue a product line",
    format: "memo",
    domain: "strategy",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "A hardware company's accessories line does Rs 34 crore of revenue at 9% gross margin, against the core product's Rs 210 crore at 41%. Accessories consume 30% of support tickets and 25% of engineering time. Forty per cent of accessory buyers are also core-product customers. A survey suggests 15% of core customers say accessories availability influenced their purchase. Discontinuing would free engineering capacity equivalent to six people and write off Rs 6 crore of inventory.",
    instructions:
      "Write a one-page memo recommending whether to discontinue the line. Lead with the decision and answer the strongest objection against it.",
    expected_framework:
      "The gross margin comparison is the obvious argument and the weakest one, because it ignores the attach effect. The real question is how much core revenue the accessories defend: 15% of core customers claiming influence is a stated preference, not a revealed one, and a memo that takes it at face value is being led. Strong answers separate the two claims and propose a test — discontinue the weakest SKUs, or a region — rather than treating it as an all-or-nothing call. The strongest objection is the 40% overlap, and it deserves an answer, not a dismissal. Whatever the recommendation, the Rs 6 crore write-off is sunk the moment the decision is made and should not drive it.",
    rubric: MEMO_RUBRIC,
  },
  {
    slug: "memo-office-return-policy",
    title: "Memo: setting a return-to-office policy",
    format: "memo",
    domain: "strategy",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "Your 400-person technology team has worked fully remotely for three years. Leadership wants three days a week in office. Engineering output per sprint is flat over the period. Attrition is 14%, below the industry's 21%. An internal survey shows 61% would look for another job if required in three days a week, rising to 78% among those who moved out of the city. Office lease costs Rs 2.9 crore a year and is 22% occupied. New-joiner ramp time has risen from 5 to 8 weeks.",
    instructions:
      "Write a one-page memo recommending a policy. Open with it, give your reasons in order of weight, and answer the strongest objection.",
    expected_framework:
      "Only one piece of evidence supports the mandate — ramp time rising from 5 to 8 weeks — and a good memo finds it rather than arguing purely against leadership. Everything else points the other way: flat output, below-market attrition, and a survey saying the policy would cost a majority of the team. The 61% is a stated intention and should be discounted, but not to zero when 78% of relocated staff say it. Strong answers propose something targeted at the actual problem — in-person onboarding for the first eight weeks, team-level rather than company-level presence — and address the lease honestly, since Rs 2.9 crore at 22% occupancy is a sunk commitment that should not set headcount policy.",
    rubric: MEMO_RUBRIC,
  },

  // ---- product sense ------------------------------------------------------
  {
    slug: "ps-upi-for-small-merchants",
    title: "Design a payments product for a street vendor",
    format: "product_sense",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You are a product manager at a payments company. Street vendors and small stall owners accept digital payments through a QR sticker, but 30% of them still prefer cash and a further 20% accept digital payments and immediately withdraw the full balance. Most operate single-handed, cannot leave the stall during trading hours, and reconcile takings by memory at the end of the day.",
    instructions:
      "Design a product or feature for this segment. Choose who exactly you are designing for, find the need that matters most, propose something concrete, and say how you would measure it.",
    expected_framework:
      "The trap is treating cash preference as a trust or literacy problem and designing education. The behaviour described — accept digital, withdraw everything immediately — says the money is needed as working capital the same day, for restocking from a supplier who wants cash. The real need is same-day access and a way to reconcile without leaving the stall. Strong answers pick one of those and go deep: instant settlement, an audible confirmation the vendor can hear over traffic while serving, a daily total by voice or SMS, or credit against observed takings. Measure repeat digital acceptance and the fraction of balance retained overnight, not app installs.",
    rubric: PRODUCT_SENSE_RUBRIC,
  },
  {
    slug: "ps-school-parent-communication",
    title: "Design parent communication for a school group",
    format: "product_sense",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You are a PM at a company selling school management software to 400 private schools. Teachers send parents an average of 14 messages a week through the app. Parent app opens average 1.3 a week. Teachers report spending 40 minutes a day on parent communication. Parents report 'too many notifications' as the top complaint and also, separately, 'I did not know about the exam' as the top escalation to the school office.",
    instructions:
      "Design a feature to serve this better. Say who you are designing for, what the core problem is, what you would build, and how you would know it worked.",
    expected_framework:
      "The two parent complaints look contradictory and are not: 14 messages a week with no hierarchy means everything is a notification, so nothing is. The design problem is prioritisation, not volume reduction, and the person to design for has to be chosen — the teacher spending 40 minutes, or the parent missing the exam date. Strong answers separate broadcast from actionable: a dated, structured channel for things a parent must act on (exams, fees, permissions) against an ambient feed for everything else. Measure the escalation rate to the office, which is the real failure, rather than app opens, which would go up for bad reasons too.",
    rubric: PRODUCT_SENSE_RUBRIC,
  },
  {
    slug: "ps-video-app-low-bandwidth",
    title: "Design for viewers on unreliable connections",
    format: "product_sense",
    domain: "product_management",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "You are a PM at a video streaming service. In tier-3 towns and rural districts, session abandonment within the first 30 seconds is 41% against 12% in metros. Median connection speed there is 1.8 Mbps with frequent drops. Data is a real cost to these users — many are on daily-limit prepaid packs. Content preference skews to long-form regional-language drama. Most watch on one shared household phone, often in the evening.",
    instructions:
      "Design a product change for this audience. Pick a specific user and problem, propose something concrete, and name how you would measure success.",
    expected_framework:
      "Adaptive bitrate is the obvious answer and probably already exists; a strong answer goes past it. The constraints given are not only bandwidth: a daily data pack makes a failed start an actual financial loss, a shared phone means viewing is negotiated and time-boxed, and long-form drama means the cost of a bad start is repeated nightly. That points at scheduled overnight download of the next episodes on a cheaper window, resume-across-interruption that survives a connection drop, and showing data cost per episode before playback. Measure completed episodes per week per household, not sessions started.",
    rubric: PRODUCT_SENSE_RUBRIC,
  },

  // ---- metrics ------------------------------------------------------------
  {
    slug: "metrics-online-pharmacy",
    title: "Choose the metrics for an online pharmacy",
    format: "metrics",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You run product at an online pharmacy delivering prescription and over-the-counter medicine. Leadership currently tracks orders per month, which is up 30% year on year. Chronic-condition patients reordering monthly are 22% of customers and 58% of revenue. Average delivery time is 14 hours. Prescription verification rejects 6% of orders. Gross margin on OTC is 22% and on prescription medicine 9%.",
    instructions:
      "Propose a north-star metric, break it into input metrics a team can move, and name the guardrails. Say what you would do if two of them disagreed.",
    expected_framework:
      "Orders per month is a vanity metric here because it treats a one-off vitamin purchase and a chronic refill as equal when one is 58% of revenue. A defensible north star is something like refills delivered on time to chronic patients, which captures the value actually delivered — continuity of medication. Inputs: patients on a refill schedule, refill adherence rate, on-time delivery within the promised window, verification pass rate. The guardrails matter unusually much on this surface: verification rejection must not be optimised downward, because that is a safety control, and OTC mix must be watched since margin pressure would push the business away from the chronic patients it just declared central.",
    rubric: METRICS_RUBRIC,
  },
  {
    slug: "metrics-job-marketplace",
    title: "Choose the metrics for a blue-collar job marketplace",
    format: "metrics",
    domain: "product_management",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "You run product at a marketplace matching blue-collar workers with employers — drivers, warehouse staff, delivery riders. The team tracks applications submitted, up 60% this year. Employers post 12,000 roles a month and fill 4,100. Workers submit a median of 9 applications and hear back on 2. Median time from application to a decision is 11 days. Thirty per cent of filled roles are vacant again within 45 days.",
    instructions:
      "Propose a north-star metric with an input tree and guardrails, and say what you would do if two metrics pointed in different directions.",
    expected_framework:
      "Applications submitted is actively misleading: it goes up when matching is bad, because a worker who hears nothing applies again. The marketplace's real output is a filled role that lasts, and the 30% re-vacancy inside 45 days says fills alone are not it. A north star of roles filled and still filled at 45 days captures both sides. Inputs: employer response rate, time to decision, applications per fill, match quality. Guardrails: worker applications per hire — rising means wasted effort — and employer posting quality. Strong answers notice the two-sided tension explicitly: raising fill speed by loosening matching would raise fills and worsen retention, and say which they would protect.",
    rubric: METRICS_RUBRIC,
  },
  {
    slug: "metrics-edtech-outcomes",
    title: "Choose the metrics for a test-prep product",
    format: "metrics",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You run product at a test-preparation company. The team tracks daily active users and hours studied, both up strongly. Students pay Rs 18,000 for a nine-month course. Completion of the full syllabus is 31%. Students who complete score, on average, 24 percentile points higher than those who do not. Refund requests run at 8%. The exam is once a year, so success is observed long after the sale.",
    instructions:
      "Propose a north-star metric, its input tree, and guardrails. Say what you would do if the metrics disagreed.",
    expected_framework:
      "Hours studied is the classic trap: it rewards a product that wastes a student's time. The outcome the student buys is a score, which is observed once a year and far too late to steer by. The design problem is finding a leading indicator that genuinely predicts it — syllabus completion looks right, and the 24-point gap is the evidence, though a strong answer notices that completion may be a proxy for motivation rather than a cause. Inputs: weekly active study sessions, topic mastery, mock-test progression. Guardrails: refund rate and mock scores, so completion cannot be gamed by making the syllabus easier to finish.",
    rubric: METRICS_RUBRIC,
  },

  // ---- prioritisation -----------------------------------------------------
  {
    slug: "prio-logistics-roadmap",
    title: "Prioritise a quarter for a logistics platform",
    format: "prioritisation",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You have one quarter and a team of six engineers. The stated goal is to reduce cost per shipment by 8%. The options are: (A) route optimisation, estimated 5% cost reduction, 10 engineer-weeks, dependent on a mapping vendor with a 6-week contract lead time. (B) automated proof-of-delivery capture, removes 1.5 minutes per drop across 40,000 drops a month, 6 engineer-weeks. (C) a warehouse slotting rework, 3% cost reduction, 14 engineer-weeks, requires two weeks of warehouse downtime. (D) a customer tracking page, no direct cost impact, 4 engineer-weeks, requested by the three largest customers who are up for renewal.",
    instructions:
      "Set your criteria, evaluate the options against them, commit to an order, and say what you are not doing and why. Explain how you would defend it to the customers who lose out.",
    expected_framework:
      "A quarter with six engineers is roughly 72 engineer-weeks, so this is not a capacity puzzle — everything nominally fits, which means the real constraints are the dependencies and the downtime. A is the largest cost lever but has a six-week vendor lead time that must start immediately or it cannot land in the quarter. C's two weeks of warehouse downtime is a business cost the engineering estimate hides. D has no cost impact at all and so fails the stated goal, but three renewals is a real risk the goal does not capture — strong answers say so explicitly rather than either ignoring D or quietly abandoning the stated objective for it.",
    rubric: PRIORITISATION_RUBRIC,
  },
  {
    slug: "prio-bank-compliance-vs-growth",
    title: "Prioritise when compliance and growth collide",
    format: "prioritisation",
    domain: "strategy",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "You run product for a digital bank. Next quarter you can staff three of five initiatives. (A) a regulator-mandated reporting change, due in 90 days, non-negotiable, 8 engineer-weeks. (B) instant account opening, projected to raise signups 25%, 16 engineer-weeks. (C) a fraud-detection upgrade; current losses are Rs 40 lakh a quarter and rising 15% quarterly, 12 engineer-weeks. (D) a merchant lending pilot, Rs 2 crore revenue opportunity next year, 20 engineer-weeks. (E) migrating off a database whose support ends in 8 months, 18 engineer-weeks.",
    instructions:
      "Set criteria, evaluate, commit to three, and say what you are dropping and why. Explain how you would defend it to the people whose initiative is dropped.",
    expected_framework:
      "A is not a choice and should be named as such rather than ranked. That leaves two slots for four candidates. C compounds — Rs 40 lakh rising 15% a quarter is roughly Rs 60 lakh by the time a deferred fix ships — which usually beats B's signup growth on expected value. E is the interesting one: eight months of runway means it can be deferred one quarter but not two, and a good answer says that explicitly rather than dropping it silently. D is the largest number and the most deferrable. The defence to the dropped owner is the part most answers skip: give them the criterion they lost on and the condition under which they win next quarter.",
    rubric: PRIORITISATION_RUBRIC,
  },
  {
    slug: "prio-retail-store-investment",
    title: "Allocate a fixed capital budget across stores",
    format: "prioritisation",
    domain: "operations",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You have Rs 5 crore of capital for the year across a 60-store chain. Options: (A) refurbish the 8 oldest stores at Rs 40 lakh each; refurbished stores have historically lifted sales 12% for two years. (B) install self-checkout in the 20 busiest stores at Rs 12 lakh each, saving 1.5 staff per store at Rs 3 lakh a year each. (C) open two new stores at Rs 1.2 crore each, each expected to do Rs 4 crore revenue at 6% store margin. (D) a chain-wide inventory system at Rs 1.5 crore, projected to cut stockouts from 7% to 3%.",
    instructions:
      "Set your criteria, evaluate the options with the figures given, commit to an allocation, and say what you are not funding and why.",
    expected_framework:
      "The arithmetic is the work here and most answers skip it. A: Rs 3.2 crore for a 12% lift on eight stores. B: Rs 2.4 crore saving Rs 4.5 lakh a year per store, so roughly Rs 90 lakh a year against Rs 2.4 crore — under three years' payback. C: Rs 2.4 crore for Rs 48 lakh of annual store margin, a five-year payback before overheads. D: Rs 1.5 crore for a four-point stockout improvement whose revenue effect has to be estimated, and which benefits all 60 stores rather than a handful. Strong answers rank by return per rupee and say what they assumed to make D comparable, since it is the only option whose benefit is not given in money.",
    rubric: PRIORITISATION_RUBRIC,
  },

  // ---- research note ------------------------------------------------------
  {
    slug: "rn-paint-company-margin",
    title: "Research note: a paints maker with expanding margins",
    format: "research_note",
    domain: "finance",
    difficulty: "hard",
    minutes: 35,
    scenario:
      "A decorative paints company reports revenue of Rs 12,400 crore, up 9%. EBITDA margin expanded 240 basis points to 19.8%, driven mostly by crude-linked input costs falling 15%. Volume growth was 11%, so realisation fell. The company added 14,000 dealer touchpoints, taking the total to 84,000. A large industrial conglomerate entered the category 18 months ago with announced capacity of 1,300 crore litres and is discounting 8-10% below incumbents. The stock trades at 48x earnings against a ten-year median of 55x. Net cash on the balance sheet is Rs 2,100 crore.",
    instructions:
      "Write a research note with a rating, a target, and the thesis in the opening lines. Show how you derived the target. Name the drivers and what would break the call.",
    expected_framework:
      "Margin expansion of 240 basis points that comes from crude is borrowed, not earned, and the note has to say whether it normalises. Volume growth of 11% against 9% revenue growth means price was given up — consistent with responding to the new entrant. The real question is whether 84,000 touchpoints is a durable moat against a conglomerate with capital and patience, since distribution is the actual barrier in this category rather than the product. A strong note derives a target explicitly, from a normalised margin rather than the reported one, and names the falsifier: quarterly volume share and whether discounting deepens.",
    rubric: RESEARCH_NOTE_RUBRIC,
  },
  {
    slug: "rn-hospital-chain-expansion",
    title: "Research note: a hospital chain funding expansion",
    format: "research_note",
    domain: "finance",
    difficulty: "hard",
    minutes: 35,
    scenario:
      "A hospital chain operates 3,200 beds across 14 hospitals. Occupancy is 68%. Average revenue per occupied bed day is Rs 38,000, up 6%. EBITDA margin is 22%. Mature hospitals — over five years old — run at 78% occupancy and 28% margin; the six opened in the last three years run at 51% and 9%. The company plans 1,400 new beds over four years at Rs 85 lakh a bed, funded half by debt. Net debt is currently 1.6x EBITDA. A new hospital takes an average of five years to reach mature occupancy.",
    instructions:
      "Write a note with a rating, target and thesis up front, the derivation, the drivers and the risks.",
    expected_framework:
      "The blended numbers hide the whole story and the note's job is to separate them: a mature estate at 78% and 28% margin is a good business being averaged down by six immature hospitals, which is exactly what expansion is supposed to look like. The question is whether the balance sheet can carry a second wave while the first is still ramping. Rs 1,400 beds at Rs 85 lakh is roughly Rs 1,190 crore, half debt, against net debt already at 1.6x. A strong note values the mature estate and the ramping estate separately, and names the falsifier: occupancy trajectory at the three-year-old hospitals, which is the leading indicator for everything being assumed.",
    rubric: RESEARCH_NOTE_RUBRIC,
  },
  {
    slug: "rn-agri-inputs-monsoon",
    title: "Research note: an agri-inputs business after a weak monsoon",
    format: "research_note",
    domain: "finance",
    difficulty: "medium",
    minutes: 35,
    scenario:
      "A crop-protection company reports revenue down 7% and EBITDA margin down 320 basis points to 14.1% after a monsoon 22% below the long-period average. Channel inventory is 71 days against a normal 45. Receivables are 118 days against 82. The company has launched four new molecules in two years, which are 18% of revenue at gross margins 900 basis points above the portfolio average. The stock is down 34% from its high and trades at 21x trailing earnings against a five-year median of 29x.",
    instructions:
      "Write a note with rating, target and thesis in the opening, the derivation, the two or three drivers, and what would break the call.",
    expected_framework:
      "The temptation is to call a cyclical bottom on a de-rated multiple. The figures that should give pause are the working-capital ones: 71 days of channel inventory and 118 days of receivables mean the reported revenue has been pushed into a channel that has not sold it, so next season's revenue is already partly spent. Trailing earnings are therefore the wrong denominator for the multiple. The genuine positive is the new molecules at 18% of revenue and materially higher gross margin, which is a mix story independent of the monsoon. A strong note prices the normalisation of working capital explicitly and names the next monsoon forecast as the obvious falsifier.",
    rubric: RESEARCH_NOTE_RUBRIC,
  },

  // ---- go to market -------------------------------------------------------
  {
    slug: "gtm-b2b-payroll-software",
    title: "Go to market: payroll software for small firms",
    format: "gtm_plan",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "You are launching payroll and compliance software for Indian firms with 10 to 200 employees. Pricing is Rs 60 per employee per month. The market is roughly 6 lakh such firms. Most currently use a local chartered accountant, a spreadsheet, or a legacy desktop product. Compliance changes several times a year and errors carry penalties. You have Rs 1.5 crore of budget for the first year and a team of four, two of whom can sell.",
    instructions:
      "Write a go-to-market plan. Choose a beachhead segment, state the proposition and pricing, pick channels in sequence with rough economics, and set milestones.",
    expected_framework:
      "Six lakh firms is a market, not a plan. The beachhead has to be narrowed by something that makes the sale repeatable — a state whose compliance rules you handle best, an industry with unusual payroll structure, or firms in the 50-200 band where the CA relationship strains. The unignored channel here is the chartered accountants themselves: they are the incumbent, and they are either the obstacle or the distribution. Strong plans work out what a customer is worth — 50 employees at Rs 60 is Rs 36,000 a year — and check that against a channel that can acquire for a fraction of it, which rules out a field sales motion with two salespeople. Milestones should be leading, such as CA partners activated.",
    rubric: GTM_RUBRIC,
  },
  {
    slug: "gtm-premium-cold-pressed-oil",
    title: "Go to market: a premium cooking oil",
    format: "gtm_plan",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "You are launching a cold-pressed groundnut oil at Rs 420 a litre against refined oils at Rs 140. Gross margin is 38%. The category buyer is highly price-sensitive and buys monthly in 5-litre packs. Early sampling shows strong repeat among households with a member managing a health condition. You have Rs 80 lakh for the first year. Modern trade listing costs roughly Rs 4 lakh per chain plus margin, and quick-commerce placement costs 22% of selling price plus advertising.",
    instructions:
      "Write a go-to-market plan: beachhead segment, proposition and pricing, channel sequence with economics, and milestones.",
    expected_framework:
      "A three-times price premium cannot be sold on 'purity' to the mass category buyer, and a plan that tries has misread the sampling data. The signal is the health-condition household, which converts the purchase from a grocery decision into a medical-adjacent one where price sensitivity collapses. That points at channels the mass category would not use — nutritionists, diabetes clinics, condition-specific communities — before any retail listing. Strong plans notice that Rs 80 lakh buys perhaps 20 modern-trade listings and nothing else, and reject that in favour of a narrower, cheaper, repeatable motion. Pack size matters too: a 5-litre pack at Rs 2,100 is a very different commitment from a 1-litre trial.",
    rubric: GTM_RUBRIC,
  },
  {
    slug: "gtm-campus-hiring-platform",
    title: "Go to market: a campus hiring platform",
    format: "gtm_plan",
    domain: "marketing",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "You are launching a platform that runs campus placement processes for colleges and recruiters. Colleges will not pay; recruiters might. There are roughly 4,000 colleges running placements and perhaps 2,000 active campus recruiters. A recruiter runs 8 to 40 campus processes a year, currently co-ordinated over email and spreadsheets by a two-person team. The placement season is concentrated in four months. You have Rs 1 crore and eight months before the season starts.",
    instructions:
      "Write a go-to-market plan with a beachhead, proposition, channel sequence and milestones. Be explicit about the two-sided problem.",
    expected_framework:
      "The season concentration is the dominating constraint and most plans ignore it: eight months to launch means one shot a year, and missing it costs twelve months. The two-sided problem has an asymmetry the scenario hands over — colleges will not pay but are the supply, so they must be acquired at near-zero marginal cost, while recruiters pay and are far fewer. Two thousand recruiters is small enough to name, which makes a direct motion viable in a way it would not be for the colleges. Strong plans sequence deliberately: sign a small number of recruiters first, use their campus lists to pull colleges in, and set milestones against the season calendar rather than against months.",
    rubric: GTM_RUBRIC,
  },

  // ---- marketing mix ------------------------------------------------------
  {
    slug: "mm-snack-brand-stalling",
    title: "Fix the mix: a snack brand that has stopped growing",
    format: "marketing_mix",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "A baked-snack brand grew 40% a year for three years and is now flat. It sells a 60g pack at Rs 30 through modern trade and quick commerce, with 44% gross margin. Trial rate in its target metros is 31% but repeat is 19%. Advertising is entirely digital, weighted to reach. General trade is 6% of sales. Blind taste tests rate it at parity with the fried market leader. Consumer research says the most common reason for not repeating is 'too small for the price'.",
    instructions:
      "Work out which part of the mix is causing the problem, keep your recommendation internally consistent, and check it against the economics.",
    expected_framework:
      "High trial and low repeat is the defining pattern: the marketing is working and the offer is not. With taste at parity and the stated objection being value rather than flavour, the broken element is the pack-price-quantity relationship, not the product or the advertising. That means the lever is grammage or price, and the answer has to run the margin arithmetic — at 44% on Rs 30, moving to 80g at Rs 40 changes the maths materially and has to be checked, not asserted. A strong answer also spots that heavy reach advertising against 31% trial is buying more trial the brand cannot convert, and moves that money. General trade at 6% is a separate, slower question.",
    rubric: MARKETING_MIX_RUBRIC,
  },
  {
    slug: "mm-salon-chain-utilisation",
    title: "Fix the mix: a salon chain with idle chairs",
    format: "marketing_mix",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "A 40-outlet salon chain runs at 47% chair utilisation. Weekends are at 89%, weekdays at 31%. Average bill is Rs 900. Staff are salaried, so weekday idle time is a fixed cost. Discount coupons distributed through a deals app brought volume but average bill on those visits is Rs 520 and repeat is 8%. Membership packages exist but are sold by staff at the counter and are 4% of revenue. A competitor opened 6 outlets in the same catchments at 20% lower prices.",
    instructions:
      "Diagnose which element of the mix is at fault, recommend specific changes, and check them against the economics.",
    expected_framework:
      "This is a capacity problem being treated as a demand problem. Salaried staff mean a weekday chair costs the same empty or full, so the marginal revenue on a weekday visit is nearly all contribution — which makes weekday-only pricing rational and blanket discounting destructive. The coupon channel is the clearest error: it discounts weekend customers who would have paid full price, and brings buyers who do not return. Strong answers restrict any discount to the idle window, move membership from a counter upsell to a designed proposition since it pre-commits future visits, and decline to match the competitor's 20% across the board because the utilisation split says price is not the binding constraint on weekends.",
    rubric: MARKETING_MIX_RUBRIC,
  },
  {
    slug: "mm-regional-dairy-expansion",
    title: "Fix the mix: a dairy brand entering a new state",
    format: "marketing_mix",
    domain: "marketing",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "A dairy brand strong in its home state has entered a neighbouring one. After a year it holds 3% share against 8% projected. It sells the same SKUs at the same prices. The new state's incumbent has 61% share, a cooperative structure, and 40 years of presence. The brand's milk is priced Rs 2 a litre above the incumbent and it advertises on freshness. Distribution reaches 22% of outlets against the incumbent's 91%. Curd and paneer, which carry double the margin of milk, are 9% of its sales there against 24% at home.",
    instructions:
      "Diagnose which part of the mix is failing, recommend changes that stay consistent with each other, and check them against margin.",
    expected_framework:
      "Twenty-two per cent outlet reach against 91% is the answer to the share question on its own — at that coverage, 3% share is roughly what the distribution supports, and no amount of advertising fixes a product the shopper cannot find. The freshness message is also the incumbent's strongest ground after 40 years, so it is a positioning chosen to lose. The genuinely interesting figure is the value-added mix at 9% against 24% at home: that is where the margin is and where a new entrant can win without fighting the milk war. Strong answers fund distribution over advertising and lead with curd and paneer rather than liquid milk.",
    rubric: MARKETING_MIX_RUBRIC,
  },

  // ---- campaign critique --------------------------------------------------
  {
    slug: "cc-festive-cashback",
    title: "Critique: a festive cashback campaign",
    format: "campaign_critique",
    domain: "marketing",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "A payments app ran a festive campaign offering Rs 100 cashback on transactions above Rs 500, capped at three per user. Budget was Rs 12 crore, fully spent. Transactions in the period rose 34% year on year against a category rise of 21%. New user signups rose 9%. Of users who claimed cashback, 76% were already monthly active before the campaign. Transactions in the four weeks after the campaign were 4% below the four weeks before it. Average transaction value among claimers fell from Rs 1,240 to Rs 680.",
    instructions:
      "Establish what the campaign was trying to achieve, read the numbers, separate the idea from the execution, and say what you would have done with the same budget.",
    expected_framework:
      "Almost every headline number is flattering and almost none of it is incremental. The category rose 21% anyway, so 34% is a 13-point lift at best. Seventy-six per cent of claimers were already active, so most of the Rs 12 crore subsidised behaviour that would have happened. Average transaction value collapsing from Rs 1,240 to Rs 680 shows users splitting transactions to hit the Rs 500 threshold three times — the cap design created the gaming. The post-period dip of 4% suggests pull-forward rather than habit. A strong critique separates the idea (festive incentive) from the execution (threshold and cap) and reallocates to new or lapsed users where the money would have bought something.",
    rubric: CAMPAIGN_CRITIQUE_RUBRIC,
  },
  {
    slug: "cc-influencer-launch",
    title: "Critique: an influencer-led product launch",
    format: "campaign_critique",
    domain: "marketing",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "A skincare brand launched a serum using 140 micro-influencers, each paid in product plus Rs 15,000, total spend Rs 32 lakh. The campaign generated 8.4 million impressions and 610,000 engagements. Website traffic rose 240% in the launch fortnight. Conversion rate on that traffic was 0.4% against the site average of 2.1%. Three thousand units sold at Rs 1,200 against a target of 12,000. Return rate on those units was 14% against a category norm of 6%. Post-launch, 22% of the influencers' audiences who visited returned within 30 days.",
    instructions:
      "Say what the campaign was for, read the evidence, separate idea from execution from media, and propose an alternative at the same budget.",
    expected_framework:
      "Reach worked and selling did not, which is a specific and diagnosable failure. Conversion at 0.4% against a 2.1% site average means the traffic was poorly qualified — curiosity rather than intent — which is what a broad micro-influencer buy produces. The return rate at more than double the norm is the strongest signal and most answers miss it: buyers were not told what the product does, so it failed their expectations. Strong critiques separate the media choice (140 small accounts, no targeting coherence) from the creative (no proposition, only presence) and note that 22% returning within 30 days is a genuine asset that was not built on. The alternative should concentrate spend on fewer, better-matched creators with a claim to test.",
    rubric: CAMPAIGN_CRITIQUE_RUBRIC,
  },
  {
    slug: "cc-outdoor-metro-launch",
    title: "Critique: an outdoor campaign for a city launch",
    format: "campaign_critique",
    domain: "marketing",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "A ride-hailing company entered a new city with Rs 6 crore of outdoor advertising — hoardings, metro station branding and bus shelters — over eight weeks. Aided brand awareness rose from 11% to 58%. App installs in the city were 180,000. First rides taken were 41,000. Of those, 19% took a second ride within 30 days. Driver supply during the period averaged 900 against a planned 2,400. Median wait time was 14 minutes against the incumbent's 6. Cost per first ride was Rs 1,463.",
    instructions:
      "Establish the objective, read the numbers, separate idea from execution, and say what you would have done with the same money.",
    expected_framework:
      "The campaign did its job and the business could not receive it. Awareness nearly sextupled and 180,000 people installed, but driver supply landed at 37% of plan and wait times were more than double the incumbent's. That converts advertising into a demonstration of the weakness: 41,000 first rides from 180,000 installs, and 19% second rides, is what a 14-minute wait produces. The critique worth making is about sequencing, not creative — the money was spent creating demand before supply existed to serve it, and every rupee of awareness bought a worse first impression. The alternative is obvious once stated: spend on driver acquisition first and advertise into adequate supply.",
    rubric: CAMPAIGN_CRITIQUE_RUBRIC,
  },

  // ---- guesstimate --------------------------------------------------------
  {
    slug: "gs-school-uniforms-annual",
    title: "How many school uniforms are sold in India each year?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "An apparel manufacturer is considering entering organised school uniform supply and wants the size of the annual market in units.",
    instructions:
      "Estimate the number of school uniform sets sold in India in a year. State your assumptions, show the chain, and sanity-check the result.",
    expected_framework:
      "The chain is school-age population, then enrolment, then the share of schools requiring uniforms, then sets per child per year. Roughly 25 crore school-age children, enrolment high at primary and falling through secondary, and most schools — government included — requiring uniforms. Sets per child per year is where judgement shows: children grow, so one to two sets a year is defensible while a single set is not. A good answer separates government from private, because procurement differs completely, and sanity-checks against something known, such as total apparel volumes or the size of the organised uniform players.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "gs-atm-cash-daily",
    title: "How much cash is dispensed by ATMs in Mumbai in a day?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A cash logistics company is sizing the Mumbai market and wants a daily figure in rupees.",
    instructions:
      "Estimate the total cash dispensed by ATMs in Mumbai on a typical day. State assumptions, show the chain, and sanity-check.",
    expected_framework:
      "Two routes exist and a strong answer picks one and mentions the other as a check. Supply side: number of ATMs in Mumbai, transactions per ATM per day, average withdrawal. Demand side: population, share withdrawing cash in a given week, average withdrawal. Mumbai's roughly 2 crore people with high digital payment penetration is the adjustment most answers miss — this number has fallen over the last decade and an estimate built on 2014 behaviour will be far too high. Sanity-check the total against something anchored, like a plausible share of India's currency in circulation.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "gs-wedding-photographers",
    title: "How many professional wedding photographers work in India?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "hard",
    minutes: 20,
    scenario:
      "A software company selling tools to creative professionals wants to size this segment.",
    instructions:
      "Estimate the number of people earning a living primarily from wedding photography in India. State your assumptions and sanity-check the answer.",
    expected_framework:
      "The chain runs from weddings per year — roughly a crore is the common anchor — to the share that hire a professional, to weddings per photographer per year. The last is the term that decides the answer and where most estimates go wrong: the season is concentrated into a few months, so a photographer might do 20 to 40 weddings a year rather than one a week. A strong answer also splits the market by price tier, because a Rs 2 lakh wedding photographer and a Rs 15,000 one run completely different businesses, and notes that 'primarily' excludes the large number who shoot weddings as a second income.",
    rubric: GUESSTIMATE_RUBRIC,
  },
  {
    slug: "gs-office-lift-trips",
    title: "How many lift trips does a Bengaluru tech park make in a day?",
    format: "guesstimate",
    domain: "consulting",
    difficulty: "easy",
    minutes: 15,
    scenario:
      "A building systems company is sizing maintenance contracts and wants a per-park daily figure.",
    instructions:
      "Estimate the number of lift trips in a large Bengaluru tech park on a working day. State assumptions and sanity-check.",
    expected_framework:
      "Chain: number of people in the park, trips per person per day, people per lift trip. The term that separates good answers is trips per person: arrival and departure is two, but lunch, meetings across towers and stepping out add several more, so four to six is defensible and two is not. Dividing by people per trip matters because lifts carry groups — a trip is not a person. Sanity-check by dividing the total across the number of lifts and the working hours, and ask whether the resulting trips per lift per hour is physically possible.",
    rubric: GUESSTIMATE_RUBRIC,
  },

  // ---- written ability test -----------------------------------------------
  {
    slug: "wat-ai-and-entry-jobs",
    title: "WAT: AI will destroy more entry-level jobs than it creates",
    format: "wat",
    domain: "strategy",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "Written ability test. You have 20 minutes and roughly 300 words.",
    instructions:
      "Write a response to: 'Artificial intelligence will destroy more entry-level jobs than it creates.' Take a position in the opening lines, argue it, answer the strongest objection, and close.",
    expected_framework:
      "The failure mode is a balanced survey that never commits. A strong response takes a side in the first two sentences and spends the rest earning it. The best material is specific: which entry-level tasks are actually being automated, what the historical pattern has been with previous automation waves, and the difference between tasks and jobs. The strongest counter-argument — that every previous technology created more work than it removed — must be answered rather than ignored, and the honest answer engages with why this wave might differ in speed or in which skills it displaces. Examiners reward a clear position with real examples over an elegant fence-sit.",
    rubric: WAT_RUBRIC,
  },
  {
    slug: "wat-quotas-in-hiring",
    title: "WAT: Companies should publish their pay ranges",
    format: "wat",
    domain: "strategy",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "Written ability test. You have 20 minutes and roughly 300 words.",
    instructions:
      "Write a response to: 'Companies should be required to publish salary ranges in job advertisements.' Take a position, argue it, answer the strongest objection, and close.",
    expected_framework:
      "There is real evidence on both sides, which makes this a test of argument rather than opinion. For: transparency narrows negotiated pay gaps and saves both sides wasted interviews. Against: published ranges compress to the band's edges, reveal competitive information, and can make internal inequities explosive. A strong response picks one and concedes the real cost of its position rather than pretending there is none. Concrete mechanism beats sentiment — saying how a published range changes a specific negotiation is worth more than asserting that transparency is good.",
    rubric: WAT_RUBRIC,
  },
  {
    slug: "wat-remote-work-culture",
    title: "WAT: Remote work weakens organisational culture",
    format: "wat",
    domain: "strategy",
    difficulty: "easy",
    minutes: 20,
    scenario:
      "Written ability test. You have 20 minutes and roughly 300 words.",
    instructions:
      "Write a response to: 'Remote work weakens organisational culture.' Take a position, support it, answer the strongest objection, and close.",
    expected_framework:
      "The word doing the work is 'culture', and a response that never defines it will drift. Strong answers pin it to something observable — how decisions get made, how newcomers learn norms, how disagreement surfaces — and then argue about those rather than about atmosphere. The best counter-argument to either side is that remote work exposes weak culture rather than causing it, and a response that anticipates this is markedly stronger. Personal experience is admissible here and often the most convincing material, provided it is used as evidence rather than as the whole argument.",
    rubric: WAT_RUBRIC,
  },
  {
    slug: "wat-india-manufacturing",
    title: "WAT: India should prioritise services over manufacturing",
    format: "wat",
    domain: "strategy",
    difficulty: "hard",
    minutes: 20,
    scenario:
      "Written ability test. You have 20 minutes and roughly 300 words.",
    instructions:
      "Write a response to: 'India should build on its services strength rather than chase manufacturing.' Take a position, argue it, answer the strongest objection, and close.",
    expected_framework:
      "This rewards actual knowledge of the economy, and thin answers are obvious. The serious argument for services is comparative advantage already demonstrated, high value per worker and lower capital intensity. The serious argument for manufacturing is employment absorption at the skill level where most of the workforce actually sits — services growth has not created jobs at the scale the demographics require. A strong response engages with that employment asymmetry directly, since it is the strongest case against a services-only position, and avoids treating it as a binary when the real question is allocation at the margin.",
    rubric: WAT_RUBRIC,
  },

  // ---- behavioural --------------------------------------------------------
  {
    slug: "beh-unpopular-decision",
    title: "Tell me about a decision you made that was unpopular",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 15,
    scenario:
      "A personal interview question. Answer as you would in the room, in writing.",
    instructions:
      "Describe a time you made a decision that people around you disagreed with. Set the context, say what you did and why, give the outcome, and say what you would do differently.",
    expected_framework:
      "The trap is choosing an example where the candidate turned out to be right and everyone came round, which tests nothing. Strong answers pick a decision where the disagreement was reasonable and say how they handled the people, not only the decision — whether they heard the objection properly, what they conceded, how they communicated it. The reflection carries real weight here: an answer that says the decision was correct and the communication was poor is more credible than one where everything went well. First person singular throughout; 'we decided' is the most common way this answer fails.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-worked-with-difficult-person",
    title: "Tell me about working with someone difficult",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 15,
    scenario:
      "A personal interview question. Answer as you would in the room, in writing.",
    instructions:
      "Describe a time you had to work closely with someone you found difficult. Give the context, what you did, the result, and what it changed about how you work.",
    expected_framework:
      "The question is about the candidate, not the other person, and an answer that spends its length on how unreasonable the colleague was has already failed. Strong answers describe the difficulty specifically and neutrally, then show a deliberate attempt to understand its source — different incentives, different information, pressure from elsewhere. The action should be something the candidate actually chose to do differently. The best reflections acknowledge a share of the friction without performing false humility.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-missed-a-deadline",
    title: "Tell me about a deadline you missed",
    format: "behavioural",
    domain: "strategy",
    difficulty: "hard",
    minutes: 15,
    scenario:
      "A personal interview question. Answer as you would in the room, in writing.",
    instructions:
      "Describe a time you missed a commitment or a deadline. Set the context, say what happened and what you did, give the outcome, and say what changed afterwards.",
    expected_framework:
      "Failure questions are answered badly in two ways: a disguised success, or a failure with the blame placed elsewhere. Strong answers name the miss plainly, take the share of responsibility that is genuinely theirs, and are specific about the mechanism — what they misjudged, when they knew, and what they did the moment they knew. Communication is usually the real test: telling the stakeholder early is the behaviour the interviewer is looking for. The reflection should name a change in practice that a listener could verify.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
  {
    slug: "beh-persuaded-without-authority",
    title: "Tell me about persuading someone you had no authority over",
    format: "behavioural",
    domain: "strategy",
    difficulty: "medium",
    minutes: 15,
    scenario:
      "A personal interview question. Answer as you would in the room, in writing.",
    instructions:
      "Describe a time you got someone to do something when you had no power to require it. Give the context, your actions, the result, and the reflection.",
    expected_framework:
      "This is the single most common consulting and product interview question because the work is mostly influence without authority. Strong answers show that the candidate worked out what the other person wanted before making the case, and framed the request in those terms rather than their own. Evidence, a pilot, a borrowed credibility, an appeal to a shared constraint — the mechanism should be visible. Weak answers describe persistence rather than persuasion. The result needs an observable consequence, not just agreement in a meeting.",
    rubric: BEHAVIOURAL_RUBRIC,
  },
];
