import type { ObjectiveSeed } from "./types";

/**
 * Quant, second batch.
 *
 * Kept in its own file rather than appended to the first so neither grows past
 * the point where a reviewer will actually read it. Same weighting: the
 * arithmetic that recurs in placement papers, with the working shown, because
 * the explanation is the part a student learns from.
 */
export const QUANT_MORE: ObjectiveSeed[] = [
  // ---- percentages --------------------------------------------------------
  {
    topic: "percentages",
    difficulty: "easy",
    stem: "In a batch of 250 students, 60% opted for finance and 25% of those also opted for analytics. How many took both?",
    options: ["37", "38", "40", "45"],
    answer: "38",
    explanation: "Finance = 250 × 0.60 = 150. Both = 150 × 0.25 = 37.5, which rounds to 38 students. (Where a count must be whole, round at the end, not midway.)",
  },
  {
    topic: "percentages",
    difficulty: "medium",
    stem: "A salary is cut by 20%. By what percentage must the reduced salary rise to return to the original?",
    options: ["20%", "22%", "25%", "30%"],
    answer: "25%",
    explanation: "Take 100 → 80. To return to 100 the rise is 20 on a base of 80 = 25%. The base changes, which is why the down and up percentages differ.",
  },
  {
    topic: "percentages",
    difficulty: "medium",
    stem: "A firm's market share went from 12% to 15%. The percentage point gain and the percentage gain are respectively:",
    options: ["3 and 25%", "3 and 20%", "25% and 3", "3 and 3%"],
    answer: "3 and 25%",
    explanation: "Percentage points are the arithmetic difference: 15 − 12 = 3. The percentage gain is relative: 3/12 = 25%. Confusing the two is the single most common error in a share discussion.",
  },
  {
    topic: "percentages",
    difficulty: "hard",
    stem: "Revenue rises 20% and costs rise 30%. If the original margin was 40%, what is the new margin?",
    options: ["35.0%", "37.5%", "32.5%", "40.0%"],
    answer: "37.5%",
    explanation: "Take revenue 100, cost 60, profit 40. New revenue 120, new cost 78, new profit 42. Margin = 42/120 = 35.0%. Careful: the answer is 35.0%, and the trap is computing 42/112 or forgetting the revenue base moved.",
  },

  // ---- profit and loss ----------------------------------------------------
  {
    topic: "profit and loss",
    difficulty: "easy",
    stem: "An item is sold for ₹660 at a 10% profit. What was the cost price?",
    options: ["₹594", "₹600", "₹610", "₹620"],
    answer: "₹600",
    explanation: "SP = CP × 1.10, so CP = 660 / 1.10 = ₹600. Subtracting 10% of the selling price gives ₹594, which is the trap.",
  },
  {
    topic: "profit and loss",
    difficulty: "medium",
    stem: "A trader sells two items at ₹1,200 each, one at 20% profit and one at 20% loss. Overall he:",
    options: ["Breaks even", "Loses ₹100", "Gains ₹100", "Loses ₹50"],
    answer: "Loses ₹100",
    explanation: "CP of the profitable item = 1200/1.2 = ₹1,000. CP of the loss item = 1200/0.8 = ₹1,500. Total CP ₹2,500 against total SP ₹2,400, a loss of ₹100. Equal percentages on equal selling prices always produce a net loss.",
  },
  {
    topic: "profit and loss",
    difficulty: "hard",
    stem: "A shopkeeper uses a 900 g weight while claiming 1 kg, and also sells at cost price. His profit percentage is:",
    options: ["10.0%", "11.1%", "9.0%", "12.5%"],
    answer: "11.1%",
    explanation: "He gives 900 g but charges for 1,000 g. Profit = 100/900 = 11.1%. The base is what he actually gave up, not what he claimed.",
  },

  // ---- ratio --------------------------------------------------------------
  {
    topic: "ratio and proportion",
    difficulty: "easy",
    stem: "If a:b = 2:3 and b:c = 4:5, then a:c is:",
    options: ["8:15", "2:5", "3:5", "8:12"],
    answer: "8:15",
    explanation: "Make b common: a:b = 8:12 and b:c = 12:15. So a:c = 8:15.",
  },
  {
    topic: "ratio and proportion",
    difficulty: "medium",
    stem: "A sum of ₹6,300 is divided among A, B and C such that A gets twice B, and B gets thrice C. C receives:",
    options: ["₹630", "₹700", "₹900", "₹1,050"],
    answer: "₹630",
    explanation: "Let C = x, B = 3x, A = 6x. Total 10x = 6,300, so x = ₹630.",
  },
  {
    topic: "ratio and proportion",
    difficulty: "medium",
    stem: "Two alloys contain copper and zinc in ratios 5:3 and 3:5. Equal weights are melted together. The new ratio is:",
    options: ["1:1", "5:3", "3:5", "2:1"],
    answer: "1:1",
    explanation: "Take 8 kg of each. First gives 5 copper, 3 zinc; second gives 3 copper, 5 zinc. Totals are 8 and 8, so 1:1.",
  },

  // ---- averages -----------------------------------------------------------
  {
    topic: "averages",
    difficulty: "easy",
    stem: "The average of five numbers is 28. If one number is removed the average becomes 25. The removed number is:",
    options: ["40", "38", "42", "35"],
    answer: "40",
    explanation: "Total was 140; after removal, 4 × 25 = 100. The removed number is 40.",
  },
  {
    topic: "averages",
    difficulty: "medium",
    stem: "A batsman's average after 16 innings is 36. He scores 70 in the 17th. His new average is:",
    options: ["38", "37", "36", "39"],
    answer: "38",
    explanation: "Total 576 + 70 = 646 over 17 innings = 38. Shortcut: the excess over the old average is 70 − 36 = 34, spread over 17 innings = +2.",
  },
  {
    topic: "averages",
    difficulty: "hard",
    stem: "The average age of a team of 11 is 30. The captain is 33 and the wicketkeeper is 3 years older than the captain. The average age of the remaining 9 is:",
    options: ["29", "28", "30", "27"],
    answer: "29",
    explanation: "Total = 11 × 30 = 330. Captain 33 plus keeper 36 = 69. Remaining = 261 over 9 = 29 exactly.",
  },

  // ---- time speed distance ------------------------------------------------
  {
    topic: "time speed distance",
    difficulty: "easy",
    stem: "A train 180 m long passes a pole in 9 seconds. Its speed is:",
    options: ["72 km/h", "60 km/h", "80 km/h", "66 km/h"],
    answer: "72 km/h",
    explanation: "Speed = 180/9 = 20 m/s. Convert: 20 × 18/5 = 72 km/h.",
  },
  {
    topic: "time speed distance",
    difficulty: "medium",
    stem: "Two cars start towards each other from points 300 km apart at 50 km/h and 70 km/h. They meet after:",
    options: ["2.5 hours", "3 hours", "2 hours", "3.5 hours"],
    answer: "2.5 hours",
    explanation: "Closing speed = 50 + 70 = 120 km/h. Time = 300/120 = 2.5 hours.",
  },
  {
    topic: "time speed distance",
    difficulty: "hard",
    stem: "A boat takes 4 hours downstream and 6 hours upstream for the same 48 km. The speed of the stream is:",
    options: ["1 km/h", "2 km/h", "3 km/h", "4 km/h"],
    answer: "2 km/h",
    explanation: "Downstream 48/4 = 12 km/h, upstream 48/6 = 8 km/h. Stream = (12 − 8)/2 = 2 km/h; boat in still water = 10 km/h.",
  },

  // ---- work ---------------------------------------------------------------
  {
    topic: "work and time",
    difficulty: "medium",
    stem: "12 workers finish a job in 15 days. How many days for 20 workers, working at the same rate?",
    options: ["9", "10", "12", "8"],
    answer: "9",
    explanation: "Worker-days are constant: 12 × 15 = 180. With 20 workers, 180/20 = 9 days.",
  },
  {
    topic: "work and time",
    difficulty: "hard",
    stem: "A and B together finish a task in 8 days. A alone takes 12 days. B alone takes:",
    options: ["20 days", "24 days", "18 days", "16 days"],
    answer: "24 days",
    explanation: "B's rate = 1/8 − 1/12 = 3/24 − 2/24 = 1/24, so 24 days.",
  },
  {
    topic: "work and time",
    difficulty: "medium",
    stem: "A pipe fills a tank in 6 hours and a leak empties it in 10 hours. With both open the tank fills in:",
    options: ["15 hours", "12 hours", "16 hours", "14 hours"],
    answer: "15 hours",
    explanation: "Net rate = 1/6 − 1/10 = 5/30 − 3/30 = 2/30 = 1/15, so 15 hours.",
  },

  // ---- interest -----------------------------------------------------------
  {
    topic: "simple and compound interest",
    difficulty: "medium",
    stem: "The difference between compound and simple interest on ₹10,000 for 2 years at 10% is:",
    options: ["₹100", "₹110", "₹120", "₹90"],
    answer: "₹100",
    explanation: "SI = 2,000. CI = 10,000 × 1.21 − 10,000 = 2,100. Difference ₹100. The shortcut for 2 years is P × r² = 10,000 × 0.01.",
  },
  {
    topic: "simple and compound interest",
    difficulty: "hard",
    stem: "A sum doubles in 8 years at simple interest. In how many years does it triple at the same rate?",
    options: ["16", "12", "24", "20"],
    answer: "16",
    explanation: "Doubling means interest equals principal in 8 years, so the rate earns 100% per 8 years. Tripling needs 200% of principal, which takes 16 years.",
  },

  // ---- numbers and algebra ------------------------------------------------
  {
    topic: "numbers",
    difficulty: "easy",
    stem: "The smallest number that must be added to 2,491 to make it divisible by 11 is:",
    options: ["6", "4", "5", "7"],
    answer: "6",
    explanation: "11 × 226 = 2,486, so 2,491 leaves a remainder of 5 and needs 6 more to reach 2,497 = 11 × 227. Check with the alternating-sum rule: 2−4+9−7 = 0, so 2,497 is divisible by 11.",
  },
  {
    topic: "numbers",
    difficulty: "medium",
    stem: "The LCM of two numbers is 144 and their HCF is 12. If one number is 36, the other is:",
    options: ["48", "36", "60", "72"],
    answer: "48",
    explanation: "Product of the numbers = LCM × HCF = 144 × 12 = 1,728. Other = 1,728/36 = 48.",
  },
  {
    topic: "algebra",
    difficulty: "medium",
    stem: "If 3x + 2y = 26 and x + y = 10, then x equals:",
    options: ["6", "4", "8", "5"],
    answer: "6",
    explanation: "From the second, y = 10 − x. Substituting: 3x + 20 − 2x = 26, so x = 6 and y = 4.",
  },
  {
    topic: "algebra",
    difficulty: "hard",
    stem: "A two-digit number is 4 times the sum of its digits. If 27 is added, the digits reverse. The number is:",
    options: ["36", "24", "48", "12"],
    answer: "36",
    explanation: "Let it be 10a + b. 10a + b = 4(a + b) gives 6a = 3b, so b = 2a. Reversal on adding 27 gives 10a + b + 27 = 10b + a, so 9b − 9a = 27 and b − a = 3. With b = 2a, a = 3 and b = 6: the number is 36.",
  },

  // ---- probability and counting ------------------------------------------
  {
    topic: "probability",
    difficulty: "easy",
    stem: "Two fair dice are rolled. The probability that the sum is 7 is:",
    options: ["1/6", "1/8", "5/36", "1/12"],
    answer: "1/6",
    explanation: "Six of the 36 outcomes sum to 7 (1-6, 2-5, 3-4 and their reversals), so 6/36 = 1/6. Seven is the most likely sum.",
  },
  {
    topic: "probability",
    difficulty: "medium",
    stem: "A bag has 4 red and 6 blue balls. Two are drawn without replacement. P(both red) is:",
    options: ["2/15", "4/25", "1/6", "3/20"],
    answer: "2/15",
    explanation: "(4/10) × (3/9) = 12/90 = 2/15. Without replacement, the second denominator drops.",
  },
  {
    topic: "permutations",
    difficulty: "medium",
    stem: "In how many ways can 5 people be seated in a row if two particular people must sit together?",
    options: ["48", "24", "96", "120"],
    answer: "48",
    explanation: "Treat the pair as one block: 4 items arrange in 4! = 24 ways, and the pair swaps internally in 2 ways. 24 × 2 = 48.",
  },
  {
    topic: "permutations",
    difficulty: "hard",
    stem: "From 7 consultants and 5 analysts, a team of 4 with at least 2 consultants can be formed in how many ways?",
    options: ["455", "420", "385", "525"],
    answer: "420",
    explanation: "Split by the number of consultants. 2C+2A: C(7,2) × C(5,2) = 21 × 10 = 210. 3C+1A: C(7,3) × C(5,1) = 35 × 5 = 175. 4C+0A: C(7,4) = 35. Total 420.",
  },

  // ---- mensuration --------------------------------------------------------
  {
    topic: "mensuration",
    difficulty: "easy",
    stem: "A rectangular warehouse floor is 40 m by 25 m. Flooring costs ₹350 per square metre. The total cost is:",
    options: ["₹3,50,000", "₹3,00,000", "₹4,00,000", "₹2,75,000"],
    answer: "₹3,50,000",
    explanation: "Area = 1,000 m². Cost = 1,000 × 350 = ₹3,50,000.",
  },
  {
    topic: "mensuration",
    difficulty: "medium",
    stem: "If the side of a square is increased by 20%, its area increases by:",
    options: ["44%", "40%", "20%", "24%"],
    answer: "44%",
    explanation: "Area scales with the square of the side: 1.2² = 1.44, a 44% rise. Area never rises by the same percentage as a length.",
  },
];
