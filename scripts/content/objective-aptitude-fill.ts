import type { ObjectiveSeed } from "./types";

const ATTRITION = `Attrition and headcount, a services firm

| Year | Opening headcount | Joiners | Leavers |
|------|-------------------|---------|---------|
| 2022 | 8,000             | 2,400   | 1,600   |
| 2023 | 8,800             | 2,640   | 2,200   |
| 2024 | 9,240             | 2,310   | 2,772   |
| 2025 | 8,778             | 3,100   | 2,200   |`;

const PLANTS = `Output and defects, four plants (one month)

| Plant | Units produced | Defective units | Cost per unit (₹) |
|-------|----------------|-----------------|-------------------|
| North | 24,000         | 720             | 180               |
| South | 18,000         | 360             | 195               |
| East  | 30,000         | 1,500           | 165               |
| West  | 12,000         | 180             | 210               |`;

/** Data interpretation, third batch. */
export const DATA_INTERPRETATION_FILL: ObjectiveSeed[] = [
  {
    topic: "attrition",
    difficulty: "easy",
    context: ATTRITION,
    stem: "In which year did headcount fall?",
    options: ["2024", "2023", "2025", "It never fell"],
    answer: "2024",
    explanation: "2024 had 2,310 joiners against 2,772 leavers, a net loss of 462 — the only year leavers exceeded joiners.",
  },
  {
    topic: "attrition",
    difficulty: "medium",
    context: ATTRITION,
    stem: "Attrition as a percentage of opening headcount was highest in:",
    options: ["2024", "2023", "2025", "2022"],
    answer: "2024",
    explanation: "2022: 1,600/8,000 = 20.0%. 2023: 2,200/8,800 = 25.0%. 2024: 2,772/9,240 = 30.0%. 2025: 2,200/8,778 = 25.1%. Highest is 2024.",
  },
  {
    topic: "attrition",
    difficulty: "hard",
    context: ATTRITION,
    stem: "Across all four years, net headcount change was:",
    options: ["+1,678", "+1,000", "−462", "+2,400"],
    answer: "+1,678",
    explanation: "Total joiners 10,450, total leavers 8,772, net +1,678. Check against the table: opening 8,000 in 2022 and 8,778 + 3,100 − 2,200 = 9,678 at the end of 2025, a rise of 1,678.",
  },
  {
    topic: "quality",
    difficulty: "easy",
    context: PLANTS,
    stem: "Which plant has the highest defect rate?",
    options: ["East", "North", "South", "West"],
    answer: "East",
    explanation: "North 3.0%, South 2.0%, East 5.0%, West 1.5%. East is worst despite producing the most units, which is the point of using a rate rather than a count.",
  },
  {
    topic: "cost analysis",
    difficulty: "medium",
    context: PLANTS,
    stem: "Which plant has the lowest cost per GOOD unit produced?",
    options: ["North", "East", "South", "West"],
    answer: "East",
    explanation: "Cost per good unit = cost per unit ÷ (1 − defect rate). North 180/0.97 = ₹185.6. South 195/0.98 = ₹199.0. East 165/0.95 = ₹173.7. West 210/0.985 = ₹213.2. East is cheapest despite having the worst defect rate — its unit cost advantage more than covers the scrap.",
  },
  {
    topic: "cost analysis",
    difficulty: "hard",
    context: PLANTS,
    stem: "If East cut its defect rate to South's, how much would it save in a month?",
    options: ["₹1.485 lakh", "₹14.85 lakh", "₹2.475 lakh", "₹49.5 lakh"],
    answer: "₹1.485 lakh",
    explanation: "East's defects would fall from 1,500 to 2% of 30,000 = 600 units, saving 900 units of production at ₹165 each = ₹1,48,500, or ₹1.485 lakh."
  },
  {
    topic: "weighted average",
    difficulty: "medium",
    context: PLANTS,
    stem: "The overall defect rate across all four plants is closest to:",
    options: ["3.3%", "2.9%", "4.0%", "2.5%"],
    answer: "3.3%",
    explanation: "Total defects 2,760 on total production 84,000 = 3.29%. Note this is not the simple average of the four plant rates (2.875%) — a weighted average must weight by volume, and East's large, defect-heavy output pulls the total up.",
  },
];

/** Logical reasoning, third batch. */
export const LOGICAL_REASONING_FILL: ObjectiveSeed[] = [
  {
    topic: "arrangement",
    difficulty: "easy",
    stem: "Five books are stacked. Physics is above Chemistry. Maths is below Chemistry. English is at the top. Statistics is between Chemistry and Maths. From top to bottom, the order is:",
    options: [
      "English, Physics, Chemistry, Statistics, Maths",
      "English, Chemistry, Physics, Statistics, Maths",
      "English, Physics, Statistics, Chemistry, Maths",
      "Physics, English, Chemistry, Statistics, Maths",
    ],
    answer: "English, Physics, Chemistry, Statistics, Maths",
    explanation: "English is top. Physics above Chemistry, Chemistry above Statistics, Statistics above Maths gives the single consistent order.",
  },
  {
    topic: "series",
    difficulty: "medium",
    stem: "What comes next: 5, 11, 23, 47, ___?",
    options: ["95", "94", "96", "71"],
    answer: "95",
    explanation: "Each term doubles the previous and adds one: 47 × 2 + 1 = 95.",
  },
  {
    topic: "series",
    difficulty: "hard",
    stem: "What comes next: 2, 3, 5, 7, 11, 13, ___?",
    options: ["17", "15", "16", "19"],
    answer: "17",
    explanation: "The sequence is the primes. After 13 comes 17; 15 is 3 × 5 and 16 is even.",
  },
  {
    topic: "assumption",
    difficulty: "medium",
    stem: "\"We should fire the bottom 10% of performers each year — that is how the best companies stay competitive.\" This argument assumes:",
    options: [
      "Performance rankings measure performance accurately",
      "The company is currently uncompetitive",
      "Employees dislike being ranked",
      "Hiring replacements is cheap",
    ],
    answer: "Performance rankings measure performance accurately",
    explanation: "The whole policy rests on the ranking identifying genuinely weaker performers. If the ranking is noisy, or measures visibility rather than contribution, the policy removes people at random and destroys trust for nothing.",
  },
  {
    topic: "strengthen and weaken",
    difficulty: "medium",
    stem: "\"Our new packaging caused the sales increase — sales rose 15% in the month after launch.\" Which most strengthens this?",
    options: [
      "Sales in regions that kept old packaging were flat in the same month",
      "The packaging cost less to produce",
      "Customers said they liked the new look",
      "The category grew 15% that month",
    ],
    answer: "Sales in regions that kept old packaging were flat in the same month",
    explanation: "A control group is the strongest possible support for a causal claim. Option 4 actively weakens it by supplying a rival explanation.",
  },
  {
    topic: "cause and effect",
    difficulty: "hard",
    stem: "Cities with more police per capita have higher crime rates. The most likely explanation is:",
    options: [
      "Cities with more crime hire more police",
      "Police cause crime",
      "Police reporting is inaccurate",
      "The correlation is a coincidence",
    ],
    answer: "Cities with more crime hire more police",
    explanation: "Reverse causation. The direction of the arrow runs from crime to policing, not the other way — naming the direction explicitly is what an interviewer is listening for.",
  },
  {
    topic: "data sufficiency",
    difficulty: "hard",
    stem: "Did the firm grow revenue last year? (1) Volume rose 8%. (2) Average selling price fell 5%.",
    options: [
      "Both together are sufficient",
      "Statement 1 alone is sufficient",
      "Statement 2 alone is sufficient",
      "Neither alone nor both together are sufficient",
    ],
    answer: "Both together are sufficient",
    explanation: "Revenue = volume × price. 1.08 × 0.95 = 1.026, a rise of 2.6%. Either statement alone leaves the other factor unknown, so both are needed and together they settle it.",
  },
  {
    topic: "puzzle",
    difficulty: "medium",
    stem: "Three boxes are labelled Apples, Oranges, and Mixed. Every label is wrong. You may draw one fruit from one box. Which box should you draw from to identify all three?",
    options: ["Mixed", "Apples", "Oranges", "Any box works"],
    answer: "Mixed",
    explanation: "Since every label is wrong, the box labelled Mixed contains only one kind. Whatever you draw identifies it, and the other two follow by elimination. Drawing from Apples or Oranges leaves two possibilities open.",
  },
  {
    topic: "inference",
    difficulty: "medium",
    stem: "\"No candidate without a work permit was hired. Rohan was not hired.\" Which follows?",
    options: [
      "Nothing about Rohan's work permit follows",
      "Rohan had no work permit",
      "Rohan had a work permit",
      "Rohan applied late",
    ],
    answer: "Nothing about Rohan's work permit follows",
    explanation: "Having a permit was necessary for hiring, not sufficient. Rohan may have held a permit and been rejected for any other reason. Denying the antecedent is the classic error here.",
  },
  {
    topic: "coding decoding",
    difficulty: "hard",
    stem: "If TEAM is coded 20-5-1-13, how is WORK coded?",
    options: ["23-15-18-11", "23-14-18-11", "22-15-18-11", "23-15-17-11"],
    answer: "23-15-18-11",
    explanation: "Each letter maps to its position in the alphabet. W=23, O=15, R=18, K=11.",
  },
];

/** Verbal, third batch — weighted towards the easy end, which was bare. */
export const VERBAL_FILL: ObjectiveSeed[] = [
  {
    topic: "usage",
    difficulty: "easy",
    stem: "Choose the correct sentence.",
    options: [
      "The number of applicants has risen sharply.",
      "The number of applicants have risen sharply.",
      "A number of applicants has risen sharply.",
      "The amount of applicants has risen sharply.",
    ],
    answer: "The number of applicants has risen sharply.",
    explanation: "\"The number\" is singular and takes \"has\"; \"a number of\" is plural and takes \"have\". Applicants are countable, so \"amount\" is wrong.",
  },
  {
    topic: "usage",
    difficulty: "easy",
    stem: "Which word correctly completes the sentence? \"The new policy will ___ the old one from April.\"",
    options: ["supersede", "supercede", "precede", "proceed"],
    answer: "supersede",
    explanation: "Supersede means to replace. \"Supercede\" is a common misspelling, \"precede\" means to come before, and \"proceed\" means to continue.",
  },
  {
    topic: "usage",
    difficulty: "easy",
    stem: "Choose the correct form: \"The findings had a significant ___ on the board's decision.\"",
    options: ["effect", "affect", "affectation", "efficacy"],
    answer: "effect",
    explanation: "As a noun meaning result, it is \"effect\". \"Affect\" is normally the verb.",
  },
  {
    topic: "vocabulary in context",
    difficulty: "easy",
    stem: "\"The CFO gave a candid assessment of the quarter.\" Candid means:",
    options: ["Frank and honest", "Optimistic", "Detailed", "Confidential"],
    answer: "Frank and honest",
    explanation: "Candid describes openness, often uncomfortably so. It carries no implication about length or secrecy.",
  },
  {
    topic: "vocabulary in context",
    difficulty: "medium",
    stem: "\"The proposal was met with tepid enthusiasm.\" This means the response was:",
    options: ["Lukewarm", "Hostile", "Overwhelming", "Confused"],
    answer: "Lukewarm",
    explanation: "Tepid literally means slightly warm; figuratively, unenthusiastic. Paired with \"enthusiasm\" it is deliberate understatement.",
  },
  {
    topic: "reading comprehension",
    difficulty: "easy",
    context:
      "India added more renewable capacity last year than in any previous year, and coal generation also hit a record. Both facts are true and neither cancels the other. Renewables are growing fast from a small base while total demand grows faster still, so new clean capacity is being absorbed by new consumption rather than displacing old plants. Displacement begins only when new capacity outpaces demand growth.",
    stem: "According to the passage, coal generation rose because:",
    options: [
      "Total demand grew faster than renewable capacity was added",
      "Renewable capacity fell",
      "Coal became cheaper",
      "Renewables are unreliable",
    ],
    answer: "Total demand grew faster than renewable capacity was added",
    explanation: "The passage says new clean capacity is absorbed by new consumption. It makes no claim about coal prices or renewable reliability.",
  },
  {
    topic: "reading comprehension",
    difficulty: "medium",
    context:
      "India added more renewable capacity last year than in any previous year, and coal generation also hit a record. Both facts are true and neither cancels the other. Renewables are growing fast from a small base while total demand grows faster still, so new clean capacity is being absorbed by new consumption rather than displacing old plants. Displacement begins only when new capacity outpaces demand growth.",
    stem: "The author's purpose is mainly to:",
    options: [
      "Reconcile two statistics that appear to contradict each other",
      "Argue that renewables have failed",
      "Advocate closing coal plants",
      "Predict when coal use will peak",
    ],
    answer: "Reconcile two statistics that appear to contradict each other",
    explanation: "The second sentence states the task directly: both facts are true and neither cancels the other. No recommendation or forecast is offered.",
  },
  {
    topic: "para jumble",
    difficulty: "medium",
    stem: "Order these into a paragraph. (1) Most never recover the lost ground. (2) A recall forces a brand to admit a defect publicly. (3) Firms that move first usually see trust return within a year. (4) Those that delay face regulators as well as customers.",
    options: ["2-3-4-1", "2-4-3-1", "3-2-4-1", "2-1-3-4"],
    answer: "2-3-4-1",
    explanation: "Set-up (2), then the contrasting pair of outcomes (3 fast movers, 4 delayers), then the consequence for the delayers (1). Option 2 breaks the pairing by separating 3 from its contrast.",
  },
  {
    topic: "para completion",
    difficulty: "medium",
    stem: "\"The company measures everything its employees do. It still cannot say which of its managers are any good. ___\"",
    options: [
      "Measurement and understanding are not the same thing.",
      "It should collect more data.",
      "Managers resist being measured.",
      "Employee monitoring is unethical.",
    ],
    answer: "Measurement and understanding are not the same thing.",
    explanation: "The completion has to name the tension the two sentences set up. Calling for more data ignores it, and the other two introduce claims the setup does not support.",
  },
  {
    topic: "summary",
    difficulty: "medium",
    stem: "Best summary of: \"We could enter the market now and lose money for three years while building share, or enter in year three when margins are established but share is taken.\"",
    options: [
      "Entering early costs money; entering late costs position.",
      "The market is not worth entering.",
      "We should enter in year three.",
      "Margins will improve over three years.",
    ],
    answer: "Entering early costs money; entering late costs position.",
    explanation: "The sentence poses a trade-off and does not resolve it. Options 2 and 3 invent a decision the sentence declines to make.",
  },
  {
    topic: "sentence correction",
    difficulty: "medium",
    stem: "Choose the best version: \"Neither of the two proposals were acceptable to the committee, which rejected them both.\"",
    options: [
      "Neither of the two proposals was acceptable to the committee, which rejected both.",
      "Neither of the two proposals were acceptable to the committee, which rejected both.",
      "Neither proposals was acceptable to the committee, which rejected them both.",
      "Neither of the two proposals was acceptable to the committee, who rejected both.",
    ],
    answer: "Neither of the two proposals was acceptable to the committee, which rejected both.",
    explanation: "\"Neither\" is singular, so \"was\". A committee is a thing, so \"which\" rather than \"who\". \"Them both\" is redundant after \"rejected\".",
  },
  {
    topic: "vocabulary in context",
    difficulty: "medium",
    stem: "\"The growth figures were, on closer inspection, spurious.\" Spurious means:",
    options: ["False or not genuine", "Surprisingly large", "Difficult to verify", "Seasonally adjusted"],
    answer: "False or not genuine",
    explanation: "Spurious means fake or based on false reasoning — stronger than merely unverified.",
  },
];
