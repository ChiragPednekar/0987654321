/**
 * Prep courses for the second set of certificate exams (migration 081):
 * operations and supply chain, marketing and brand management, business
 * strategy, and the MBB case interview.
 *
 * Same shape and the same rule as src/lib/cert-courses.ts: every module is
 * gated by a knowledge check in src/lib/cert-course-checks.ts, and no course
 * recommends a case its own exam is sat on (tests/cert-courses.test.ts).
 */

import type { CertCourse, CourseCaseRecommendation } from "./cert-courses";

function rec(
  slug: string,
  title: string,
  companyTrack: string,
  difficulty: CourseCaseRecommendation["difficulty"],
  estimatedMinutes: number,
  focus: string,
): CourseCaseRecommendation {
  return { slug, title, companyTrack, difficulty, estimatedMinutes, focus };
}

export const MORE_CERT_COURSES: Record<string, CertCourse> = {
  // ------------------------------------------------------------ operations --
  "operations-supply-chain-certificate": {
    examSlug: "operations-supply-chain-certificate",
    track: "Operations",
    title: "Operations & Supply Chain Cases",
    subtitle: "A 4-module course on capacity and bottlenecks, inventory and service levels, quality and sourcing decisions, and network design.",
    description:
      "Operations interviews — at Kearney, in FMCG supply chain roles, at e-commerce and manufacturing firms — reward candidates who can find the constraint, put a number on it and say what to change on Monday. This course teaches the handful of tools that answer most operations cases and the traps that catch candidates who only know the definitions.",
    estimatedHours: 7,
    prerequisites: [
      "Comfort with averages, percentages and simple rates (units per hour)",
      "A rough idea of how a factory or warehouse works",
    ],
    targetAudience: "Students preparing for operations consulting, supply chain, manufacturing and e-commerce operations roles.",
    modules: [
      {
        id: "ops-mod-1",
        order: 1,
        title: "Process Flow, Capacity & Bottlenecks",
        durationMinutes: 100,
        summary: "Map a process, find the step that limits output, and work out what extra capacity is worth.",
        keyConcepts: [
          "Capacity, utilisation and throughput",
          "The bottleneck sets the output of the whole line",
          "Little's Law: inventory = throughput × time",
          "Debottlenecking vs adding capacity",
        ],
        studyGuide: {
          overview:
            "A process can only go as fast as its slowest step. Most operations cases hide the bottleneck among several steps that look busy; the skill is to compute each step's capacity in the same units, find the lowest, and know that capacity added anywhere else is wasted.",
          frameworkTitle: "Bottleneck Diagnosis in Four Steps",
          frameworkSteps: [
            { step: "1. Map the flow", detail: "List every step in order with its resources (machines, people) and time per unit. Note where work waits." },
            { step: "2. Put every step in one unit", detail: "Convert to units per hour (or per day) for each step: resources × (60 ÷ minutes per unit) × hours available." },
            { step: "3. Find the constraint", detail: "The step with the lowest capacity is the bottleneck. Compare it with demand: if demand is higher, that step limits sales." },
            { step: "4. Value the fix", detail: "An extra hour at the bottleneck is an extra hour of output for the whole line; an extra hour elsewhere is worth nothing. Price the fix against the margin on the extra units." },
          ],
          rulesOfThumb: [
            "Queues build in front of the bottleneck — the pile of work in progress is a clue.",
            "Utilisation above about 85% makes waiting times climb steeply when arrivals vary.",
            "Little's Law (WIP = throughput × flow time) turns any two of the three into the third.",
          ],
          commonPitfalls: [
            "Speeding up the busiest-looking step instead of the one with the lowest capacity.",
            "Mixing units — minutes per unit at one step, units per day at another.",
            "Forgetting that once the bottleneck is fixed, a different step becomes the new constraint.",
          ],
        },
        checkpoints: [
          "I can find the bottleneck in a five-step process in under two minutes.",
          "I can use Little's Law to get flow time from inventory and throughput.",
          "I can value an extra hour of capacity at the bottleneck.",
        ],
        recommendedCases: [
          rec("throughput-bottleneck-1", "Halcyon Bank: Orders Are Piling Up", "BCG", "easy", 35, "Finding the constraint in a multi-step process"),
          rec("throughput-bottleneck-2", "Lumen Learning: Orders Are Piling Up", "Razorpay", "medium", 35, "Valuing capacity at the bottleneck"),
        ],
      },
      {
        id: "ops-mod-2",
        order: 2,
        title: "Inventory, Safety Stock & Service Levels",
        durationMinutes: 100,
        summary: "How much stock to hold, why, and what it costs — the trade-off between running out and tying up cash.",
        keyConcepts: [
          "Cycle stock vs safety stock",
          "Lead time and demand variability",
          "Service level and the cost of a stock-out",
          "Inventory holding cost and working capital",
        ],
        studyGuide: {
          overview:
            "Inventory exists to absorb two things: the gap between orders (cycle stock) and uncertainty in demand or supply (safety stock). Safety stock grows with the variability of demand and with the length of the lead time — not with average demand alone. Every unit held costs money, so the question is always which service level is worth paying for.",
          frameworkTitle: "Setting Stock Levels",
          frameworkSteps: [
            { step: "1. Separate the two kinds of stock", detail: "Cycle stock is about half an order quantity on average; safety stock is the buffer held for uncertainty." },
            { step: "2. Measure the uncertainty", detail: "How much does demand vary per period, and how long and reliable is the supplier's lead time?" },
            { step: "3. Choose a service level", detail: "Safety stock ≈ z × σ(demand) × √(lead time). Higher service (bigger z) costs more stock for each extra point." },
            { step: "4. Compare costs", detail: "Weigh holding cost (capital, space, obsolescence — often 20–30% of value a year) against the margin and goodwill lost on stock-outs." },
          ],
          rulesOfThumb: [
            "Halving lead-time variability can cut safety stock more than any forecasting project.",
            "Going from 95% to 99% service needs disproportionately more stock — the last points are the most expensive.",
            "Treat fast movers and slow movers differently (ABC classification).",
          ],
          commonPitfalls: [
            "Setting safety stock as a fixed number of days of average demand, ignoring variability.",
            "Ignoring the cash tied up in inventory when recommending higher service levels.",
            "Assuming one service level for every product.",
          ],
        },
        checkpoints: [
          "I can explain why safety stock depends on variability, not just average demand.",
          "I can estimate the annual cost of holding extra inventory.",
          "I can argue for different service levels for different products.",
        ],
        recommendedCases: [
          rec("safety-stock-3", "Marlow Chemicals: How Much Stock Is the Right Amount?", "Morgan Stanley", "easy", 35, "Cycle stock, safety stock and holding cost"),
          rec("safety-stock-1", "Northwind Energy: How Much Stock Is the Right Amount?", "Amazon", "medium", 35, "Service level versus working capital"),
        ],
      },
      {
        id: "ops-mod-3",
        order: 3,
        title: "Quality Economics & Make-vs-Buy",
        durationMinutes: 110,
        summary: "When fixing a process beats inspecting it, and when making something yourself beats buying it.",
        keyConcepts: [
          "Cost of poor quality: scrap, rework, returns, lost customers",
          "Prevention vs inspection",
          "Relevant costs in make-vs-buy: incremental only",
          "Strategic factors: control, capability, risk",
        ],
        studyGuide: {
          overview:
            "Two decisions recur in operations cases. Quality: inspection catches defects after they are made, prevention stops them being made — and defects found later cost far more. Make-vs-buy: compare only the costs that change with the decision, then weigh capability, control and supply risk.",
          frameworkTitle: "Two Decision Rules",
          frameworkSteps: [
            { step: "1. Count the full cost of a defect", detail: "Scrap and rework inside the plant, plus returns, warranty and lost repeat business outside it. Escaped defects usually cost many times more than ones caught early." },
            { step: "2. Compare prevention with inspection", detail: "Fixing the cause has an upfront cost and removes defects; extra inspection has a running cost and only catches some of them." },
            { step: "3. Make-vs-buy on incremental cost", detail: "Making in-house costs the variable cost plus any new fixed cost (equipment, staff). Allocated overheads that do not change are irrelevant." },
            { step: "4. Add what the numbers miss", detail: "Volume needed to break even, capability to make it well, dependence on one supplier, and whether the part is core to how the company competes." },
          ],
          rulesOfThumb: [
            "A defect costs least where it is made and most once it reaches a customer.",
            "Make-vs-buy break-even volume = new fixed cost ÷ (purchase price − variable cost of making).",
            "Do not make something just because there is spare capacity — check it covers its incremental cost.",
          ],
          commonPitfalls: [
            "Including sunk costs or allocated overheads in make-vs-buy.",
            "Treating inspection as a cure for a process problem.",
            "Ignoring volume: making in-house rarely pays at low volume.",
          ],
        },
        checkpoints: [
          "I can compute the break-even volume for making a part in-house.",
          "I can separate relevant from irrelevant costs in a make-vs-buy decision.",
          "I can show why preventing a defect beats inspecting for it.",
        ],
        recommendedCases: [
          rec("quality-economics-1", "Ferro Industries: Inspect More, or Fix the Line?", "Amazon", "easy", 35, "Prevention vs inspection economics"),
          rec("make-vs-buy-2", "Tessellate: Build the Line or Keep Buying?", "Morgan Stanley", "medium", 40, "Incremental costs and break-even volume"),
        ],
      },
      {
        id: "ops-mod-4",
        order: 4,
        title: "Network Design & Supply Risk",
        durationMinutes: 110,
        summary: "How many warehouses, where, and how much to pay to avoid depending on one supplier.",
        keyConcepts: [
          "Warehouse count vs transport cost and delivery time",
          "Inventory pooling",
          "Single-sourcing risk and expected loss",
          "Dual sourcing as insurance",
        ],
        studyGuide: {
          overview:
            "More warehouses mean shorter, cheaper last-mile delivery and faster service, but more fixed cost and more inventory, because stock is split across locations. Supply risk is the same kind of trade-off: a second supplier costs more in normal times and pays back when the first one fails.",
          frameworkTitle: "Network and Risk Trade-offs",
          frameworkSteps: [
            { step: "1. Define the service promise", detail: "What delivery time do customers need? That sets the maximum distance from a warehouse." },
            { step: "2. Trade fixed against variable cost", detail: "Each extra site adds rent and staff and cuts outbound transport; total cost is U-shaped in the number of sites." },
            { step: "3. Count the inventory effect", detail: "Splitting stock across sites raises the safety stock needed; consolidating pools the uncertainty." },
            { step: "4. Price supply risk", detail: "Expected loss = probability of disruption × cost of disruption. Compare it with the extra cost of a second supplier, and remember the worst case, not just the average." },
          ],
          rulesOfThumb: [
            "Safety stock across n identical sites is roughly √n times that of one central site.",
            "A second supplier at a higher price is insurance: value it on the disruption it prevents.",
            "Regional concentration (one supplier, one region) is a risk even with two suppliers there.",
          ],
          commonPitfalls: [
            "Minimising transport cost alone and ignoring fixed and inventory cost.",
            "Valuing a supply disruption on average loss only, ignoring that some losses are existential.",
            "Assuming a backup supplier can scale up instantly.",
          ],
        },
        checkpoints: [
          "I can explain why total network cost is U-shaped in the number of warehouses.",
          "I can compute the expected annual loss from a supply disruption.",
          "I can argue for or against dual sourcing with numbers.",
        ],
        recommendedCases: [
          rec("network-design-1", "Bluepeak Logistics: How Many Distribution Centres?", "Amazon", "medium", 50, "Fixed vs transport vs inventory cost"),
          rec("dual-sourcing-1", "Granite Materials: One Supplier, One Region, One Problem", "Bain", "medium", 40, "Pricing supply risk and the value of a second source"),
        ],
      },
    ],
  },

  // ------------------------------------------------------------- marketing --
  "marketing-brand-certificate": {
    examSlug: "marketing-brand-certificate",
    track: "Marketing",
    title: "Marketing & Brand Management Cases",
    subtitle: "A 4-module course on acquisition economics, channel mix and attribution, retention and loyalty, and go-to-market against an incumbent.",
    description:
      "Brand management and marketing interviews — FMCG, consumer tech, D2C — increasingly ask for numbers alongside creativity: what a customer is worth, what it costs to win one, which channel deserves the next rupee. This course teaches those numbers and how to turn them into a launch plan a marketing head would back.",
    estimatedHours: 7,
    prerequisites: [
      "Comfort with percentages, averages and simple ratios",
      "Familiarity with how consumers discover and buy products",
    ],
    targetAudience: "Students preparing for brand management, marketing, growth and D2C roles.",
    modules: [
      {
        id: "mkt-mod-1",
        order: 1,
        title: "Customer Economics: CAC, LTV & Payback",
        durationMinutes: 100,
        summary: "What a customer is worth, what it costs to win one, and how long it takes to earn the cost back.",
        keyConcepts: [
          "Customer acquisition cost (CAC)",
          "Lifetime value from margin, frequency and retention",
          "Payback period",
          "Blended vs paid CAC",
        ],
        studyGuide: {
          overview:
            "Growth that costs more to buy than it earns destroys value however fast it looks. The core test compares the contribution a customer generates over their life with what it cost to acquire them — and how long the money is out before it comes back.",
          frameworkTitle: "The Unit Economics Test",
          frameworkSteps: [
            { step: "1. Compute CAC", detail: "Marketing and sales spend ÷ new customers acquired, for the same period and the same channel." },
            { step: "2. Compute contribution per period", detail: "Revenue per customer per month × gross margin — not revenue." },
            { step: "3. Lifetime and LTV", detail: "Expected lifetime ≈ 1 ÷ monthly churn; LTV ≈ monthly contribution × lifetime." },
            { step: "4. Judge", detail: "LTV/CAC of about 3 or more is healthy; payback = CAC ÷ monthly contribution. Long paybacks need cash and confidence in retention." },
          ],
          rulesOfThumb: [
            "Use margin, not revenue, in LTV.",
            "Blended CAC (including organic customers) flatters paid channels — look at paid CAC on its own.",
            "A small rise in churn cuts LTV sharply, because lifetime is 1 ÷ churn.",
          ],
          commonPitfalls: [
            "Calculating LTV on revenue.",
            "Comparing CAC and LTV from different cohorts or periods.",
            "Ignoring payback time when cash is tight.",
          ],
        },
        checkpoints: [
          "I can compute LTV from margin, frequency and churn.",
          "I can compute payback in months.",
          "I can explain why blended CAC can mislead.",
        ],
        recommendedCases: [
          rec("cac-payback-3", "Marlow Chemicals: Is the Growth Worth What It Costs?", "Flipkart", "easy", 35, "CAC, LTV and payback from first principles"),
          rec("cac-payback-1", "Northwind Energy: Is the Growth Worth What It Costs?", "Bain", "medium", 35, "Judging whether growth creates value"),
        ],
      },
      {
        id: "mkt-mod-2",
        order: 2,
        title: "Channel Mix & Attribution",
        durationMinutes: 110,
        summary: "Where the next rupee of budget should go, and why every channel claims credit for the same sale.",
        keyConcepts: [
          "Marginal vs average return on spend",
          "Diminishing returns by channel",
          "Last-click vs multi-touch attribution",
          "Incrementality and holdout tests",
        ],
        studyGuide: {
          overview:
            "Budget decisions are about the next rupee, not the average one. A channel with a great average return may be saturated; a modest one may still have room. And channel reports overlap — each claims the sale it touched — so the sum of attributed sales usually exceeds real sales.",
          frameworkTitle: "Allocating the Next Rupee",
          frameworkSteps: [
            { step: "1. Get comparable numbers", detail: "CAC or return on spend per channel, measured the same way." },
            { step: "2. Look at the margin, not the average", detail: "Estimate what the last tranche of spend in each channel bought. Move money from channels where it is low to where it is high." },
            { step: "3. Reconcile attribution", detail: "If channel-reported conversions add up to more than total sales, they are double counting. Last-click over-credits the final touch (often search); first-click over-credits discovery." },
            { step: "4. Test incrementality", detail: "Turn spend off for a holdout region or group and measure what actually drops. That is the channel's true contribution." },
          ],
          rulesOfThumb: [
            "Equalise marginal returns across channels, not average returns.",
            "Branded search mostly captures demand other channels created.",
            "If channels' attributed sales sum to more than total sales, at least one is over-claiming.",
          ],
          commonPitfalls: [
            "Moving all budget to the channel with the best average CAC.",
            "Trusting each platform's own attribution report.",
            "Cutting upper-funnel spend because last-click gives it no credit.",
          ],
        },
        checkpoints: [
          "I can explain why marginal, not average, return should drive allocation.",
          "I can spot double counting in channel reports.",
          "I can design a simple holdout test.",
        ],
        recommendedCases: [
          rec("channel-mix-1", "Vantage Analytics: Where Should the Acquisition Budget Go?", "Morgan Stanley", "easy", 40, "Reallocating budget by marginal return"),
          rec("channel-attribution-1", "Granite Materials: Every Channel Claims the Same Sale", "McKinsey", "medium", 40, "Reconciling over-claimed attribution"),
        ],
      },
      {
        id: "mkt-mod-3",
        order: 3,
        title: "Retention, Cohorts & Loyalty Programmes",
        durationMinutes: 100,
        summary: "Read cohort curves, find why customers leave, and test whether a loyalty programme pays for itself.",
        keyConcepts: [
          "Cohort analysis",
          "Churn and retention curves",
          "Incremental vs subsidised behaviour",
          "Loyalty programme cost: rewards, breakage, operations",
        ],
        studyGuide: {
          overview:
            "Aggregate retention numbers hide what is happening: a growing business can look healthy while each new cohort leaves faster. Cohorts show it. Loyalty programmes are judged the same way — the question is whether they change behaviour, or just reward customers who would have bought anyway.",
          frameworkTitle: "Retention Diagnosis",
          frameworkSteps: [
            { step: "1. Split by cohort", detail: "Group customers by when they joined and compare retention month by month. Are newer cohorts worse?" },
            { step: "2. Find what changed", detail: "Channel mix, discounts at acquisition, product changes, or service issues around the time cohorts weakened." },
            { step: "3. Size the loyalty case", detail: "Benefit = extra purchases the programme causes × margin. Cost = rewards given (including to customers who would have bought anyway) + running costs − breakage." },
            { step: "4. Decide and test", detail: "Pilot with a control group to measure incremental behaviour before rolling out." },
          ],
          rulesOfThumb: [
            "Customers acquired on heavy discounts usually retain worse.",
            "Most of a loyalty programme's cost goes to customers who were already loyal.",
            "Breakage (unredeemed points) lowers cost, but programmes designed around breakage annoy customers.",
          ],
          commonPitfalls: [
            "Reading a blended retention rate instead of cohorts.",
            "Counting all purchases by members as caused by the programme.",
            "Ignoring operating cost of the programme.",
          ],
        },
        checkpoints: [
          "I can read a cohort table and say whether retention is getting worse.",
          "I can separate incremental from subsidised purchases.",
          "I can decide whether a loyalty programme pays for itself.",
        ],
        recommendedCases: [
          rec("loyalty-programme-1", "Ferro Industries: Will the Loyalty Programme Pay for Itself?", "Razorpay", "easy", 35, "Incremental benefit vs reward cost"),
          rec("retention-diagnosis-mkt-1", "Bluepeak Logistics: Newer Customers Are Leaving Faster", "Razorpay", "medium", 40, "Cohort diagnosis of falling retention"),
        ],
      },
      {
        id: "mkt-mod-4",
        order: 4,
        title: "Go-to-Market Against an Incumbent",
        durationMinutes: 110,
        summary: "Choose a segment, a position and a launch plan that do not fight the market leader on its strongest ground.",
        keyConcepts: [
          "Segmentation, targeting and positioning",
          "Beachhead segment",
          "Distribution and the incumbent's advantages",
          "Launch metrics and kill criteria",
        ],
        studyGuide: {
          overview:
            "An incumbent usually wins a head-on fight: more distribution, more brand, more budget. A launch succeeds by picking a segment the incumbent under-serves, positioning on a difference that segment values, and reaching it through channels the incumbent does not own — then measuring whether it is working early.",
          frameworkTitle: "Launch Plan",
          frameworkSteps: [
            { step: "1. Segment and pick a beachhead", detail: "Which customers are least well served by the incumbent and most valuable to win? Size them." },
            { step: "2. Position", detail: "For [segment], [brand] is the [category] that [difference], unlike [incumbent]. The difference must matter to the segment and be hard to copy quickly." },
            { step: "3. Choose the route to market", detail: "Price, distribution and communication that reach the segment efficiently and avoid the incumbent's strongest channels." },
            { step: "4. Define success", detail: "Trial, repeat rate and CAC targets for the first 90 days, and what you will do if they are missed." },
          ],
          rulesOfThumb: [
            "Repeat rate after the launch spike is the best early sign a product will last.",
            "Expect the incumbent to respond — plan for a price cut or a copy.",
            "A beachhead you can dominate beats a mass market you can only dent.",
          ],
          commonPitfalls: [
            "Targeting 'everyone' and matching the incumbent on its terms.",
            "Positioning on a difference customers do not care about.",
            "Launching without metrics or kill criteria.",
          ],
        },
        checkpoints: [
          "I can write a positioning statement with a real point of difference.",
          "I can choose and justify a beachhead segment.",
          "I can set 90-day launch metrics and kill criteria.",
        ],
        recommendedCases: [
          rec("gtm-launch-2", "Lumen Learning: Launching Into a Market With an Incumbent", "Bain", "medium", 45, "Beachhead and positioning against a leader"),
          rec("gtm-launch-1", "Halcyon Bank: Launching Into a Market With an Incumbent", "Morgan Stanley", "hard", 45, "Full launch plan with metrics and incumbent response"),
        ],
      },
    ],
  },

  // -------------------------------------------------------------- strategy --
  "business-strategy-certificate": {
    examSlug: "business-strategy-certificate",
    track: "Strategy",
    title: "Business Strategy Cases",
    subtitle: "A 4-module course on competitive response, portfolio and capital allocation, the boundaries of the firm, and strategy under uncertainty.",
    description:
      "Strategy cases ask questions with no single right answer — how to respond to a discount entrant, which business deserves capital, whether to buy a supplier, what to do before a regulation lands. What is marked is the quality of the reasoning: clear options, the economics behind each, and a decision with its risks. This course teaches that reasoning.",
    estimatedHours: 8,
    prerequisites: [
      "Comfort with margins, market share and return on capital",
      "Having solved a few consulting-style cases",
    ],
    targetAudience: "Students preparing for strategy, corporate development and general management roles.",
    modules: [
      {
        id: "strat-mod-1",
        order: 1,
        title: "Competitive Dynamics & Responding to Entrants",
        durationMinutes: 110,
        summary: "When to fight a discount entrant, when to ignore it, and how to respond without destroying your own margins.",
        keyConcepts: [
          "Which customers the entrant actually threatens",
          "The cost of matching price across the whole base",
          "Fighting brands and segmented responses",
          "Sources of sustainable advantage",
        ],
        studyGuide: {
          overview:
            "The instinct is to match the entrant's price. That cuts margin on every customer, including the many who were never going to switch. The better response starts with who is at risk, what they value, and what responding costs compared with the share it protects.",
          frameworkTitle: "Responding to an Entrant",
          frameworkSteps: [
            { step: "1. Size the threat", detail: "Which segments does the entrant appeal to, and what share of your profit do they represent?" },
            { step: "2. Cost the responses", detail: "Matching price for everyone, a targeted offer, a fighting brand, or doing nothing — compute the margin given up against the profit protected." },
            { step: "3. Check sustainability", detail: "Can the entrant keep its price (lower cost base) or is it buying share? Is your advantage in cost, brand, network or switching costs?" },
            { step: "4. Decide and set triggers", detail: "Choose a response and the signals (share loss in a segment) that would make you escalate." },
          ],
          rulesOfThumb: [
            "A blanket price cut is the most expensive response; segment first.",
            "A fighting brand protects the core brand's price but can cannibalise it.",
            "An entrant with a structurally lower cost base will not go away on its own.",
          ],
          commonPitfalls: [
            "Matching price everywhere by reflex.",
            "Ignoring the entrant because it is small today.",
            "Not quantifying what each response costs.",
          ],
        },
        checkpoints: [
          "I can compute the margin cost of matching an entrant's price.",
          "I can identify which customer segments are really at risk.",
          "I can compare at least three response options with numbers.",
        ],
        recommendedCases: [
          rec("competitive-response-1", "Bluepeak Logistics Faces a Discount Entrant", "BCG", "medium", 45, "Segmenting the threat before responding"),
          rec("competitive-response-2", "Pallas Pharma Faces a Discount Entrant", "Flipkart", "medium", 45, "Pricing response vs margin protection"),
        ],
      },
      {
        id: "strat-mod-2",
        order: 2,
        title: "Portfolio Strategy & Capital Allocation",
        durationMinutes: 110,
        summary: "Which businesses deserve the next rupee of investment, which to fix, and which to sell.",
        keyConcepts: [
          "Return on capital vs cost of capital",
          "Market growth and competitive position",
          "Invest, fix, harvest, divest",
          "Best owner logic",
        ],
        studyGuide: {
          overview:
            "A company with several businesses has to decide where capital goes. Size and history are not reasons. The test is whether a business earns more than its cost of capital, whether it can grow, and whether this company is the best owner for it.",
          frameworkTitle: "Portfolio Review",
          frameworkSteps: [
            { step: "1. Measure each business", detail: "Return on capital employed, growth, and market position for each unit, on comparable numbers." },
            { step: "2. Compare with the hurdle", detail: "Businesses earning above the cost of capital create value when they grow; those below destroy it as they grow." },
            { step: "3. Assign a role", detail: "Invest (high return, growing), fix (fixable low return), harvest (mature, cash generative), divest (low return, someone else would run it better)." },
            { step: "4. Reallocate", detail: "Move capital from harvest and divest to invest; show the impact on group returns." },
          ],
          rulesOfThumb: [
            "Growth only creates value when returns exceed the cost of capital.",
            "The largest business is often over-funded out of habit.",
            "Sell a business when someone else can earn more from it than you can.",
          ],
          commonPitfalls: [
            "Allocating by revenue size or by last year's budget.",
            "Judging units on profit instead of return on capital.",
            "Keeping a weak business for sentimental reasons.",
          ],
        },
        checkpoints: [
          "I can rank businesses by return on capital against a hurdle rate.",
          "I can assign invest, fix, harvest or divest with reasons.",
          "I can explain the best-owner test.",
        ],
        recommendedCases: [
          rec("portfolio-review-1", "Vantage Analytics: Which Businesses Deserve the Next Rupee?", "Stripe", "hard", 50, "Return on capital and portfolio roles"),
          rec("portfolio-review-2", "Tessellate: Which Businesses Deserve the Next Rupee?", "Goldman Sachs", "hard", 50, "Reallocating capital across units"),
        ],
      },
      {
        id: "strat-mod-3",
        order: 3,
        title: "Boundaries of the Firm: Vertical Integration",
        durationMinutes: 100,
        summary: "When to buy a supplier or a customer, and when a contract does the job better.",
        keyConcepts: [
          "Make, buy or ally",
          "Hold-up risk and specific assets",
          "Margin capture vs loss of flexibility",
          "Alternatives: long-term contracts, minority stakes",
        ],
        studyGuide: {
          overview:
            "Buying a supplier looks attractive when its margins are high or supply is tight. But integration also brings the supplier's capital needs, takes away the option to switch, and can drive away the supplier's other customers. The question is whether ownership solves a problem a contract cannot.",
          frameworkTitle: "Integrate or Contract?",
          frameworkSteps: [
            { step: "1. Name the problem", detail: "Supply security, quality control, cost, or capturing margin? Each points to different solutions." },
            { step: "2. Value the deal", detail: "Price paid vs the supplier's cash flows plus genuine savings; remember the supplier's margin is already in your costs." },
            { step: "3. Weigh what you lose", detail: "Flexibility to switch, the supplier's other customers, management focus, exposure to a new business's cycle." },
            { step: "4. Compare alternatives", detail: "A long-term contract, a joint venture or a minority stake may solve the problem for far less capital." },
          ],
          rulesOfThumb: [
            "Integration makes most sense when assets are specific to the relationship and hold-up is a real risk.",
            "Capturing a supplier's margin is not free: you pay for it in the purchase price.",
            "If a contract can secure supply, it usually beats ownership.",
          ],
          commonPitfalls: [
            "Counting the supplier's whole margin as a saving.",
            "Ignoring that the supplier's other customers may leave.",
            "Not considering contractual alternatives.",
          ],
        },
        checkpoints: [
          "I can explain hold-up risk and when it justifies integration.",
          "I can show why buying a supplier's margin is not free.",
          "I can propose a contractual alternative to integration.",
        ],
        recommendedCases: [
          rec("vertical-integration-1", "Northwind Energy: Buy the Supplier or Keep Buying From Them?", "Amazon", "medium", 45, "Integration economics and lost flexibility"),
          rec("vertical-integration-2", "Basil & Co: Buy the Supplier or Keep Buying From Them?", "Google", "medium", 45, "Contract vs ownership"),
        ],
      },
      {
        id: "strat-mod-4",
        order: 4,
        title: "Strategy Under Uncertainty: Regulation & Transformation",
        durationMinutes: 100,
        summary: "Decide before the facts are known — scenarios, no-regret moves, and staged bets.",
        keyConcepts: [
          "Scenario planning",
          "No-regret moves, options and big bets",
          "Expected value and the downside case",
          "Staging investment with milestones",
        ],
        studyGuide: {
          overview:
            "Many strategy cases end with 'nobody knows' — how strict a regulation will be, whether a transformation will deliver. Waiting is a decision too. The answer is to lay out scenarios, find the moves that are right in all of them, and stage the large commitments so they can be stopped.",
          frameworkTitle: "Deciding Under Uncertainty",
          frameworkSteps: [
            { step: "1. Lay out scenarios", detail: "Two or three plausible outcomes (mild, severe), with rough probabilities and impact on profit." },
            { step: "2. Find no-regret moves", detail: "Actions that pay off in every scenario — do them now." },
            { step: "3. Price the options", detail: "Small investments that keep a choice open (a pilot, preparatory work) are worth paying for when uncertainty is high." },
            { step: "4. Stage the big bets", detail: "Commit in phases with milestones and kill criteria, so new information can change the plan." },
          ],
          rulesOfThumb: [
            "Expected value is not enough — check whether the bad scenario is survivable.",
            "Most transformations fail on execution, not on the idea; budget for change management.",
            "Signposts tell you which scenario is unfolding; define them in advance.",
          ],
          commonPitfalls: [
            "Planning for the single most likely scenario.",
            "Waiting for certainty that will come too late.",
            "Committing all the capital upfront.",
          ],
        },
        checkpoints: [
          "I can build two or three scenarios with probability-weighted impact.",
          "I can name no-regret moves for a case.",
          "I can stage an investment with milestones and kill criteria.",
        ],
        recommendedCases: [
          rec("regulatory-shock-1", "Granite Materials: A Rule Change Is Coming and Nobody Knows How Hard", "Stripe", "medium", 45, "Scenarios and no-regret moves"),
          rec("digital-transformation-1", "Halcyon Bank: A £117 M Transformation Case", "Stripe", "medium", 45, "Staging a large transformation"),
        ],
      },
    ],
  },

  // ------------------------------------------------------------------- MBB --
  "mbb-case-interview-certificate": {
    examSlug: "mbb-case-interview-certificate",
    track: "Consulting",
    title: "MBB Case Interview",
    subtitle: "A 4-module course on the case interview itself: interviewer-led and candidate-led formats, exhibits, case maths out loud, and the synthesis that closes it.",
    description:
      "The consulting course teaches frameworks; this one teaches the interview. McKinsey runs an interviewer-led case with set questions; BCG, Bain and most other firms let you drive. Both test the same things — a structure built for the problem, clean maths, reading an exhibit for its 'so what', and a recommendation that leads with the answer. The exam is two hard MBB-style cases, one in each format.",
    estimatedHours: 8,
    prerequisites: [
      "Having completed a few cases on CaseCode",
      "Fluency with percentages, growth rates and break-even",
    ],
    targetAudience: "Students preparing for McKinsey, BCG, Bain, Kearney, Accenture Strategy and Deloitte case interviews.",
    modules: [
      {
        id: "mbb-mod-1",
        order: 1,
        title: "Formats, Structure & Profitability",
        durationMinutes: 110,
        summary: "How interviewer-led and candidate-led cases run, and how to open either with a structure built for the problem.",
        keyConcepts: [
          "Interviewer-led vs candidate-led cases",
          "Clarifying the objective before structuring",
          "Hypothesis-led issue trees",
          "Profitability: locate the change before explaining it",
        ],
        studyGuide: {
          overview:
            "In an interviewer-led case the questions come in a set order and each answer is marked; in a candidate-led case you choose the path and are marked on whether it was a good one. Either way the first five minutes decide a lot: a clear objective, a structure built for this client, and a hypothesis that tells you where to look first.",
          frameworkTitle: "Opening the Case",
          frameworkSteps: [
            { step: "1. Play back and clarify", detail: "Restate the problem and confirm the objective, time frame and any constraint. Ask only questions that change the structure." },
            { step: "2. Take time and draw the tree", detail: "Ask for a minute. Build 3–4 MECE branches specific to this client, two levels deep." },
            { step: "3. State a hypothesis", detail: "Say where you think the answer lies and why — then which branch you will test first." },
            { step: "4. Locate before you explain", detail: "In profitability, find which segment and which line moved before discussing causes." },
          ],
          rulesOfThumb: [
            "In interviewer-led cases, answer the question asked — then add one insight.",
            "In candidate-led cases, say what you want to do next and why, every time.",
            "The line that moved matters more than the line that is biggest.",
          ],
          commonPitfalls: [
            "Reciting a generic framework.",
            "Asking many clarifying questions that do not change the approach.",
            "Explaining causes before locating where profit fell.",
          ],
        },
        checkpoints: [
          "I can explain how interviewer-led and candidate-led cases differ.",
          "I can open a profitability case with a tailored tree and a hypothesis in two minutes.",
          "I always locate the change before explaining it.",
        ],
        recommendedCases: [
          rec("mbb-mckinsey-easy-1", "Vantage Analytics: Why Did Profit Fall 27%?", "McKinsey", "easy", 25, "Interviewer-led profitability, start to finish"),
          rec("mbb-bcg-medium-2", "Meridian Foods: Why Did Profit Fall 19%?", "BCG", "medium", 40, "Candidate-led profitability with an exhibit"),
        ],
      },
      {
        id: "mbb-mod-2",
        order: 2,
        title: "Market Sizing & Market Entry",
        durationMinutes: 100,
        summary: "Size a market out loud, then test whether the plan's share and payback survive the competition.",
        keyConcepts: [
          "Bottom-up sizing with stated assumptions",
          "Sense-checking an estimate",
          "Share assumptions vs the incumbent",
          "Payback and the realistic case",
        ],
        studyGuide: {
          overview:
            "Interviewers care less about the final number than about whether you can lay out the logic, say it aloud, and catch your own mistakes. In entry cases, the sizing is only the start: the decision rests on whether the expected share is believable against the competitors, and what happens if it is not.",
          frameworkTitle: "Size, Then Stress-Test",
          frameworkSteps: [
            { step: "1. Lay out the equation", detail: "Population × target share × frequency × price — write it before you compute." },
            { step: "2. Compute cleanly and round", detail: "Round to easy numbers, keep track of zeros, and state units at each step." },
            { step: "3. Sense-check", detail: "Compare the answer with something you know. If it is wildly off, find the step that broke." },
            { step: "4. Stress the share", detail: "Recompute profit and payback at a realistic share. Decide on that number, not the plan's." },
          ],
          rulesOfThumb: [
            "Say your assumptions before the interviewer asks for them.",
            "Half the planned share is a useful downside case.",
            "Entry mode (build, buy, partner) changes both cost and speed — compare them on payback and execution risk.",
          ],
          commonPitfalls: [
            "Silent maths — the interviewer cannot credit what they cannot follow.",
            "Accepting the plan's market share without challenge.",
            "Losing a factor of ten in crores and millions.",
          ],
        },
        checkpoints: [
          "I can size a market aloud with every assumption stated.",
          "I can recompute payback at a realistic share.",
          "I can compare entry modes on more than payback.",
        ],
        recommendedCases: [
          rec("mbb-bain-easy-2", "Should Solstice Travel Enter Vietnam?", "Bain", "easy", 25, "Bottom-up sizing and payback"),
          rec("mbb-kearney-medium-3", "Should Pinecrest Grocers Enter Mexico?", "Kearney", "medium", 40, "Stress-testing share against the leader"),
        ],
      },
      {
        id: "mbb-mod-3",
        order: 3,
        title: "Deals & Pricing",
        durationMinutes: 110,
        summary: "Value an acquisition and its synergies, and decide on a price change from break-even and segments.",
        keyConcepts: [
          "Standalone value, premium and walk-away price",
          "Cost vs revenue synergies",
          "Break-even volume for a price change",
          "Segment-level elasticity",
        ],
        studyGuide: {
          overview:
            "Acquisition and pricing cases are where exhibits carry traps. In deals, the trap is paying for synergies the client does not control. In pricing, it is one average elasticity hiding two very different customer groups. Both reward a candidate who asks what the number really means.",
          frameworkTitle: "Two Quantitative Tests",
          frameworkSteps: [
            { step: "1. Deals: separate value from price", detail: "Standalone value = EBITDA × sector multiple. The premium over it must be covered by synergies the buyer keeps." },
            { step: "2. Deals: weight synergies", detail: "Capitalise cost synergies net of integration cost; treat revenue synergies as upside unless proven." },
            { step: "3. Pricing: compute break-even", detail: "Break-even volume loss = price change ÷ (contribution margin + price change)." },
            { step: "4. Pricing: segment", detail: "Compare each segment's likely volume loss with break-even. Raise price where it is below, hold where it is above." },
          ],
          rulesOfThumb: [
            "A walk-away price is set before the negotiation, not during it.",
            "Revenue synergies are delivered far less often than cost synergies.",
            "A price rise that loses fewer customers than break-even increases profit.",
          ],
          commonPitfalls: [
            "Adding the bankers' full revenue-synergy figure to the price.",
            "Deciding on average elasticity when segments differ.",
            "Using revenue margin instead of contribution margin in break-even.",
          ],
        },
        checkpoints: [
          "I can compute standalone value, premium and walk-away price.",
          "I can compute break-even volume for a price change.",
          "I can explain when a targeted increase beats a blanket one.",
        ],
        recommendedCases: [
          rec("mbb-mckinsey-medium-2", "Should Granite Materials Buy a Regional Competitor?", "McKinsey", "medium", 40, "Walk-away price and synergy value"),
          rec("mbb-bain-medium-3", "Marlow Chemicals: Should Prices Go Up 15%?", "Bain", "medium", 40, "Break-even volume and competitor response"),
        ],
      },
      {
        id: "mbb-mod-4",
        order: 4,
        title: "Operations, Growth & the Final Synthesis",
        durationMinutes: 100,
        summary: "Check every option against the need, prioritise growth on incremental profit, and close in 60 seconds.",
        keyConcepts: [
          "Options must cover the gap, not just be cheap",
          "Incremental vs gross profit (cannibalisation)",
          "MECE brainstorming",
          "Answer-first synthesis with risks and next steps",
        ],
        studyGuide: {
          overview:
            "The last minutes of a case are marked heavily. The synthesis should sound like advice to a CEO: the answer first, the two or three numbers behind it, the main risk and what to do next. Getting there needs options checked against the real need and profit counted net of what the client already earns.",
          frameworkTitle: "Closing the Case",
          frameworkSteps: [
            { step: "1. Check feasibility", detail: "Does each option close the gap in time? A cheap option that does not cover the need is not an answer." },
            { step: "2. Count incremental profit", detail: "Net out cannibalisation and the client's existing sales before ranking growth options." },
            { step: "3. Brainstorm in buckets", detail: "Group ideas MECE (e.g. internal vs external, short vs long term) and say which you would test first." },
            { step: "4. Synthesise", detail: "Recommendation → reasons with numbers → risks → next steps. Under a minute." },
          ],
          rulesOfThumb: [
            "Lead with the answer, not with a recap of the case.",
            "One risk, well chosen, beats a list of five.",
            "Next steps should be things the client could start next week.",
          ],
          commonPitfalls: [
            "Recommending the cheapest option without checking it covers the need.",
            "Ranking growth options on gross revenue.",
            "Ending with 'it depends' instead of a decision.",
          ],
        },
        checkpoints: [
          "I check every option against the gap before comparing costs.",
          "I net out cannibalisation before ranking growth options.",
          "I can deliver an answer-first synthesis in under a minute.",
        ],
        recommendedCases: [
          rec("mbb-kearney-medium-1", "Ferro Industries: Running Out of Capacity", "Kearney", "medium", 40, "Options checked against the year-5 gap"),
          rec("mbb-deloitte-hard-2", "Basil & Co: Which Growth Option Should It Back?", "Deloitte", "hard", 55, "Cannibalisation, brainstorm and full synthesis"),
        ],
      },
    ],
  },
};
