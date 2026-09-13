import type { ObjectiveSeed } from "./types";

/**
 * Quantitative aptitude.
 *
 * Weighted towards the arithmetic that actually recurs in placement papers —
 * percentages, ratio, profit and loss, time-speed-distance, averages and
 * simple interest — rather than the competitive-exam exotica that never gets
 * asked. Every explanation shows the working, because the explanation is what
 * the student learns from; the correct option on its own teaches nothing.
 */
export const QUANT: ObjectiveSeed[] = [
  {
    topic: "percentages",
    difficulty: "easy",
    stem: "A product priced at ₹2,400 is discounted by 15%, then a further 10% is taken off the discounted price. What is the final price?",
    options: ["₹1,836", "₹1,800", "₹1,860", "₹1,920"],
    answer: "₹1,836",
    explanation:
      "Successive discounts multiply, they do not add. 2400 × 0.85 = 2040, then 2040 × 0.90 = ₹1,836. A flat 25% would give ₹1,800, which is the trap option.",
  },
  {
    topic: "percentages",
    difficulty: "medium",
    stem: "A company's revenue rose 25% in FY24 and fell 20% in FY25. Compared with FY23, FY25 revenue is:",
    options: ["Unchanged", "5% higher", "5% lower", "1% higher"],
    answer: "Unchanged",
    explanation:
      "1.25 × 0.80 = 1.00. A rise of 25% followed by a fall of 20% returns exactly to the base, because 20% of the larger number equals 25% of the smaller one.",
  },
  {
    topic: "profit and loss",
    difficulty: "medium",
    stem: "A retailer marks up cost by 40% and then offers a 25% discount on the marked price. What is the profit margin on cost?",
    options: ["5%", "15%", "10%", "12.5%"],
    answer: "5%",
    explanation:
      "Take cost as 100. Marked price 140, selling price 140 × 0.75 = 105. Profit is 5 on a cost of 100, so 5%.",
  },
  {
    topic: "ratio and proportion",
    difficulty: "easy",
    stem: "Three partners invest in the ratio 3:4:5 and share profit in proportion to investment. If the largest share is ₹4.5 lakh, what is the total profit?",
    options: ["₹10.8 lakh", "₹12 lakh", "₹9 lakh", "₹13.5 lakh"],
    answer: "₹10.8 lakh",
    explanation:
      "5 parts = ₹4.5 lakh, so 1 part = ₹0.9 lakh. Total is 12 parts = ₹10.8 lakh.",
  },
  {
    topic: "averages",
    difficulty: "medium",
    stem: "The average salary of 10 employees is ₹40,000. One employee earning ₹85,000 leaves. What is the new average?",
    options: ["₹35,000", "₹36,000", "₹37,500", "₹38,000"],
    answer: "₹35,000",
    explanation:
      "Total was 10 × 40,000 = ₹4,00,000. After the departure: 4,00,000 − 85,000 = ₹3,15,000 across 9 people = ₹35,000.",
  },
  {
    topic: "time speed distance",
    difficulty: "medium",
    stem: "A delivery van covers the first 60 km at 30 km/h and the next 60 km at 60 km/h. What is the average speed for the whole trip?",
    options: ["40 km/h", "45 km/h", "48 km/h", "50 km/h"],
    answer: "40 km/h",
    explanation:
      "Average speed is total distance over total time, never the average of the speeds. Time = 2 + 1 = 3 hours for 120 km, so 40 km/h. The 45 option is the trap.",
  },
  {
    topic: "simple and compound interest",
    difficulty: "medium",
    stem: "₹50,000 is invested at 12% per annum compounded annually. What is the value after 2 years?",
    options: ["₹62,720", "₹62,000", "₹63,000", "₹61,440"],
    answer: "₹62,720",
    explanation:
      "50,000 × 1.12² = 50,000 × 1.2544 = ₹62,720. Simple interest would give ₹62,000, which is the distractor.",
  },
  {
    topic: "work and time",
    difficulty: "medium",
    stem: "A can finish a job in 12 days and B in 18 days. Working together, how long do they take?",
    options: ["7.2 days", "7.5 days", "8 days", "6.5 days"],
    answer: "7.2 days",
    explanation:
      "Rates add: 1/12 + 1/18 = 3/36 + 2/36 = 5/36 per day. Time = 36/5 = 7.2 days.",
  },
  {
    topic: "percentages",
    difficulty: "hard",
    stem: "A firm's gross margin is 40%. If material cost rises 10% and material is 60% of cost of goods sold, by how much must price rise to hold the gross margin percentage constant?",
    options: ["6.0%", "3.6%", "4.0%", "10.0%"],
    answer: "6.0%",
    explanation:
      "Take price 100, COGS 60. Material is 60% of COGS = 36, rising by 3.6 to 39.6, so COGS becomes 63.6. To hold a 40% margin, COGS must stay 60% of price, so price = 63.6 / 0.6 = 106. A 6% rise.",
  },
  {
    topic: "mixtures",
    difficulty: "hard",
    stem: "A 40-litre solution is 25% acid. How much pure acid must be added to make it 40% acid?",
    options: ["10 litres", "8 litres", "6 litres", "12 litres"],
    answer: "10 litres",
    explanation:
      "Acid now = 10 L, non-acid = 30 L, which does not change. After adding x, non-acid must be 60% of the total: 30 = 0.6 × (40 + x), so 40 + x = 50 and x = 10 litres.",
  },
];
