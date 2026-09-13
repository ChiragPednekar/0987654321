import type { ObjectiveSeed } from "./types";

/** Finance concepts — the short technicals asked before anyone opens a model. */
export const FINANCE_CONCEPTS: ObjectiveSeed[] = [
  {
    topic: "valuation",
    difficulty: "easy",
    stem: "A company has a WACC of 11% and is evaluating a project with an IRR of 9%. It should:",
    options: [
      "Reject it — the project destroys value",
      "Accept it — a positive IRR is enough",
      "Accept it if payback is under three years",
      "Be indifferent",
    ],
    answer: "Reject it — the project destroys value",
    explanation:
      "A project returning less than the cost of the capital funding it has a negative NPV. Payback ignores the cost of capital entirely and is not a substitute.",
  },
  {
    topic: "valuation",
    difficulty: "medium",
    stem: "In a DCF, which change increases enterprise value the most, all else equal?",
    options: [
      "A 1 percentage point fall in WACC",
      "A 1 percentage point rise in the tax rate",
      "A one-year delay in free cash flows",
      "A rise in working capital",
    ],
    answer: "A 1 percentage point fall in WACC",
    explanation:
      "WACC sits in the denominator of every discounted period and in the terminal value, so a small fall moves value sharply. The other three all reduce value.",
  },
  {
    topic: "capital structure",
    difficulty: "medium",
    stem: "Why is debt usually cheaper than equity for a profitable company?",
    options: [
      "It ranks ahead in a wind-up and the interest is tax deductible",
      "Lenders demand a higher return than shareholders",
      "Debt never affects the cost of equity",
      "Debt does not need to be repaid",
    ],
    answer: "It ranks ahead in a wind-up and the interest is tax deductible",
    explanation:
      "Two reasons, and a good answer gives both: lower risk to the holder because of seniority, plus the tax shield on interest. Note debt raises the cost of equity as leverage grows, which is why the cheapness has a limit.",
  },
  {
    topic: "accounting linkage",
    difficulty: "hard",
    stem: "Depreciation rises by ₹100 with a 25% tax rate. What happens to cash?",
    options: [
      "Cash rises by ₹25",
      "Cash falls by ₹100",
      "Cash is unchanged",
      "Cash rises by ₹75",
    ],
    answer: "Cash rises by ₹25",
    explanation:
      "Depreciation is non-cash. Pre-tax income falls ₹100, tax falls ₹25, net income falls ₹75 — then ₹100 is added back on the cash flow statement, so cash rises by ₹25. The classic linkage question.",
  },
  {
    topic: "multiples",
    difficulty: "medium",
    stem: "Why is EV/EBITDA often preferred to P/E when comparing companies across countries?",
    options: [
      "It is unaffected by capital structure and tax differences",
      "EBITDA is a better measure of cash than net income",
      "It cannot be manipulated",
      "It always produces a lower valuation",
    ],
    answer: "It is unaffected by capital structure and tax differences",
    explanation:
      "EV covers all capital providers and EBITDA sits above interest and tax, so the pair strips out financing and tax regime. EBITDA is not a cash measure — it ignores working capital and capex, which is the standard critique.",
  },
  {
    topic: "working capital",
    difficulty: "medium",
    stem: "A firm extends customer credit from 30 to 60 days. The immediate effect is:",
    options: [
      "Cash falls while reported revenue is unchanged",
      "Revenue and cash both fall",
      "Cash rises as sales increase",
      "No effect until the next financial year",
    ],
    answer: "Cash falls while reported revenue is unchanged",
    explanation:
      "Receivables rise, so cash is consumed. Revenue recognition is unaffected by when the customer pays — the gap between profit and cash is exactly what working capital measures.",
  },
];

/** Accounting — statement mechanics. */
export const ACCOUNTING: ObjectiveSeed[] = [
  {
    topic: "statements",
    difficulty: "easy",
    stem: "Which of these appears on the balance sheet rather than the income statement?",
    options: ["Deferred revenue", "Cost of goods sold", "Interest expense", "Depreciation expense"],
    answer: "Deferred revenue",
    explanation:
      "Deferred revenue is a liability — cash received for a service not yet delivered. The other three are period expenses.",
  },
  {
    topic: "statements",
    difficulty: "medium",
    stem: "Inventory written down by ₹500 affects the cash flow statement how?",
    options: [
      "Added back as a non-cash charge in operating activities",
      "Shown as an outflow in investing activities",
      "Shown as an outflow in financing activities",
      "It does not appear at all",
    ],
    answer: "Added back as a non-cash charge in operating activities",
    explanation:
      "The write-down reduces net income but moves no cash, so it is added back in the operating section like depreciation.",
  },
  {
    topic: "ratios",
    difficulty: "medium",
    stem: "Current assets ₹80 lakh, inventory ₹30 lakh, current liabilities ₹40 lakh. The quick ratio is:",
    options: ["1.25", "2.00", "0.75", "1.50"],
    answer: "1.25",
    explanation:
      "Quick ratio excludes inventory: (80 − 30) / 40 = 1.25. The current ratio of 2.00 is the trap.",
  },
  {
    topic: "revenue recognition",
    difficulty: "hard",
    stem: "A SaaS firm bills ₹12 lakh on 1 April for a twelve-month contract. At 30 June its accounts show:",
    options: [
      "₹3 lakh revenue and ₹9 lakh deferred revenue",
      "₹12 lakh revenue and no liability",
      "No revenue and ₹12 lakh deferred revenue",
      "₹12 lakh revenue and ₹9 lakh receivable",
    ],
    answer: "₹3 lakh revenue and ₹9 lakh deferred revenue",
    explanation:
      "Revenue is recognised as the service is delivered — three months of twelve. The unearned remainder sits as a liability.",
  },
];

/** Marketing concepts. */
export const MARKETING_CONCEPTS: ObjectiveSeed[] = [
  {
    topic: "unit economics",
    difficulty: "medium",
    stem: "CAC is ₹1,200, gross margin per customer per month is ₹150, monthly churn is 5%. LTV:CAC is approximately:",
    options: ["2.5", "1.5", "4.0", "0.4"],
    answer: "2.5",
    explanation:
      "Average lifetime = 1/0.05 = 20 months. LTV = 150 × 20 = ₹3,000. 3,000 / 1,200 = 2.5. The usual venture benchmark is 3, so this is thin.",
  },
  {
    topic: "segmentation",
    difficulty: "easy",
    stem: "A brand targeting 'women aged 25-34 in metros' is segmenting primarily on:",
    options: ["Demographics", "Behaviour", "Needs", "Psychographics"],
    answer: "Demographics",
    explanation:
      "Age, gender and location are demographic. A needs-based or behavioural cut usually predicts purchase better, which is the standard critique of demographic targeting.",
  },
  {
    topic: "pricing",
    difficulty: "medium",
    stem: "Demand falls 8% when price rises 4%. Price elasticity is about −2. Raising price further will:",
    options: [
      "Reduce total revenue",
      "Increase total revenue",
      "Leave revenue unchanged",
      "Increase revenue only if costs fall",
    ],
    answer: "Reduce total revenue",
    explanation:
      "Where demand is elastic (|e| > 1), volume falls faster in percentage terms than price rises, so revenue declines. Revenue is maximised where elasticity equals −1.",
  },
  {
    topic: "distribution",
    difficulty: "medium",
    stem: "A brand moving from general trade to modern trade in India should most expect:",
    options: [
      "Higher listing costs and margin pressure, better data",
      "Lower costs and higher margins",
      "No change to working capital",
      "Reduced need for trade promotions",
    ],
    answer: "Higher listing costs and margin pressure, better data",
    explanation:
      "Modern trade brings scale and sell-through data but charges listing and slotting fees, negotiates harder on margin, and pays on longer terms, which worsens working capital.",
  },
];

/**
 * Current affairs — business and economy.
 *
 * Deliberately shallow in volume and written around durable structural facts
 * rather than this week's headlines, because a seeded bank goes stale and a
 * stale current-affairs question is worse than none. The intended operating
 * model is a recurring refresh, not this file.
 */
export const CURRENT_AFFAIRS: ObjectiveSeed[] = [
  {
    topic: "indian economy",
    difficulty: "easy",
    stem: "Which body sets India's benchmark policy repo rate?",
    options: [
      "The Monetary Policy Committee of the RBI",
      "The Ministry of Finance",
      "SEBI",
      "The NITI Aayog",
    ],
    answer: "The Monetary Policy Committee of the RBI",
    explanation:
      "The MPC, a six-member committee chaired by the RBI Governor, sets the repo rate against a statutory inflation target.",
  },
  {
    topic: "capital markets",
    difficulty: "easy",
    stem: "SEBI's primary remit is:",
    options: [
      "Regulating securities markets and protecting investors",
      "Setting interest rates",
      "Licensing banks",
      "Managing government borrowing",
    ],
    answer: "Regulating securities markets and protecting investors",
    explanation:
      "Banking licences and monetary policy sit with the RBI; government borrowing is managed by the RBI on the government's behalf.",
  },
  {
    topic: "taxation",
    difficulty: "medium",
    stem: "Under GST, which tax applies to an inter-state supply of goods?",
    options: ["IGST", "CGST and SGST", "SGST only", "CGST only"],
    answer: "IGST",
    explanation:
      "Inter-state supplies attract Integrated GST, collected by the centre and apportioned. Intra-state supplies split into CGST and SGST.",
  },
  {
    topic: "business structures",
    difficulty: "medium",
    stem: "In Indian company law, which describes a 'related party transaction'?",
    options: [
      "A transaction with a party connected to the company's directors or promoters",
      "Any transaction above ₹1 crore",
      "Any cross-border transaction",
      "A transaction between two listed companies",
    ],
    answer: "A transaction with a party connected to the company's directors or promoters",
    explanation:
      "Relatedness is about the connection, not the size or geography. These require disclosure and, past thresholds, audit-committee or shareholder approval.",
  },
];
