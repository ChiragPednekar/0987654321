import type { ObjectiveSeed } from "./types";

const HIRING = `Campus hiring, a consulting firm (offers made)

| Year | Applied | Shortlisted | Interviewed | Offers |
|------|---------|-------------|-------------|--------|
| 2022 | 4,800   | 960         | 384         | 96     |
| 2023 | 6,000   | 1,080       | 432         | 108    |
| 2024 | 7,500   | 1,125       | 450         | 99     |
| 2025 | 9,000   | 1,260       | 504         | 126    |`;

const SEGMENTS = `Revenue by segment (₹ crore) and headcount

| Segment   | FY24 Rev | FY25 Rev | FY25 Headcount |
|-----------|----------|----------|----------------|
| Software  | 1,250    | 1,600    | 3,200          |
| Services  | 2,100    | 2,268    | 9,450          |
| Hardware  | 900      | 810      | 1,350          |`;

const SPEND = `Marketing spend and acquisitions, four channels (one quarter)

| Channel   | Spend (₹ lakh) | New customers |
|-----------|----------------|---------------|
| Search    | 180            | 12,000        |
| Social    | 240            | 12,000        |
| Affiliate | 60             | 2,400         |
| Offline   | 120            | 3,000         |`;

/**
 * Data interpretation, second batch.
 *
 * Three more shared stimuli. The questions are built so that reading the table
 * carefully beats computing quickly — most DI marks are lost to misreading a
 * row, not to arithmetic.
 */
export const DATA_INTERPRETATION_MORE: ObjectiveSeed[] = [
  {
    topic: "conversion funnel",
    difficulty: "easy",
    context: HIRING,
    stem: "In which year was the shortlisting rate (shortlisted ÷ applied) lowest?",
    options: ["2025", "2024", "2023", "2022"],
    answer: "2025",
    explanation: "2022: 960/4,800 = 20.0%. 2023: 1,080/6,000 = 18.0%. 2024: 1,125/7,500 = 15.0%. 2025: 1,260/9,000 = 14.0%. The rate falls every year; 2025 is lowest.",
  },
  {
    topic: "conversion funnel",
    difficulty: "medium",
    context: HIRING,
    stem: "The offer rate from interview (offers ÷ interviewed) fell in which year?",
    options: ["2024", "2023", "2025", "It never fell"],
    answer: "2024",
    explanation: "2022: 96/384 = 25.0%. 2023: 108/432 = 25.0%. 2024: 99/450 = 22.0%. 2025: 126/504 = 25.0%. Only 2024 fell.",
  },
  {
    topic: "growth rates",
    difficulty: "medium",
    context: HIRING,
    stem: "Applications nearly doubled from 2022 to 2025. Offers over the same period rose by:",
    options: ["31%", "50%", "25%", "44%"],
    answer: "31%",
    explanation: "96 to 126 is a rise of 30 on 96 = 31.25%, so about 31%. Applications rose 87% — the funnel got much harder, which is the story the table tells.",
  },
  {
    topic: "productivity",
    difficulty: "medium",
    context: SEGMENTS,
    stem: "Which segment had the highest FY25 revenue per employee?",
    options: ["Software", "Services", "Hardware", "Software and Hardware are equal"],
    answer: "Hardware",
    explanation: "Software: 1,600/3,200 = ₹0.50 crore. Services: 2,268/9,450 = ₹0.24 crore. Hardware: 810/1,350 = ₹0.60 crore. Hardware is highest — the shrinking segment is the most productive per head, which is why revenue per employee alone never settles a portfolio question.",
  },
  {
    topic: "growth rates",
    difficulty: "easy",
    context: SEGMENTS,
    stem: "Which segment shrank year on year?",
    options: ["Hardware", "Services", "Software", "None shrank"],
    answer: "Hardware",
    explanation: "Hardware fell from 900 to 810, a 10% decline. Software grew 28% and Services 8%.",
  },
  {
    topic: "mix analysis",
    difficulty: "hard",
    context: SEGMENTS,
    stem: "Total revenue grew from ₹4,250 crore to ₹4,678 crore. How much of that ₹428 crore rise came from Software?",
    options: ["More than four fifths", "About half", "About a third", "All of it"],
    answer: "More than four fifths",
    explanation: "Software added 350, Services 168, Hardware −90. Net 428. Software's 350 is 82% of the rise, so more than four fifths — and the group's growth is really one segment's growth.",
  },
  {
    topic: "unit economics",
    difficulty: "easy",
    context: SPEND,
    stem: "Which channel has the lowest cost per acquisition?",
    options: ["Affiliate", "Search", "Social", "Offline"],
    answer: "Search",
    explanation: "Spend in lakh ÷ customers, in rupees: Search 1,80,00,000/12,000 = ₹1,500. Social ₹2,000. Affiliate ₹2,500. Offline ₹4,000. Search is cheapest.",
  },
  {
    topic: "unit economics",
    difficulty: "medium",
    context: SPEND,
    stem: "Search and Social both delivered 12,000 customers. Moving the entire Social budget to Search at Search's current CPA would deliver how many extra customers in total?",
    options: ["4,000", "16,000", "12,000", "8,000"],
    answer: "4,000",
    explanation: "₹240 lakh at Search's CPA of ₹1,500 buys 16,000 customers instead of 12,000 — 4,000 extra. In practice CPA rises as a channel scales, which is the objection an interviewer wants to hear.",
  },
  {
    topic: "unit economics",
    difficulty: "hard",
    context: SPEND,
    stem: "Total CPA across all four channels is closest to:",
    options: ["₹2,000", "₹2,500", "₹1,800", "₹3,000"],
    answer: "₹2,000",
    explanation: "Total spend ₹600 lakh = ₹6 crore. Total customers 29,400. 6,00,00,000 / 29,400 = ₹2,041, so about ₹2,000. Note this is not the average of the four CPAs, which would be ₹2,500 — the blended figure weights by volume.",
  },
];
