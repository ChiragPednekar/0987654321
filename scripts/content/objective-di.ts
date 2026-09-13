import type { ObjectiveSeed } from "./types";

const TABLE = `Quarterly revenue and cost, FY25 (₹ crore)

| Quarter | Revenue | COGS | Opex |
|---------|---------|------|------|
| Q1      | 420     | 252  | 105  |
| Q2      | 480     | 278  | 115  |
| Q3      | 540     | 324  | 118  |
| Q4      | 600     | 342  | 132  |`;

const FUNNEL = `Monthly signup funnel, a D2C brand

| Month | Visitors | Signups | Paid | Churned |
|-------|----------|---------|------|---------|
| Jan   | 120,000  | 6,000   | 900  | 90      |
| Feb   | 150,000  | 8,250   | 1,155| 139     |
| Mar   | 180,000  | 9,000   | 1,530| 199     |`;

/**
 * Data interpretation.
 *
 * Two shared stimuli rather than ten unrelated ones, which is how DI is
 * actually set: the cost of reading the table is paid once and then several
 * questions exploit it. It also exercises the `context` column the way the
 * schema intends.
 */
export const DATA_INTERPRETATION: ObjectiveSeed[] = [
  {
    topic: "margin analysis",
    difficulty: "easy",
    context: TABLE,
    stem: "What was the gross margin percentage in Q3?",
    options: ["40.0%", "38.5%", "42.2%", "36.7%"],
    correct_index: 0,
    explanation:
      "Gross profit = 540 − 324 = 216. 216 / 540 = 40.0%.",
  },
  {
    topic: "margin analysis",
    difficulty: "medium",
    context: TABLE,
    stem: "In which quarter was operating margin (revenue less COGS less opex) highest as a percentage of revenue?",
    options: ["Q4", "Q3", "Q2", "Q1"],
    correct_index: 0,
    explanation:
      "Q1: (420−252−105)/420 = 15.0%. Q2: (480−278−115)/480 = 18.1%. Q3: (540−324−118)/540 = 18.1%. Q4: (600−342−132)/600 = 21.0%. Q4 is highest.",
  },
  {
    topic: "growth rates",
    difficulty: "medium",
    context: TABLE,
    stem: "Revenue grew fastest quarter-on-quarter between which pair?",
    options: ["Q1 to Q2", "Q2 to Q3", "Q3 to Q4", "Growth was equal throughout"],
    correct_index: 0,
    explanation:
      "Q1→Q2: 60/420 = 14.3%. Q2→Q3: 60/480 = 12.5%. Q3→Q4: 60/540 = 11.1%. The absolute rise is ₹60 crore every time, so the percentage falls as the base grows — the point the question is testing.",
  },
  {
    topic: "cost structure",
    difficulty: "hard",
    context: TABLE,
    stem: "If Q4 opex had held at the same percentage of revenue as Q1, what would Q4 operating profit have been?",
    options: ["₹108 crore", "₹126 crore", "₹132 crore", "₹96 crore"],
    correct_index: 0,
    explanation:
      "Q1 opex ratio = 105/420 = 25%. On ₹600 crore that is ₹150 crore, not ₹132 crore. Operating profit = 600 − 342 − 150 = ₹108 crore.",
  },
  {
    topic: "conversion funnel",
    difficulty: "easy",
    context: FUNNEL,
    stem: "What was the visitor-to-signup conversion rate in February?",
    options: ["5.5%", "5.0%", "6.0%", "4.5%"],
    correct_index: 0,
    explanation: "8,250 / 150,000 = 5.5%.",
  },
  {
    topic: "conversion funnel",
    difficulty: "medium",
    context: FUNNEL,
    stem: "Signup-to-paid conversion moved how, from January to March?",
    options: [
      "Rose from 15.0% to 17.0%",
      "Fell from 15.0% to 14.0%",
      "Held flat at 15.0%",
      "Rose from 14.0% to 15.0%",
    ],
    correct_index: 0,
    explanation:
      "Jan: 900/6,000 = 15.0%. Mar: 1,530/9,000 = 17.0%. Note the trap of comparing paid to visitors instead of to signups.",
  },
  {
    topic: "churn",
    difficulty: "hard",
    context: FUNNEL,
    stem: "Monthly churn as a percentage of paid customers is best described as:",
    options: [
      "Rising, from 10.0% to 13.0%",
      "Falling, from 13.0% to 10.0%",
      "Flat at about 12%",
      "Cannot be determined from the table",
    ],
    correct_index: 0,
    explanation:
      "Jan 90/900 = 10.0%, Feb 139/1,155 = 12.0%, Mar 199/1,530 = 13.0%. Churn is worsening even as paid customers grow, which is the insight the numbers are hiding.",
  },
];
