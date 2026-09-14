import type { ObjectiveSeed } from "./types";

/**
 * Bank expansion — every track that was thin enough for a student to exhaust
 * in one sitting.
 *
 * Authored to the same rule as the rest: the correct option is written FIRST
 * and named in full in `answer`, and the seeder rotates it by a hash of the
 * stem so it does not land on A. Every numeric key below was worked out
 * independently and the working is in the explanation, because a wrong key is
 * the one failure a student cannot appeal.
 *
 * Deliberately no current-affairs questions here. That track is refilled daily
 * by the cron in src/lib/current-affairs, and dated facts are exactly what I
 * should not be hand-authoring into a permanent bank.
 */

// ---------------------------------------------------------------- quant ----
export const QUANT_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "percentages",
    difficulty: "easy",
    stem: "A dark store's monthly revenue rose from Rs 4.2 lakh to Rs 5.04 lakh. By what percentage did it grow?",
    options: ["20%", "16.7%", "24%", "84%"],
    answer: "20%",
    explanation:
      "Growth = (5.04 - 4.2) / 4.2 = 0.84 / 4.2 = 0.20, so 20%. Dividing by the NEW figure instead gives 16.7%, which is the usual slip.",
  },
  {
    topic: "ratio and proportion",
    difficulty: "easy",
    stem: "Three partners split a profit of Rs 2.4 lakh in the ratio 3 : 4 : 5. What does the largest share come to?",
    options: ["Rs 1,00,000", "Rs 80,000", "Rs 1,20,000", "Rs 60,000"],
    answer: "Rs 1,00,000",
    explanation:
      "Total parts = 3 + 4 + 5 = 12. The largest share is 5/12 of Rs 2,40,000 = Rs 1,00,000.",
  },
  {
    topic: "time speed distance",
    difficulty: "medium",
    stem: "A truck covers 30 km at 30 km/h and the next 30 km at 20 km/h. What is its average speed over the whole trip?",
    options: ["24 km/h", "25 km/h", "26 km/h", "22.5 km/h"],
    answer: "24 km/h",
    explanation:
      "Time = 30/30 + 30/20 = 1 + 1.5 = 2.5 hours for 60 km. Average = 60 / 2.5 = 24 km/h. Averaging the two speeds to 25 km/h is wrong because more time is spent at the slower one.",
  },
  {
    topic: "compound interest",
    difficulty: "medium",
    stem: "Rs 50,000 is invested at 10% per annum compounded annually. How much interest accrues over two years?",
    options: ["Rs 10,500", "Rs 10,000", "Rs 11,000", "Rs 12,100"],
    answer: "Rs 10,500",
    explanation:
      "Amount = 50,000 x 1.1 x 1.1 = 50,000 x 1.21 = Rs 60,500. Interest = 60,500 - 50,000 = Rs 10,500. Simple interest would have been Rs 10,000.",
  },
  {
    topic: "time and work",
    difficulty: "medium",
    stem: "A finishes a job in 12 days and B in 18 days. Working together, how long do they take?",
    options: ["7.2 days", "7.5 days", "6.5 days", "15 days"],
    answer: "7.2 days",
    explanation:
      "Combined rate = 1/12 + 1/18 = 3/36 + 2/36 = 5/36 of the job per day. Time = 36/5 = 7.2 days.",
  },
  {
    topic: "profit and loss",
    difficulty: "medium",
    stem: "An item costing Rs 800 is marked up 25% and then sold at a 10% discount. What is the profit percentage?",
    options: ["12.5%", "15%", "10%", "13.5%"],
    answer: "12.5%",
    explanation:
      "Marked price = 800 x 1.25 = Rs 1,000. Selling price = 1,000 x 0.9 = Rs 900. Profit = Rs 100 on a cost of Rs 800 = 12.5%.",
  },
  {
    topic: "averages",
    difficulty: "easy",
    stem: "The average of six numbers is 24. If the number 39 is removed, what is the average of the remaining five?",
    options: ["21", "22", "20", "23"],
    answer: "21",
    explanation:
      "Total = 6 x 24 = 144. Removing 39 leaves 105 across five numbers, so the average is 105/5 = 21.",
  },
  {
    topic: "mixtures",
    difficulty: "medium",
    stem: "A tank holds 40 litres of a 25% saline solution. How much pure water must be added to dilute it to 20%?",
    options: ["10 litres", "8 litres", "5 litres", "12 litres"],
    answer: "10 litres",
    explanation:
      "Salt = 25% of 40 = 10 litres, and adding water does not change it. We need 10 / (40 + x) = 0.20, so 40 + x = 50 and x = 10 litres.",
  },
  {
    topic: "percentages",
    difficulty: "medium",
    stem: "A price rises by 20% and then falls by 20%. What is the net change?",
    options: ["A 4% decrease", "No change", "A 4% increase", "A 2% decrease"],
    answer: "A 4% decrease",
    explanation:
      "1.20 x 0.80 = 0.96, so the final price is 96% of the original — a 4% fall. The second 20% is taken off a larger base than the first was added to.",
  },
  {
    topic: "interest",
    difficulty: "medium",
    stem: "What is the difference between compound and simple interest on Rs 20,000 at 10% per annum over two years?",
    options: ["Rs 200", "Rs 400", "Rs 100", "Rs 420"],
    answer: "Rs 200",
    explanation:
      "Simple interest = 20,000 x 0.10 x 2 = Rs 4,000. Compound = 20,000 x 1.21 - 20,000 = Rs 4,200. The difference, Rs 200, is the interest earned on the first year's interest.",
  },
  {
    topic: "partnership",
    difficulty: "hard",
    stem: "A invests Rs 60,000 for 12 months and B invests Rs 90,000 for 8 months. A profit of Rs 35,000 is shared in proportion to capital x time. What is A's share?",
    options: ["Rs 17,500", "Rs 14,000", "Rs 21,000", "Rs 20,000"],
    answer: "Rs 17,500",
    explanation:
      "A's weight = 60,000 x 12 = 7,20,000. B's = 90,000 x 8 = 7,20,000. The weights are equal, so the profit splits evenly: Rs 17,500 each. B's larger capital is exactly offset by the shorter period.",
  },
  {
    topic: "discounts",
    difficulty: "easy",
    stem: "Successive discounts of 20% and 10% are equivalent to what single discount?",
    options: ["28%", "30%", "26%", "32%"],
    answer: "28%",
    explanation:
      "0.80 x 0.90 = 0.72, so the customer pays 72% and the single equivalent discount is 28%. Adding the two to 30% double-counts the overlap.",
  },
  {
    topic: "number system",
    difficulty: "medium",
    stem: "What is the smallest number that must be added to 1,234 to make it divisible by 36?",
    options: ["26", "14", "22", "8"],
    answer: "26",
    explanation:
      "36 x 34 = 1,224 and 36 x 35 = 1,260. The next multiple above 1,234 is 1,260, so 1,260 - 1,234 = 26 must be added.",
  },
  {
    topic: "time speed distance",
    difficulty: "hard",
    stem: "A 180-metre train travelling at 54 km/h crosses a platform in 20 seconds. How long is the platform?",
    options: ["120 metres", "300 metres", "180 metres", "150 metres"],
    answer: "120 metres",
    explanation:
      "54 km/h = 54 x 1000 / 3600 = 15 m/s. In 20 seconds the train covers 300 metres, which is its own length plus the platform. Platform = 300 - 180 = 120 metres.",
  },
];

// --------------------------------------------------- data interpretation ----
const REVENUE_TABLE = `Revenue by business unit, FY25 (Rs crore)

Unit         Q1     Q2     Q3     Q4
Retail      120    135    150    195
Logistics    80     88     96    136
Cloud        60     75     90    135
Payments     40     42     54     64`;

export const DATA_INTERPRETATION_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "table reading",
    difficulty: "easy",
    context: REVENUE_TABLE,
    stem: "What was total company revenue for FY25?",
    options: ["Rs 1,560 crore", "Rs 1,460 crore", "Rs 1,600 crore", "Rs 1,530 crore"],
    answer: "Rs 1,560 crore",
    explanation:
      "Retail 120+135+150+195 = 600. Logistics 80+88+96+136 = 400. Cloud 60+75+90+135 = 360. Payments 40+42+54+64 = 200. Total = 600+400+360+200 = Rs 1,560 crore.",
  },
  {
    topic: "growth rates",
    difficulty: "medium",
    context: REVENUE_TABLE,
    stem: "Which unit grew fastest from Q1 to Q4?",
    options: ["Cloud", "Logistics", "Retail", "Payments"],
    answer: "Cloud",
    explanation:
      "Cloud 60 to 135 = +125%. Logistics 80 to 136 = +70%. Retail 120 to 195 = +62.5%. Payments 40 to 64 = +60%. Cloud grew fastest in percentage terms even though Retail added the most rupees.",
  },
  {
    topic: "share of total",
    difficulty: "medium",
    context: REVENUE_TABLE,
    stem: "Retail accounted for approximately what share of Q4 revenue?",
    options: ["37%", "33%", "40%", "45%"],
    answer: "37%",
    explanation:
      "Q4 total = 195 + 136 + 135 + 64 = 530. Retail's share = 195 / 530 = 0.368, about 37%.",
  },
  {
    topic: "growth rates",
    difficulty: "easy",
    context: REVENUE_TABLE,
    stem: "By how much did Cloud grow between Q3 and Q4?",
    options: ["50%", "45%", "33%", "55%"],
    answer: "50%",
    explanation: "(135 - 90) / 90 = 45 / 90 = 0.50, so 50%.",
  },
  {
    topic: "table reading",
    difficulty: "easy",
    context: REVENUE_TABLE,
    stem: "Which quarter delivered the highest total revenue, and what was it?",
    options: ["Q4, Rs 530 crore", "Q4, Rs 490 crore", "Q3, Rs 390 crore", "Q3, Rs 420 crore"],
    answer: "Q4, Rs 530 crore",
    explanation:
      "Q1 = 300, Q2 = 340, Q3 = 390, Q4 = 530. Q4 is the largest at Rs 530 crore.",
  },
  {
    topic: "projection",
    difficulty: "medium",
    context: REVENUE_TABLE,
    stem: "If Payments grows 25% in Q1 FY26 over its Q4 figure, what will it earn?",
    options: ["Rs 80 crore", "Rs 76 crore", "Rs 84 crore", "Rs 89 crore"],
    answer: "Rs 80 crore",
    explanation: "64 x 1.25 = Rs 80 crore.",
  },
  {
    topic: "averages",
    difficulty: "easy",
    context: REVENUE_TABLE,
    stem: "What was Logistics' average quarterly revenue in FY25?",
    options: ["Rs 100 crore", "Rs 96 crore", "Rs 110 crore", "Rs 88 crore"],
    answer: "Rs 100 crore",
    explanation: "Logistics totalled 80+88+96+136 = Rs 400 crore over four quarters, so Rs 100 crore a quarter.",
  },
  {
    topic: "share of total",
    difficulty: "hard",
    context: REVENUE_TABLE,
    stem: "Cloud and Payments together accounted for what share of full-year revenue?",
    options: ["36%", "31%", "40%", "44%"],
    answer: "36%",
    explanation:
      "Cloud 360 + Payments 200 = 560 out of 1,560. 560 / 1,560 = 0.359, about 36%.",
  },
];

// ---------------------------------------------------- logical reasoning ----
export const LOGICAL_REASONING_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "number series",
    difficulty: "easy",
    stem: "What comes next: 3, 7, 15, 31, ?",
    options: ["63", "62", "47", "64"],
    answer: "63",
    explanation: "Each term is the previous one doubled plus one: 3x2+1 = 7, 7x2+1 = 15, 15x2+1 = 31, 31x2+1 = 63.",
  },
  {
    topic: "number series",
    difficulty: "easy",
    stem: "What comes next: 2, 6, 12, 20, 30, ?",
    options: ["42", "40", "36", "44"],
    answer: "42",
    explanation:
      "The gaps are 4, 6, 8, 10, so the next gap is 12 and the next term is 42. Equivalently each term is n(n+1): 1x2, 2x3, 3x4, 4x5, 5x6, 6x7 = 42.",
  },
  {
    topic: "coding and decoding",
    difficulty: "medium",
    stem: "If MARKET is written as NBSLFU, how is BRAND written?",
    options: ["CSBOE", "CSBPE", "CTBOE", "BSBOE"],
    answer: "CSBOE",
    explanation:
      "Every letter moves one place forward: M->N, A->B, R->S, K->L, E->F, T->U. Applying the same to BRAND gives B->C, R->S, A->B, N->O, D->E, so CSBOE.",
  },
  {
    topic: "syllogism",
    difficulty: "hard",
    stem: "All auditors are analysts. Some analysts are managers. Which conclusion follows necessarily?",
    options: [
      "Neither conclusion follows",
      "Some auditors are managers",
      "No auditor is a manager",
      "All managers are analysts",
    ],
    answer: "Neither conclusion follows",
    explanation:
      "The analysts who are managers need not be the ones who are auditors, so no link between auditors and managers is forced either way. 'Some analysts are managers' also says nothing about all managers.",
  },
  {
    topic: "direction sense",
    difficulty: "easy",
    stem: "A consultant walks 5 km north, then 3 km east, then 5 km south. How far is she from her starting point, and in which direction?",
    options: ["3 km east", "3 km west", "8 km east", "13 km east"],
    answer: "3 km east",
    explanation:
      "The 5 km north and 5 km south cancel exactly, leaving only the 3 km east leg. She is 3 km due east of where she began.",
  },
  {
    topic: "blood relations",
    difficulty: "medium",
    stem: "Pointing to a man, Rhea said, 'He is the only son of my mother's father.' How is the man related to Rhea?",
    options: ["Maternal uncle", "Father", "Brother", "Grandfather"],
    answer: "Maternal uncle",
    explanation:
      "Her mother's father is her grandfather; his only son is her mother's brother, which makes him Rhea's maternal uncle.",
  },
  {
    topic: "seating arrangement",
    difficulty: "hard",
    stem: "Five analysts sit in a row. C is immediately right of A. E is at one end. B is between D and C. Who cannot be at the other end?",
    options: ["C", "A", "D", "B"],
    answer: "C",
    explanation:
      "B sits between D and C, so C has a neighbour on the B side, and A sits immediately left of C, giving C neighbours on both sides. An end seat has only one neighbour, so C cannot occupy one.",
  },
  {
    topic: "odd one out",
    difficulty: "easy",
    stem: "Which does not belong: EBITDA, Gross margin, Net profit, Working capital?",
    options: ["Working capital", "EBITDA", "Gross margin", "Net profit"],
    answer: "Working capital",
    explanation:
      "The other three are measures of profitability read off the income statement. Working capital is a balance-sheet quantity — current assets minus current liabilities — measured at a point in time, not over a period.",
  },
  {
    topic: "statement and assumption",
    difficulty: "hard",
    stem: "A notice reads: 'Use the new expense app — reimbursements will be faster.' Which assumption is implicit?",
    options: [
      "Employees want faster reimbursements",
      "The old process has been deleted",
      "All employees own smartphones",
      "Reimbursements were previously never paid",
    ],
    answer: "Employees want faster reimbursements",
    explanation:
      "The notice only works as persuasion if speed is something the reader values — that is what an implicit assumption is. Deleting the old process, owning devices and never being paid are all extra claims the notice does not need.",
  },
  {
    topic: "number series",
    difficulty: "medium",
    stem: "What comes next: 1, 4, 9, 16, 25, ?",
    options: ["36", "35", "30", "49"],
    answer: "36",
    explanation: "These are the squares 1^2 through 5^2, so the next is 6^2 = 36.",
  },
];

// ----------------------------------------------------------------verbal ----
export const VERBAL_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "idioms",
    difficulty: "easy",
    stem: "In business writing, what does 'to move the needle' mean?",
    options: [
      "To produce a measurable change in an important metric",
      "To delay a decision until more data arrives",
      "To rearrange responsibilities within a team",
      "To reverse an earlier commitment",
    ],
    answer: "To produce a measurable change in an important metric",
    explanation:
      "The image is of a gauge: an action that moves the needle is one big enough to register on the measure that matters. The others describe stalling, reorganising and reversing.",
  },
  {
    topic: "error spotting",
    difficulty: "medium",
    stem: "Which sentence is grammatically correct?",
    options: [
      "Neither the CFO nor the analysts were available for comment.",
      "Neither the CFO nor the analysts was available for comment.",
      "Neither the CFO or the analysts were available for comment.",
      "Neither of the CFO nor the analysts were available.",
    ],
    answer: "Neither the CFO nor the analysts were available for comment.",
    explanation:
      "With 'neither ... nor', the verb agrees with the nearer subject. 'Analysts' is plural and sits closest to the verb, so 'were' is correct. 'Neither' also pairs with 'nor', never with 'or'.",
  },
  {
    topic: "vocabulary in context",
    difficulty: "medium",
    stem: "'The board took a sanguine view of the quarter's results.' What does 'sanguine' mean here?",
    options: ["Optimistic", "Sceptical", "Indifferent", "Furious"],
    answer: "Optimistic",
    explanation:
      "Sanguine means cheerfully confident about an outcome. It is often misread as its opposite because of its association with blood and, by extension, with something grim.",
  },
  {
    topic: "para jumble",
    difficulty: "hard",
    stem: "Arrange into a coherent paragraph: (A) That assumption turned out to be wrong. (B) The company entered the market expecting rapid adoption. (C) Growth stalled within two quarters. (D) It had assumed customers would switch on price alone.",
    options: ["B, D, A, C", "B, C, D, A", "D, B, A, C", "B, A, D, C"],
    answer: "B, D, A, C",
    explanation:
      "B sets the scene, D explains the assumption behind it, A judges that assumption, and C gives the consequence. 'That assumption' in A must follow the assumption being named in D.",
  },
  {
    topic: "reading comprehension",
    difficulty: "medium",
    context:
      "Firms that publish their pricing openly tend to attract customers who have already qualified themselves. The sales conversation starts later in the buying process and closes faster. The cost is that competitors can see the price too, and a rival with a lower cost base can undercut it without ever having to bid.",
    stem: "According to the passage, what is the main trade-off of published pricing?",
    options: [
      "Faster sales cycles in exchange for competitive exposure",
      "Higher prices in exchange for fewer customers",
      "Better customers in exchange for slower closing",
      "Lower costs in exchange for weaker margins",
    ],
    answer: "Faster sales cycles in exchange for competitive exposure",
    explanation:
      "The passage names one benefit — self-qualified customers and faster closing — and one cost, which is that rivals can see and undercut the price. The other options invert or invent parts of it.",
  },
  {
    topic: "vocabulary in context",
    difficulty: "easy",
    stem: "Which word best completes the sentence: 'The auditor's report was ___, leaving no room for interpretation.'",
    options: ["unequivocal", "ambivalent", "tentative", "cursory"],
    answer: "unequivocal",
    explanation:
      "Unequivocal means admitting of no doubt. Ambivalent means holding two feelings at once, tentative means provisional, and cursory means hurried and shallow — all of which would contradict 'no room for interpretation'.",
  },
  {
    topic: "error spotting",
    difficulty: "medium",
    stem: "Which sentence uses 'comprise' correctly?",
    options: [
      "The portfolio comprises twelve holdings.",
      "The portfolio is comprised of twelve holdings.",
      "Twelve holdings comprise into the portfolio.",
      "The portfolio comprises of twelve holdings.",
    ],
    answer: "The portfolio comprises twelve holdings.",
    explanation:
      "The whole comprises the parts. 'Comprised of' and 'comprises of' are both widely used and both disputed in formal writing; the clean construction is the one given.",
  },
  {
    topic: "reading comprehension",
    difficulty: "hard",
    context:
      "A retailer reported that same-store sales rose 4% while total sales rose 11%. It opened 30 new stores during the year. Analysts noted that the gap between the two figures was the largest in the company's history.",
    stem: "What does the gap between the two figures most directly indicate?",
    options: [
      "Most of the growth came from new stores rather than existing ones",
      "Existing stores lost customers in absolute terms",
      "The new stores were more profitable than the old ones",
      "Total sales were overstated",
    ],
    answer: "Most of the growth came from new stores rather than existing ones",
    explanation:
      "Same-store sales strip out new openings. Total growth of 11% against like-for-like growth of 4% means the remainder came from the new estate. Nothing in the passage speaks to profitability, and 4% growth means existing stores grew, not shrank.",
  },
  {
    topic: "idioms",
    difficulty: "easy",
    stem: "What does it mean to say a project is 'in the weeds'?",
    options: [
      "Lost in detail at the expense of the bigger picture",
      "Growing faster than expected",
      "Approved but not yet funded",
      "Abandoned quietly",
    ],
    answer: "Lost in detail at the expense of the bigger picture",
    explanation:
      "Being in the weeds is being down among the small stuff where the overall direction is no longer visible. It is a caution about attention, not about speed or funding.",
  },
  {
    topic: "para jumble",
    difficulty: "medium",
    stem: "Arrange into a coherent paragraph: (A) Both were wrong. (B) Analysts expected margins to compress. (C) Margins expanded by 200 basis points. (D) Management guided to margins holding flat.",
    options: ["B, D, C, A", "B, D, A, C", "D, B, C, A", "C, B, D, A"],
    answer: "B, D, C, A",
    explanation:
      "Two predictions are stated (B, then D), the actual outcome follows (C), and A is the verdict on both. A cannot precede C because 'both were wrong' only makes sense once the real result is known.",
  },
];

// ------------------------------------------------------ finance concepts ----
export const FINANCE_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "valuation",
    difficulty: "medium",
    stem: "A company has a P/E of 20 and earnings per share of Rs 15. What is its share price?",
    options: ["Rs 300", "Rs 350", "Rs 250", "Rs 133"],
    answer: "Rs 300",
    explanation: "Price = P/E x EPS = 20 x 15 = Rs 300.",
  },
  {
    topic: "cost of capital",
    difficulty: "hard",
    stem: "A firm is 40% debt at 10% pre-tax and 60% equity at 15%. At a 25% tax rate, what is its WACC?",
    options: ["12%", "13%", "11%", "12.6%"],
    answer: "12%",
    explanation:
      "After-tax cost of debt = 10% x (1 - 0.25) = 7.5%. WACC = 0.40 x 7.5% + 0.60 x 15% = 3% + 9% = 12%.",
  },
  {
    topic: "discounted cash flow",
    difficulty: "medium",
    stem: "What is the present value of Rs 1,21,000 received two years from now at a 10% discount rate?",
    options: ["Rs 1,00,000", "Rs 1,10,000", "Rs 96,800", "Rs 99,000"],
    answer: "Rs 1,00,000",
    explanation: "PV = 1,21,000 / 1.1^2 = 1,21,000 / 1.21 = Rs 1,00,000.",
  },
  {
    topic: "leverage",
    difficulty: "medium",
    stem: "Which statement about financial leverage is correct?",
    options: [
      "It raises both expected returns to equity and the risk of those returns",
      "It raises expected returns to equity without affecting risk",
      "It reduces the cost of equity",
      "It has no effect once tax is ignored",
    ],
    answer: "It raises both expected returns to equity and the risk of those returns",
    explanation:
      "Debt magnifies whatever the assets earn, in both directions. Equity holders keep the upside above the interest cost and absorb the downside first, so expected return and volatility both rise.",
  },
  {
    topic: "working capital",
    difficulty: "medium",
    stem: "A firm has a cash conversion cycle of 60 days. Which change would shorten it?",
    options: [
      "Negotiating longer payment terms with suppliers",
      "Offering customers longer credit terms",
      "Holding more inventory as a buffer",
      "Paying suppliers earlier to secure a discount",
    ],
    answer: "Negotiating longer payment terms with suppliers",
    explanation:
      "CCC = inventory days + receivable days - payable days. Raising payable days subtracts more, shortening the cycle. Each of the others lengthens it.",
  },
  {
    topic: "valuation",
    difficulty: "hard",
    stem: "Using a perpetuity growth model, what is the terminal value of a cash flow of Rs 50 crore growing at 4% with a 10% discount rate?",
    options: ["Rs 833 crore", "Rs 500 crore", "Rs 1,250 crore", "Rs 1,300 crore"],
    answer: "Rs 833 crore",
    explanation:
      "TV = CF / (r - g) = 50 / (0.10 - 0.04) = 50 / 0.06 = Rs 833 crore. The spread between r and g does almost all the work here, which is why small changes to g move a DCF so much.",
  },
  {
    topic: "ratios",
    difficulty: "easy",
    stem: "A company has current assets of Rs 90 lakh and current liabilities of Rs 60 lakh. What is its current ratio?",
    options: ["1.5", "0.67", "2.0", "1.33"],
    answer: "1.5",
    explanation: "Current ratio = 90 / 60 = 1.5.",
  },
  {
    topic: "capital budgeting",
    difficulty: "hard",
    stem: "A project costs Rs 100 crore and returns Rs 30 crore a year for five years. Ignoring the time value of money, what is the payback period?",
    options: ["3 years 4 months", "3 years", "4 years", "2 years 6 months"],
    answer: "3 years 4 months",
    explanation:
      "After three years Rs 90 crore has been recovered, leaving Rs 10 crore. At Rs 30 crore a year that takes a third of a year, so 3 years and 4 months.",
  },
];

// ------------------------------------------------------------ accounting ----
export const ACCOUNTING_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "financial statements",
    difficulty: "easy",
    stem: "Depreciation on a factory machine appears where in the financial statements?",
    options: [
      "As an expense on the income statement and a reduction of asset value on the balance sheet",
      "Only as a cash outflow on the cash flow statement",
      "Only as a reduction of retained earnings",
      "As a current liability until the asset is sold",
    ],
    answer:
      "As an expense on the income statement and a reduction of asset value on the balance sheet",
    explanation:
      "Depreciation reduces reported profit and accumulates against the asset's carrying value. It is not a cash outflow, which is why it is added back when building cash flow from operations.",
  },
  {
    topic: "accruals",
    difficulty: "medium",
    stem: "A firm delivers a service in March and is paid in May. Under accrual accounting, when is the revenue recognised?",
    options: ["March", "May", "Split between March and May", "When the invoice is raised"],
    answer: "March",
    explanation:
      "Accrual accounting records revenue when it is earned, not when cash moves. The March delivery creates a receivable that is settled in May.",
  },
  {
    topic: "cash flow",
    difficulty: "hard",
    stem: "Net profit is Rs 50 lakh, depreciation Rs 12 lakh, and receivables rose by Rs 8 lakh. What is cash flow from operations, ignoring other items?",
    options: ["Rs 54 lakh", "Rs 70 lakh", "Rs 46 lakh", "Rs 58 lakh"],
    answer: "Rs 54 lakh",
    explanation:
      "50 + 12 (non-cash charge added back) - 8 (cash tied up in receivables) = Rs 54 lakh. A rise in receivables is a use of cash.",
  },
  {
    topic: "inventory",
    difficulty: "medium",
    stem: "During a period of rising prices, which inventory method reports the highest profit?",
    options: ["FIFO", "LIFO", "Weighted average", "All report the same"],
    answer: "FIFO",
    explanation:
      "First-in-first-out charges the oldest and therefore cheapest units to cost of goods sold, leaving a lower cost and a higher reported profit. LIFO does the opposite.",
  },
  {
    topic: "financial statements",
    difficulty: "easy",
    stem: "Which of these is NOT a current liability?",
    options: ["A ten-year bank loan", "Accounts payable", "Accrued salaries", "Tax payable within the year"],
    answer: "A ten-year bank loan",
    explanation:
      "Current liabilities fall due within twelve months. A ten-year loan is non-current, though any instalment due inside the year is reclassified as current.",
  },
  {
    topic: "equity",
    difficulty: "medium",
    stem: "A company buys back its own shares. What happens to shareholders' equity?",
    options: ["It falls", "It rises", "It is unchanged", "It depends on the share price"],
    answer: "It falls",
    explanation:
      "Cash leaves the business and shares are retired or held as treasury stock, so total equity falls. Earnings per share may rise because the count falls, which is a different measure.",
  },
  {
    topic: "accruals",
    difficulty: "hard",
    stem: "A firm capitalises a cost that should have been expensed. What is the immediate effect?",
    options: [
      "Profit is overstated and assets are overstated",
      "Profit is understated and assets are overstated",
      "Profit is overstated and assets are understated",
      "There is no effect on either",
    ],
    answer: "Profit is overstated and assets are overstated",
    explanation:
      "Capitalising moves a charge off the income statement and onto the balance sheet, so this period's profit is too high and the asset base is inflated. It is one of the classic earnings-management flags.",
  },
  {
    topic: "ratios",
    difficulty: "medium",
    stem: "Return on equity is 18% and the equity multiplier is 2.0. What is return on assets?",
    options: ["9%", "36%", "18%", "20%"],
    answer: "9%",
    explanation:
      "ROE = ROA x equity multiplier, so ROA = 18% / 2.0 = 9%. Half the return on equity here is coming from leverage rather than from the assets.",
  },
];

// ---------------------------------------------------- marketing concepts ----
export const MARKETING_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "unit economics",
    difficulty: "medium",
    stem: "A subscription costs Rs 600 a year, gross margin is 70%, and average tenure is 3 years. What is lifetime value?",
    options: ["Rs 1,260", "Rs 1,800", "Rs 420", "Rs 900"],
    answer: "Rs 1,260",
    explanation: "LTV = 600 x 0.70 x 3 = Rs 1,260. Using revenue rather than gross profit would overstate it as Rs 1,800.",
  },
  {
    topic: "segmentation",
    difficulty: "easy",
    stem: "Which is an example of behavioural rather than demographic segmentation?",
    options: [
      "Customers who have ordered more than twice this month",
      "Customers aged 25 to 34",
      "Customers in tier-2 cities",
      "Customers with household income above Rs 10 lakh",
    ],
    answer: "Customers who have ordered more than twice this month",
    explanation:
      "Behavioural segmentation groups people by what they do. Age, location and income are attributes of who they are.",
  },
  {
    topic: "pricing",
    difficulty: "hard",
    stem: "Demand is price-elastic. What happens to revenue if price is cut?",
    options: ["Revenue rises", "Revenue falls", "Revenue is unchanged", "It cannot be determined"],
    answer: "Revenue rises",
    explanation:
      "Elastic demand means quantity responds more than proportionately to price, so the volume gain outweighs the lower price per unit and revenue rises. With inelastic demand, cutting price reduces revenue.",
  },
  {
    topic: "channels",
    difficulty: "medium",
    stem: "A brand's CAC is Rs 900 and its LTV is Rs 1,800. What does the LTV:CAC ratio suggest?",
    options: [
      "Acquisition is viable but there is little room to spend harder",
      "Acquisition is unprofitable",
      "The brand should immediately triple its spend",
      "The ratio says nothing without churn data",
    ],
    answer: "Acquisition is viable but there is little room to spend harder",
    explanation:
      "A 2:1 ratio recovers acquisition cost with something left over, but the rule of thumb for comfortable reinvestment is nearer 3:1. Tenure is already inside LTV, so churn is accounted for.",
  },
  {
    topic: "brand",
    difficulty: "medium",
    stem: "What does brand equity most directly allow a firm to do?",
    options: [
      "Charge a price premium for a comparable product",
      "Reduce its cost of goods sold",
      "Avoid competitive entry entirely",
      "Guarantee repeat purchase",
    ],
    answer: "Charge a price premium for a comparable product",
    explanation:
      "Brand equity is the willingness to pay more for the same underlying thing. It does not change manufacturing cost, and it deters rather than prevents entry.",
  },
  {
    topic: "funnel",
    difficulty: "easy",
    stem: "10,000 people visit a landing page, 400 sign up and 60 subscribe. What is the visit-to-subscribe conversion rate?",
    options: ["0.6%", "4%", "15%", "6%"],
    answer: "0.6%",
    explanation: "60 / 10,000 = 0.006, or 0.6%. The 15% figure is signup-to-subscribe, a different step.",
  },
  {
    topic: "distribution",
    difficulty: "hard",
    stem: "An FMCG brand moves from a distributor model to direct-to-retailer. What is the most likely immediate effect?",
    options: [
      "Higher gross margin and higher working capital requirement",
      "Lower gross margin and lower working capital requirement",
      "Higher gross margin and lower working capital requirement",
      "No change to either",
    ],
    answer: "Higher gross margin and higher working capital requirement",
    explanation:
      "Cutting the distributor removes their margin, but the brand now carries the receivables and the servicing of many small retail accounts that the distributor used to fund and manage.",
  },
  {
    topic: "positioning",
    difficulty: "medium",
    stem: "A positioning statement should primarily answer which question?",
    options: [
      "For whom, against what alternative, and why better",
      "What features the product ships with",
      "What the annual marketing budget will be",
      "Which channels will be used",
    ],
    answer: "For whom, against what alternative, and why better",
    explanation:
      "Positioning is relative: it names a target, a competitive frame of reference and a reason to prefer you. Features, budget and channels follow from it.",
  },
];

// --------------------------------------------------- operations concepts ----
export const OPERATIONS_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "inventory",
    difficulty: "medium",
    stem: "Annual demand is 3,600 units, ordering cost is Rs 200 per order and holding cost is Rs 4 per unit per year. What is the economic order quantity?",
    options: ["600 units", "424 units", "300 units", "900 units"],
    answer: "600 units",
    explanation:
      "EOQ = sqrt(2DS/H) = sqrt(2 x 3,600 x 200 / 4) = sqrt(14,40,000 / 4) = sqrt(3,60,000) = 600 units.",
  },
  {
    topic: "process design",
    difficulty: "medium",
    stem: "A line has four stations taking 4, 7, 5 and 6 minutes. What is the throughput rate?",
    options: [
      "One unit every 7 minutes",
      "One unit every 5.5 minutes",
      "One unit every 22 minutes",
      "One unit every 4 minutes",
    ],
    answer: "One unit every 7 minutes",
    explanation:
      "Throughput is set by the bottleneck, which is the slowest station at 7 minutes. The other stations idle for part of each cycle.",
  },
  {
    topic: "capacity",
    difficulty: "hard",
    stem: "A plant runs 20 hours a day at 90% utilisation and produces 45 units an hour when running. What is daily output?",
    options: ["810 units", "900 units", "750 units", "1,000 units"],
    answer: "810 units",
    explanation: "20 hours x 0.90 = 18 productive hours. 18 x 45 = 810 units.",
  },
  {
    topic: "quality",
    difficulty: "medium",
    stem: "What does a Six Sigma process level imply about defects?",
    options: [
      "About 3.4 defects per million opportunities",
      "About 3.4 defects per thousand opportunities",
      "Exactly six defects per million units",
      "A defect rate below 6%",
    ],
    answer: "About 3.4 defects per million opportunities",
    explanation:
      "Six Sigma is defined as 3.4 defects per million opportunities, allowing for the conventional 1.5-sigma long-term shift in the process mean.",
  },
  {
    topic: "supply chain",
    difficulty: "hard",
    stem: "What is the bullwhip effect?",
    options: [
      "Demand variability amplifying as it moves upstream in a supply chain",
      "A sudden collapse in end-customer demand",
      "The cost penalty of expedited freight",
      "Inventory being held at the wrong node",
    ],
    answer: "Demand variability amplifying as it moves upstream in a supply chain",
    explanation:
      "Small swings at the retail end become larger swings at the distributor and larger still at the manufacturer, because each tier orders to cover both demand and its own safety stock.",
  },
  {
    topic: "lean",
    difficulty: "easy",
    stem: "In lean manufacturing, what does 'muda' refer to?",
    options: ["Waste", "Standard work", "Continuous flow", "Visual control"],
    answer: "Waste",
    explanation:
      "Muda is any activity that consumes resources without creating value for the customer — overproduction, waiting, transport, over-processing, inventory, motion and defects.",
  },
  {
    topic: "queueing",
    difficulty: "hard",
    stem: "A service desk's arrival rate rises from 80% to 90% of its service capacity. What happens to average waiting time?",
    options: [
      "It more than doubles",
      "It rises by about 10%",
      "It falls",
      "It is unaffected until capacity is exceeded",
    ],
    answer: "It more than doubles",
    explanation:
      "Waiting time scales roughly with utilisation / (1 - utilisation). At 80% that factor is 4; at 90% it is 9. Queues grow non-linearly as a system approaches capacity, which is why running a service desk 'efficiently' at 95% feels catastrophic to customers.",
  },
  {
    topic: "inventory",
    difficulty: "medium",
    stem: "Demand is 50 units a day and lead time is 6 days. With safety stock of 100 units, what is the reorder point?",
    options: ["400 units", "300 units", "350 units", "150 units"],
    answer: "400 units",
    explanation: "Reorder point = demand during lead time + safety stock = (50 x 6) + 100 = 400 units.",
  },
];

// ------------------------------------------------------------ statistics ----
export const STATISTICS_EXPANSION: ObjectiveSeed[] = [
  {
    topic: "probability",
    difficulty: "medium",
    stem: "Two independent servers each have 99% uptime. What is the probability that at least one is up?",
    options: ["99.99%", "99%", "98.01%", "99.5%"],
    answer: "99.99%",
    explanation:
      "Both down = 0.01 x 0.01 = 0.0001. At least one up = 1 - 0.0001 = 0.9999, or 99.99%. Redundancy multiplies the failure probabilities, which is why a second server buys so much.",
  },
  {
    topic: "hypothesis testing",
    difficulty: "hard",
    stem: "An A/B test returns p = 0.03 at a 5% significance level. What does this mean?",
    options: [
      "If there were truly no difference, data this extreme would appear 3% of the time",
      "There is a 3% probability that the null hypothesis is true",
      "There is a 97% probability that the variant is better",
      "The effect size is 3%",
    ],
    answer:
      "If there were truly no difference, data this extreme would appear 3% of the time",
    explanation:
      "A p-value is the probability of the observed data given the null hypothesis, not the probability of the hypothesis given the data. It also says nothing about how large the effect is.",
  },
  {
    topic: "sampling",
    difficulty: "medium",
    stem: "A survey of website visitors asks about satisfaction. Which bias is most likely?",
    options: [
      "Selection bias — only current visitors are asked",
      "Recall bias",
      "Interviewer bias",
      "Publication bias",
    ],
    answer: "Selection bias — only current visitors are asked",
    explanation:
      "People who stopped visiting because they were dissatisfied cannot appear in the sample, so the result is systematically flattering. This is survivorship bias, a form of selection bias.",
  },
  {
    topic: "correlation",
    difficulty: "easy",
    stem: "Ice-cream sales and drowning deaths are strongly correlated. What is the most likely explanation?",
    options: [
      "A third variable, temperature, drives both",
      "Ice cream causes drowning",
      "Drowning causes ice-cream sales",
      "The correlation must be a calculation error",
    ],
    answer: "A third variable, temperature, drives both",
    explanation:
      "This is the textbook confounder: hot weather raises both swimming and ice-cream consumption. The correlation is real; the causal link between the two named variables is not.",
  },
  {
    topic: "distributions",
    difficulty: "medium",
    stem: "In a normal distribution, approximately what proportion of observations lie within one standard deviation of the mean?",
    options: ["68%", "95%", "50%", "99.7%"],
    answer: "68%",
    explanation:
      "The empirical rule: about 68% within one standard deviation, 95% within two and 99.7% within three.",
  },
  {
    topic: "confidence intervals",
    difficulty: "hard",
    stem: "A 95% confidence interval for a conversion lift is [-0.4%, +3.2%]. What should be concluded?",
    options: [
      "The result is not statistically significant at this level",
      "The lift is 1.4% on average",
      "There is a 95% chance the lift is positive",
      "The test must be run with a larger effect size",
    ],
    answer: "The result is not statistically significant at this level",
    explanation:
      "The interval includes zero, so no difference cannot be ruled out at 95%. The midpoint is a point estimate, not a finding, and the interval does not give the probability of the parameter.",
  },
  {
    topic: "averages",
    difficulty: "medium",
    stem: "A team's response times are 2, 3, 3, 4 and 88 minutes. Which measure best describes typical performance?",
    options: ["The median, 3 minutes", "The mean, 20 minutes", "The range, 86 minutes", "The mode is meaningless here"],
    answer: "The median, 3 minutes",
    explanation:
      "The mean of 20 is dragged up by a single 88-minute outlier and describes none of the actual observations. The median of 3 reflects a typical response.",
  },
  {
    topic: "probability",
    difficulty: "hard",
    stem: "A test for a condition affecting 1% of people is 99% accurate in both directions. A person tests positive. Roughly what is the chance they have the condition?",
    options: ["About 50%", "About 99%", "About 90%", "About 1%"],
    answer: "About 50%",
    explanation:
      "In 10,000 people, 100 have it and 99 test positive. Of the 9,900 without it, 1% — that is 99 people — also test positive. So 99 of 198 positives are true, about 50%. Rare conditions make false positives compete with true ones.",
  },
];
