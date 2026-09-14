import type { WrittenSeed } from "./written-formats";

/**
 * Role-specific written formats (20250101000051): the product manager's,
 * the equity analyst's and the marketer's versions of a case.
 *
 * Same engine as every written format — a scenario, a rubric, a free-text
 * answer — so the work here is the rubric. Each one names what that round is
 * actually marked on, which is rarely "analysis" in general: a product-sense
 * round is lost by designing before choosing a user, a metrics round by
 * picking a vanity number, a research note by burying the call.
 *
 * Every company is invented or described generically. A note that says "sell"
 * about a real listed company, or a teardown of a real brand's campaign, would
 * be a claim about that company rather than a practice problem.
 */

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
  objective: [20, "States what the campaign was actually trying to achieve and for whom."],
  evidence: [30, "Reads the results correctly — separates reach from response from business outcome, and spots misleading numbers."],
  critique: [30, "Explains why it worked or failed with reasons tied to audience, message or channel, not taste."],
  next_steps: [20, "Proposes what to test or change next, with a measure of success."],
};

export const WRITTEN_SEEDS_ROLES: WrittenSeed[] = [
  // ---- product sense ------------------------------------------------------
  {
    slug: "ps-grocery-app-elderly",
    title: "Design a grocery ordering experience for people over 65",
    format: "product_sense",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You are a product manager at a quick-commerce grocery app in Indian metros. Leadership has noticed that households with members over 65 order far less often than younger households of the same income, even though they spend more on groceries overall — mostly through a neighbourhood kirana and phone orders.",
    instructions:
      "Design a product or feature to serve older customers better. Choose whom you are designing for, find the need that matters most, propose a solution and prioritise within it, and say how you would know it worked.",
    expected_framework:
      "The trap is designing 'bigger buttons' for 'elderly users' as one block. Strong answers split the segment — the self-ordering older adult, the adult child ordering for a parent from another city, the caregiver — and pick one. The unmet need is often trust and habit (the kirana knows them, takes phone orders, gives credit, substitutes sensibly) rather than screen size. A solution that replicates that relationship — a recurring list, a phone or voice order channel, a trusted substitution rule, family co-ordering — beats a UI refresh. Measure repeat order rate in the segment, not downloads.",
    rubric: PRODUCT_SENSE_RUBRIC,
  },
  {
    slug: "ps-improve-railway-booking",
    title: "Improve the experience of booking a train ticket in India",
    format: "product_sense",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You are interviewing for a product role at a travel-booking app. The interviewer asks you to pick one part of booking an Indian train ticket and make it meaningfully better. You may assume the app already offers search, booking and payment, and that seat inventory and waitlist rules are set by the railway, not by the app.",
    instructions:
      "Choose a user and a moment in the journey, explain why it matters, propose an improvement, and state the trade-offs and the metric you would use.",
    expected_framework:
      "The constraint matters: the app cannot create seats or change waitlist rules, so solutions that pretend otherwise miss the problem. The highest-anxiety moment is usually the waitlisted ticket — will it confirm, what is the backup. Strong answers pick a user (the family planning a festival trip, the frequent business traveller), focus on uncertainty (confirmation likelihood shown honestly, automatic alternatives, a clear refund path) and name the trade-off of predictions being wrong. Metric: completed trips on booked tickets, or rebooking rate after a failed waitlist — not searches.",
    rubric: PRODUCT_SENSE_RUBRIC,
  },
  {
    slug: "ps-feature-for-small-sellers",
    title: "A marketplace wants more first-time sellers to make their first sale",
    format: "product_sense",
    domain: "product_management",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "An online marketplace for handmade and small-batch goods signs up about 4,000 new sellers a month. Six in ten list at least one product. Fewer than one in four of those make a sale within 60 days, and most sellers who have not sold by day 60 never list again. Sellers who do make a first sale early tend to stay for years.",
    instructions:
      "Design something that gets more new sellers to a first sale. Choose the seller you are building for, identify the real obstacle, and propose and prioritise a solution. Include what you would measure and what could go wrong.",
    expected_framework:
      "Use the funnel given: the drop is between listing and first sale, and first sale predicts retention, so the goal is time-to-first-sale for listed sellers. Hypotheses to separate: listings are poor (photos, pricing, titles), listings are invisible (a ranking system that favours sellers with sales history — a cold-start problem), or demand for the category is thin. The strongest answers pick the likely cause and design for it — e.g. a new-seller visibility boost with quality gates, or guided listing improvement — and name the risk (buyers seeing lower-quality items, established sellers losing ranking). Measure share of listed sellers with a sale by day 30, with buyer return rate as a guardrail.",
    rubric: PRODUCT_SENSE_RUBRIC,
  },

  // ---- metrics ------------------------------------------------------------
  {
    slug: "mx-north-star-language-app",
    title: "Define success metrics for a language-learning app",
    format: "metrics",
    domain: "product_management",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A language-learning app has 30 lakh monthly active users and makes money from a subscription. The growth team reports daily active users; the content team reports lessons completed; finance reports subscription revenue. The CEO says the teams are optimising for different things and asks you to fix the metrics.",
    instructions:
      "Propose one north-star metric, the input metrics beneath it that teams can own, and the guardrail metrics that would catch the north star being gamed. Explain your choices.",
    expected_framework:
      "The value delivered is learning that sticks, so the north star should approximate it — e.g. weekly learners who complete a meaningful amount of practice (a threshold, not raw lessons), or learners retained for several consecutive weeks. DAU rewards notifications and streak tricks; lessons completed rewards making lessons shorter; revenue lags and can be bought with discounts. Inputs: new learner activation, week-2 retention, practice depth, subscription conversion. Guardrails: lesson difficulty or assessment scores (to stop lessons being made trivially easy), notification opt-out and uninstall rates, refund rate.",
    rubric: METRICS_RUBRIC,
  },
  {
    slug: "mx-food-delivery-late-orders",
    title: "Which metrics should a delivery platform's operations team own?",
    format: "metrics",
    domain: "product_management",
    difficulty: "medium",
    minutes: 20,
    scenario:
      "A food delivery platform's operations team is judged today on 'average delivery time', which has improved from 38 to 31 minutes over a year. In the same year, complaints about cold food and cancelled orders have risen, and rider attrition has nearly doubled.",
    instructions:
      "Explain what is wrong with the current metric, propose the metrics the operations team should own instead, and name the guardrails.",
    expected_framework:
      "An average hides the tail: customers remember the 70-minute order, not the mean. An average can also be improved by cancelling slow orders or pressuring riders — consistent with rising cancellations and attrition. Better primary metric: share of orders delivered within the promised time (on-time rate), or the 90th-percentile delivery time. Inputs: restaurant prep time accuracy, rider assignment time, travel time. Guardrails: cancellation rate (especially platform-initiated), food-quality complaints, rider attrition and earnings per hour, and safety incidents.",
    rubric: METRICS_RUBRIC,
  },
  {
    slug: "mx-b2b-saas-health",
    title: "Measure product health for a B2B invoicing tool",
    format: "metrics",
    domain: "product_management",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "A SaaS invoicing product serves about 18,000 small businesses on annual plans. Logins are up 15% year on year, but renewals fell from 82% to 74%. Sales says the product is loved; customer success says customers are quietly switching to a competitor bundled with their accounting software.",
    instructions:
      "Design the metrics you would use to understand product health and predict renewal. Say which one you would report to the leadership team each month and why.",
    expected_framework:
      "Logins are activity, not value — a customer can log in more because the product is harder to use. For an invoicing tool, value is invoices sent and paid through it. North star: share of active customers who sent and collected invoices through the product in the month, or payment value collected. Leading indicators of churn: declining invoice volume per customer, fewer seats in use, integrations disconnected, exports of data (a sign of migration). Segment by customer size and by whether they use the accounting integration. Guardrails: support tickets per customer and time to first invoice for new accounts. Report the leading indicator, because renewal itself arrives too late to act on.",
    rubric: METRICS_RUBRIC,
  },

  // ---- prioritisation -----------------------------------------------------
  {
    slug: "pr-roadmap-three-bets",
    title: "Choose one of three roadmap bets for next quarter",
    format: "prioritisation",
    domain: "product_management",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "You lead product for a personal-finance app. The company goal this year is to grow paying subscribers. You have one engineering squad for the quarter and three candidate projects:\n\n- **A. Bank-statement auto-import.** Requested by 40% of churned users in exit surveys. About 10 squad-weeks. Depends on a partner API that is still in beta.\n- **B. Redesigned paywall and trial.** The growth team estimates a 15–25% lift in trial-to-paid conversion based on two small tests. About 4 squad-weeks.\n- **C. Tax-filing assistant.** The CEO's favourite. Could open a new revenue line during tax season, eight months away. About 12 squad-weeks, and needs compliance review.\n\nThe squad has 12 weeks of capacity.",
    instructions:
      "Recommend what to build, in what order, and what not to build this quarter. Show how you compared the options, and explain how you would communicate the decision to the CEO.",
    expected_framework:
      "Tie every option to the goal (paying subscribers) and to evidence, effort and risk. B is small, directly on the goal and has some evidence, so it goes first. A addresses churn — a real subscriber driver — but carries dependency risk; it can follow B within capacity if the partner API is stable enough, or be de-risked with a spike. C is off-goal for this quarter, largest, riskiest, and its season is eight months out, so the right call is to defer it with a clear date to revisit — and to tell the CEO what evidence would move it up. Strong answers say explicitly what is not being done.",
    rubric: PRIORITISATION_RUBRIC,
  },
  {
    slug: "pr-support-backlog",
    title: "Twelve customer requests, capacity for three",
    format: "prioritisation",
    domain: "product_management",
    difficulty: "easy",
    minutes: 20,
    scenario:
      "You are the only product manager for an HR software tool used by mid-sized companies. Customer success has sent you the twelve most-requested features. The top five by number of requests are:\n\n1. Dark mode — 310 requests, very small effort.\n2. Leave approvals on mobile — 240 requests, medium effort. Most requests come from managers at your largest customers.\n3. Payroll export to two regional accounting tools — 90 requests, medium effort. Three accounts up for renewal next month have said they will leave without it.\n4. Custom report builder — 180 requests, large effort.\n5. Single sign-on — 60 requests, medium effort. A prerequisite in most enterprise sales deals, which are the company's growth priority.\n\nYou can deliver roughly three medium-sized items this quarter.",
    instructions:
      "Decide which three to build and in what order. Explain your criteria, and say what you would tell the customers whose requests you are not doing.",
    expected_framework:
      "Request counts are one signal, not the decision. Weigh revenue at risk (payroll export: three renewals next month — urgent, concrete), strategic fit (SSO unlocks the stated growth priority), and breadth of pain among important users (mobile leave approvals for managers at the largest accounts). Dark mode is cheap and popular but low value; it can ride along only if genuinely trivial. The custom report builder is large and loosely specified — worth discovery, not a build. Strong answers communicate honestly to those who lose out, with what would change the decision.",
    rubric: PRIORITISATION_RUBRIC,
  },
  {
    slug: "pr-tech-debt-vs-features",
    title: "Tech debt or new features: engineering and sales disagree",
    format: "prioritisation",
    domain: "product_management",
    difficulty: "hard",
    minutes: 25,
    scenario:
      "At a logistics-tracking startup, the engineering lead wants to spend next quarter rebuilding the notification service, which caused four outages in six months, each lasting 2–5 hours and triggering service credits to customers. Sales wants a route-optimisation feature that two large prospects have asked for, together worth about as much new annual revenue as the company currently earns from its ten biggest customers. Both need the whole platform team for the quarter.",
    instructions:
      "Recommend how to split or sequence the quarter. Make the trade-off explicit, estimate what each path risks, and say how you would bring engineering and sales to the decision.",
    expected_framework:
      "Frame both as revenue questions. Outages threaten existing revenue (service credits, churn risk at renewal, and the credibility sales depends on); the feature is prospective revenue that is not yet signed. Look for options between all-or-nothing: stabilise the notification service's worst failure mode first (monitoring, fail-over) in a fraction of the quarter, and scope a route-optimisation pilot the prospects can sign against. Ask sales for commitment evidence (letters of intent, pilot terms) before the team is fully redirected. The decision should be explicit about what risk is being accepted and have a review point.",
    rubric: PRIORITISATION_RUBRIC,
  },

  // ---- equity research note -----------------------------------------------
  {
    slug: "rn-specialty-chemicals-initiation",
    title: "Initiate coverage: a mid-cap specialty chemicals company",
    format: "research_note",
    domain: "finance",
    difficulty: "hard",
    minutes: 45,
    scenario:
      "You are writing an initiation note on a listed mid-cap specialty chemicals maker (a hypothetical company).\n\n- Share price ₹1,240; 10 crore shares outstanding.\n- Net debt ₹800 crore.\n- FY26 revenue ₹4,000 crore; EBITDA margin 18%.\n- Management guides revenue growth of 15% a year for three years, with margins rising to 20% as a new plant ramps up. The plant is 70% built; the last two plant commissionings ran 9 and 14 months late.\n- Listed peers trade at 14x–18x forward EV/EBITDA; the median is 16x.\n- 45% of revenue comes from three export customers.",
    instructions:
      "Write the opening of an equity research note: rating, 12-month target price and thesis first, then the valuation, the key drivers and the main risks. Show your valuation arithmetic.",
    expected_framework:
      "Market cap = ₹1,240 × 10 crore = ₹12,400 crore; EV = ₹13,200 crore. FY26 EBITDA = ₹720 crore, so the stock trades at about 18.3x trailing. On guidance, FY27 revenue ₹4,600 crore at ~19% margin ≈ ₹874 crore EBITDA → at the 16x median, EV ≈ ₹13,980 crore, equity ≈ ₹13,180 crore, about ₹1,318 a share — only ~6% upside, and that assumes guidance is met. A delayed plant (history says likely) keeps margins nearer 18% and removes the upside. The strong answer notices that the stock already prices in guidance, weighs execution and customer-concentration risk, and so lands on hold or sell unless there is a reason to pay above the peer median — and states the falsifier: the plant commissioning on time.",
    rubric: RESEARCH_NOTE_RUBRIC,
  },
  {
    slug: "rn-private-bank-results",
    title: "Results note: a private bank's quarter",
    format: "research_note",
    domain: "finance",
    difficulty: "medium",
    minutes: 35,
    scenario:
      "A mid-sized listed private bank (hypothetical) has reported its quarter. You covered it with a Buy.\n\n- Loans grew 22% year on year; deposits grew 11%.\n- Net interest margin fell from 4.1% to 3.8%.\n- Gross NPA ratio rose from 1.9% to 2.4%, driven by unsecured personal loans and credit cards, which are 28% of the book.\n- Return on assets 1.6% (previous year 1.8%).\n- The stock trades at 2.4x book value; peers with similar ROA trade at 1.8x–2.2x.\n- Management says the asset quality blip is seasonal.",
    instructions:
      "Write a results note: state whether your rating changes and why in the first lines, then what the quarter showed, the variables that matter from here, and the risks to your view.",
    expected_framework:
      "The quarter's story is loan growth outrunning deposits (funding pressure, hence margin compression) and rising stress in the riskiest segment. A premium valuation (2.4x book against 1.8–2.2x for peers with similar ROA) was paying for growth plus quality; quality is now slipping and ROA is falling. A disciplined note either downgrades or keeps the rating with an explicit reason the premium is still earned — and does not simply repeat management's 'seasonal' line without asking for evidence (e.g. roll rates, vintage data). Variables: deposit growth, unsecured slippages, credit costs, margin trajectory.",
    rubric: RESEARCH_NOTE_RUBRIC,
  },
  {
    slug: "rn-consumer-durables-ipo",
    title: "IPO note: subscribe or avoid a consumer durables maker",
    format: "research_note",
    domain: "finance",
    difficulty: "medium",
    minutes: 35,
    scenario:
      "A consumer durables company (hypothetical) is launching an IPO.\n\n- Issue price implies a market cap of ₹6,000 crore; the company has no debt.\n- FY26 revenue ₹2,500 crore; net profit ₹150 crore.\n- Three-year revenue growth of 20% a year; net margin rose from 4% to 6% over the same period.\n- 60% of the issue is an offer for sale by the private equity investor; 40% is fresh capital to fund a new factory.\n- Listed peers trade at 35x–45x trailing earnings.",
    instructions:
      "Write an IPO note recommending subscribe or avoid. Put the call and the reason first, then the valuation, what the use of proceeds tells you, and the risks.",
    expected_framework:
      "₹6,000 crore on ₹150 crore of profit is 40x trailing earnings — at the midpoint of peers, so not a discount for a newly listed company. The margin expansion helps but needs to be tested: is it scale, or a one-off in input costs? A 60% offer for sale means most of the money goes to the exiting investor rather than the business; the 40% fresh capital funds a factory that adds execution risk before it adds earnings. A strong note makes a call — typically 'subscribe for listing only if…' or 'avoid' — and prices it rather than listing pros and cons.",
    rubric: RESEARCH_NOTE_RUBRIC,
  },

  // ---- go-to-market plan --------------------------------------------------
  {
    slug: "gtm-ev-charging-housing-societies",
    title: "Go-to-market plan: EV chargers for housing societies",
    format: "gtm_plan",
    domain: "marketing",
    difficulty: "medium",
    minutes: 30,
    scenario:
      "A startup has built a shared electric-vehicle charger that a housing society installs in its parking area, with app-based billing to each resident. Hardware plus installation costs a society about ₹1.5 lakh per charger; the startup also earns a small margin on every unit of electricity. It has ₹50 lakh for marketing and sales in its first year and a team of four, all in one metro city.",
    instructions:
      "Write a go-to-market plan for the first year. Choose the segment to win first and why, define the proposition and pricing, pick channels and a sequence with rough economics, and set milestones that would tell you whether to scale.",
    expected_framework:
      "The buyer is not the EV owner but the society's managing committee — often older, cautious and cost-sensitive — while the user is a minority of residents. The beachhead is societies that already have several EVs and a resident complaint (people running cables from flats), in a few dense neighbourhoods. Proposition to the committee: safety, fair billing, no cost to non-EV residents (so offer a lease, revenue share or zero-upfront model). Channels: EV-owner communities and dealership partnerships to find the societies, then direct sales to committees with a pilot. Economics: acquisition cost per society against lifetime electricity margin plus hardware. Milestones: pilots signed, utilisation per charger, time from first meeting to committee approval.",
    rubric: GTM_RUBRIC,
  },
  {
    slug: "gtm-b2b-attendance-app",
    title: "Launch plan: a staff attendance app for small restaurants",
    format: "gtm_plan",
    domain: "marketing",
    difficulty: "easy",
    minutes: 25,
    scenario:
      "A software company has built a simple mobile app for small restaurants and cafés to track staff attendance, shifts and advance salary payments. It is priced at ₹499 a month per outlet. Research shows owners currently use paper registers or WhatsApp groups, and their biggest complaint is disputes over hours and advances at month end.",
    instructions:
      "Write a go-to-market plan for the first six months in two cities. Cover the target segment, the pitch, channels, pricing or trial, and the milestones you would track.",
    expected_framework:
      "Segment by pain, not by size: outlets with high staff turnover and frequent advances (quick-service, cloud kitchens). Pitch the outcome — no month-end disputes — not 'digital attendance'. Owners are reached through the people they already trust and the tools they already use: POS and billing-software resellers, food-supply distributors, and restaurant associations; field sales in dense food streets works because outlets cluster. A free first month tied to one pay cycle lets the value show. Milestones: activation (staff actually clocking in), paid conversion after the first cycle, churn after three months, cost per paying outlet.",
    rubric: GTM_RUBRIC,
  },
  {
    slug: "gtm-premium-millet-snacks",
    title: "Go-to-market: a premium millet snack brand",
    format: "gtm_plan",
    domain: "marketing",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "A new brand makes baked millet snacks at a price about 60% above mainstream packaged namkeen. Gross margin is 45% if sold direct, falling to about 20% through modern-trade retail after distributor and retailer margins. The founders have ₹2 crore to spend in year one and want to be in 5,000 stores within two years.",
    instructions:
      "Write the year-one go-to-market plan. Decide where to sell first and to whom, how to price and position, how to split the budget across channels, and what would make you change course.",
    expected_framework:
      "The founders' 5,000-store goal conflicts with the economics: at 20% margin through retail, a premium brand with no awareness burns cash on shelf space and slow rotation. A strong plan starts where margin and the right customer overlap — direct online and quick-commerce in a few metros, targeting health-conscious urban buyers — to build repeat purchase and proof of rotation, then enters a limited set of premium retail stores with that data. Position on a specific occasion (office snacking, children's tiffin) rather than 'healthy'. Budget weighted to sampling and repeat-driving over broad awareness. Milestones: repeat rate, contribution margin per order, sell-through per store in the retail pilot; a weak repeat rate says the product, not distribution, is the problem.",
    rubric: GTM_RUBRIC,
  },

  // ---- marketing mix ------------------------------------------------------
  {
    slug: "mm-hair-oil-rural-decline",
    title: "Marketing mix: a hair oil brand losing share in small towns",
    format: "marketing_mix",
    domain: "marketing",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "A hair oil brand sells a 200 ml bottle at ₹120. In metros its share is stable. In towns below 10 lakh population its share has fallen from 14% to 9% in two years. In those towns: a regional competitor sells a ₹10 sachet and a ₹60 bottle; the brand's distributor covers 55% of the retail outlets the competitor reaches; the brand's TV advertising runs on national channels only; and a consumer survey shows people in these towns rate the brand's product quality as high as the competitor's.",
    instructions:
      "Diagnose which parts of the marketing mix are causing the decline and recommend changes. Say what you would not change, and check that the recommendation makes economic sense.",
    expected_framework:
      "Product is not the problem — quality perceptions are equal, so do not reformulate. The evidence points to price-pack (no low entry price or sachet where cash-in-hand purchases dominate) and place (reaching only 55% of the competitor's outlets). Promotion on national TV is a smaller issue than being absent from the shelf. Recommend a small-pack or sachet price point and an expansion of rural distribution, perhaps through sub-distributors, with regional-language in-store visibility. Check economics: sachet margins per millilitre and the cost of extending distribution against the share recoverable.",
    rubric: MARKETING_MIX_RUBRIC,
  },
  {
    slug: "mm-premium-coffee-chain-footfall",
    title: "Marketing mix: a café chain with falling footfall",
    format: "marketing_mix",
    domain: "marketing",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "A premium café chain has 80 outlets. Average ticket size rose from ₹310 to ₹380 over two years after a menu upgrade and price rise. Footfall per outlet fell 18% in the same period. Outlets in office districts lost the most footfall; outlets in residential malls grew slightly. Loyalty-app data shows weekday morning visits fell sharply while weekend afternoon visits held up. A delivery-first competitor sells a comparable coffee for ₹180.",
    instructions:
      "Work out what is really happening, then recommend changes to the mix. Be specific about which levers to pull and which to leave alone, and check the effect on revenue per outlet.",
    expected_framework:
      "Revenue per outlet: footfall down 18%, ticket up about 23% — revenue roughly flat, so the headline is not a collapse but a change in who comes. The chain has priced out the high-frequency weekday office customer (whose alternative is a ₹180 delivery coffee) while keeping the leisure customer. Two coherent options: defend the weekday occasion with a value morning offer, grab-and-go format or subscription in office-district outlets; or accept the premium leisure position and rebalance the footprint towards residential and mall locations. The mix must be consistent: a morning value offer inside a premium dine-in space needs a different format. Strong answers pick one and quantify it.",
    rubric: MARKETING_MIX_RUBRIC,
  },

  // ---- campaign critique --------------------------------------------------
  {
    slug: "cc-viral-video-no-sales",
    title: "Critique: a viral video campaign that did not move sales",
    format: "campaign_critique",
    domain: "marketing",
    difficulty: "medium",
    minutes: 25,
    scenario:
      "A mid-priced mattress brand (hypothetical) ran a humorous online video campaign for six weeks with a budget of ₹3 crore. Results reported by the agency:\n\n- 4.2 crore video views, and 3 lakh shares.\n- Brand search volume up 60% during the campaign, back to normal two weeks after.\n- Website visits up 45%; website conversion rate fell from 1.8% to 1.1%.\n- Sales in the campaign period were up 4% year on year; category sales grew 6%.\n- The video's joke centred on a couple arguing; the mattress appeared in the last five seconds.",
    instructions:
      "Critique the campaign. State what it was presumably meant to achieve, read the results properly, explain why it worked or did not, and say what you would test next.",
    expected_framework:
      "Views and shares measure reach and entertainment, not business outcome. The honest read: attention spiked and faded, visits rose but converted worse (curious non-buyers), and sales grew slower than the category — so the brand lost share during a ₹3 crore campaign. Likely causes: the brand was not central to the idea (the mattress appears in the last five seconds, so people remembered the joke, not the brand) and the audience was broad rather than people in the market for a mattress, a long-cycle purchase. Next: tie creative to a clear product reason to buy, target in-market signals, and measure incremental sales against a control region rather than views.",
    rubric: CAMPAIGN_CRITIQUE_RUBRIC,
  },
  {
    slug: "cc-festive-discount-campaign",
    title: "Critique: a festive discount campaign with record revenue",
    format: "campaign_critique",
    domain: "marketing",
    difficulty: "hard",
    minutes: 30,
    scenario:
      "An online fashion retailer (hypothetical) ran a festive-season campaign offering 40% off sitewide, promoted heavily through performance marketing. The marketing team is celebrating:\n\n- Revenue in the 10-day sale was 2.6x the previous 10 days.\n- New customers acquired: 1.2 lakh, at an average acquisition cost of ₹650.\n- Average order value fell from ₹1,900 to ₹1,450.\n- In the month after the sale, revenue was 35% below the same month last year.\n- Return rate during the sale was 32%, against a normal 22%.\n- Of customers acquired in last year's festive sale, 14% made a second purchase within six months.",
    instructions:
      "Critique the campaign's real results. Decide whether it created value, show the numbers that support your view, and recommend what to change for next year.",
    expected_framework:
      "Revenue in the window is the wrong measure. The 35% slump afterwards suggests the sale pulled demand forward rather than creating it. Higher returns shrink net revenue further. At a ₹1,450 order value with 40% off, gross margin per order is thin; ₹650 to acquire a customer who, on last year's evidence, has only a 14% chance of buying again is unlikely to pay back. A strong critique computes something — net of returns, of the post-sale dip, or of acquisition cost against repeat rate — and recommends targeted rather than sitewide discounting, success measured on incremental contribution over the season.",
    rubric: CAMPAIGN_CRITIQUE_RUBRIC,
  },
  {
    slug: "cc-influencer-launch-skincare",
    title: "Critique: an influencer launch for a skincare serum",
    format: "campaign_critique",
    domain: "marketing",
    difficulty: "easy",
    minutes: 20,
    scenario:
      "A new skincare brand (hypothetical) launched a ₹899 serum through 40 micro-influencers (10,000–80,000 followers each), each given a unique discount code. In the first month:\n\n- Total reach reported: 18 lakh.\n- Code redemptions: 6,200 orders. Five influencers drove 70% of them.\n- The top five posted tutorials showing the product in a routine; most of the others posted a single photo with the code.\n- Repeat purchase within 45 days: 21% of first-time buyers.",
    instructions:
      "Critique the launch: what worked, what did not, what the numbers say, and what the brand should do with its next month's budget.",
    expected_framework:
      "Reach is not the story; the concentration is. Five influencers drove 70% of orders, and they are the ones who demonstrated use — the format, not the follower count, sold the product. A 21% repeat rate within 45 days is a reasonable early signal for a serum and suggests the product satisfies. Next month: move budget to the top performers and to tutorial-style content, test whether that format works with new creators, and measure cost per first order and repeat rate per influencer rather than reach. Watch for code leakage to coupon sites inflating attribution.",
    rubric: CAMPAIGN_CRITIQUE_RUBRIC,
  },
];
