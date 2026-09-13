import type { ObjectiveSeed } from "./types";

/** Logical reasoning — arrangements, syllogisms, and the assumption/inference family. */
export const LOGICAL_REASONING: ObjectiveSeed[] = [
  {
    topic: "syllogism",
    difficulty: "easy",
    stem: "All consultants are analysts. Some analysts are engineers. Which follows necessarily?",
    options: [
      "Nothing about consultants and engineers follows",
      "Some consultants are engineers",
      "No consultant is an engineer",
      "All engineers are analysts",
    ],
    answer: "Nothing about consultants and engineers follows",
    explanation:
      "The engineers who are analysts need not be among the consultants. An overlap is possible but not necessary, and 'some' never licenses a conclusion about a specific subset.",
  },
  {
    topic: "assumption",
    difficulty: "medium",
    stem: "\"We should move the launch to October. Sales in October were 30% higher than in June last year.\" This argument assumes:",
    options: [
      "The October uplift was seasonal rather than caused by something one-off",
      "October has more working days than June",
      "The product is unchanged from last year",
      "Competitors will not launch in October",
    ],
    answer: "The October uplift was seasonal rather than caused by something one-off",
    explanation:
      "The argument moves from one observed month to a rule about October. It only works if the uplift repeats — that is, if it was seasonal and not caused by, say, a one-time campaign. The others are plausible concerns but are not what the inference rests on.",
  },
  {
    topic: "strengthen and weaken",
    difficulty: "medium",
    stem: "A manager claims a new training programme caused a 12% productivity rise. Which finding would most weaken the claim?",
    options: [
      "A new production line was installed in the same month",
      "Some employees disliked the training",
      "The training cost more than budgeted",
      "Productivity also rose 2% the previous year",
    ],
    answer: "A new production line was installed in the same month",
    explanation:
      "A confounder that could independently produce the same effect is the strongest attack on a causal claim. Cost and satisfaction say nothing about causation, and a 2% prior trend does not account for 12%.",
  },
  {
    topic: "arrangement",
    difficulty: "medium",
    stem: "Five candidates sit in a row. B is immediately right of A. C is at one end. D is not adjacent to B. If A is second from the left, who is at the far right?",
    options: ["D", "C", "E", "Cannot be determined"],
    answer: "D",
    explanation:
      "A is position 2, so B is 3. C must be at an end and position 1 is the only end left open to it once we test both, giving C-A-B-?-?. D cannot be adjacent to B, so D is not position 4; D takes 5 and E takes 4.",
  },
  {
    topic: "cause and effect",
    difficulty: "hard",
    stem: "Stores that adopted self-checkout saw a 9% fall in average basket size. The chain concludes self-checkout reduces spend. The most serious flaw is:",
    options: [
      "Stores that adopted it may already have had different shopper mixes",
      "9% is not a large enough fall to matter",
      "Basket size is the wrong metric for a retailer",
      "The study did not measure staff satisfaction",
    ],
    answer: "Stores that adopted it may already have had different shopper mixes",
    explanation:
      "Adoption was not random. If self-checkout went first to stores with more small top-up trips, the fall is selection, not effect. This is the standard selection-bias objection and is worth naming in an interview.",
  },
  {
    topic: "inference",
    difficulty: "medium",
    stem: "\"Every product we launched after 2022 uses the new platform. The Orion app uses the old platform.\" Which follows?",
    options: [
      "Orion was launched in or before 2022",
      "Orion will be migrated",
      "Orion is unprofitable",
      "The new platform is better",
    ],
    answer: "Orion was launched in or before 2022",
    explanation:
      "Contrapositive. If launched after 2022 then new platform; Orion is not on the new platform, so Orion was not launched after 2022.",
  },
  {
    topic: "data sufficiency",
    difficulty: "hard",
    stem: "Is the company profitable? (1) Revenue exceeds fixed costs. (2) Contribution margin is 35%.",
    options: [
      "Neither alone nor both together are sufficient",
      "Statement 1 alone is sufficient",
      "Statement 2 alone is sufficient",
      "Both together are sufficient",
    ],
    answer: "Neither alone nor both together are sufficient",
    explanation:
      "Profit needs contribution (revenue × margin) to exceed fixed costs, not revenue itself. Knowing revenue > fixed costs and a 35% margin still leaves both outcomes possible — contribution could be above or below fixed costs depending on the actual magnitudes.",
  },
];

/** Verbal — reading comprehension, usage, and para-completion. */
export const VERBAL: ObjectiveSeed[] = [
  {
    topic: "reading comprehension",
    difficulty: "medium",
    context:
      "The firm's decline was not caused by the arrival of low-cost rivals, as is usually claimed. Its margins had been eroding for six years before the first competitor entered, driven by a distribution contract that guaranteed shelf space at a fixed fee regardless of volume. When volume fell, the fee did not. The rivals merely made visible a weakness that had already been priced in.",
    stem: "The author's main point is that:",
    options: [
      "The usual explanation mistakes a symptom for a cause",
      "Low-cost rivals destroyed the firm's margins",
      "Fixed-fee distribution contracts are always unwise",
      "The firm should have exited the category sooner",
    ],
    answer: "The usual explanation mistakes a symptom for a cause",
    explanation:
      "The passage explicitly rejects the rival-driven account and relocates the cause to the contract. It does not generalise about contracts, nor recommend exit.",
  },
  {
    topic: "reading comprehension",
    difficulty: "hard",
    context:
      "The firm's decline was not caused by the arrival of low-cost rivals, as is usually claimed. Its margins had been eroding for six years before the first competitor entered, driven by a distribution contract that guaranteed shelf space at a fixed fee regardless of volume. When volume fell, the fee did not. The rivals merely made visible a weakness that had already been priced in.",
    stem: "\"Priced in\" is used here to mean that the weakness had:",
    options: [
      "Already been reflected in the firm's economics before rivals appeared",
      "Been included in the contract's stated fee",
      "Been discounted by the stock market",
      "Been passed on to customers",
    ],
    answer: "Already been reflected in the firm's economics before rivals appeared",
    explanation:
      "The phrase is borrowed from markets but used loosely: the damage was already present in the numbers. Option 3 is the literal market sense and is the trap.",
  },
  {
    topic: "para completion",
    difficulty: "medium",
    stem: "\"Most restructuring programmes report savings in their first year. Few report them in their third. ___\"",
    options: [
      "The costs that were removed tend to return under different names.",
      "Restructuring is therefore always a mistake.",
      "First-year savings are usually overstated by accountants.",
      "Third-year reporting standards are weaker.",
    ],
    answer: "The costs that were removed tend to return under different names.",
    explanation:
      "The completion must explain the gap between year one and year three. Option 1 does exactly that. Option 2 overreaches, and the others assert unsupported claims about reporting.",
  },
  {
    topic: "usage",
    difficulty: "easy",
    stem: "Choose the sentence that is correct.",
    options: [
      "The data suggest that margins are recovering.",
      "The data suggests that margins are recovering, however the board disagrees.",
      "Between the three options, the second is best.",
      "The effect of the policy will effect margins.",
    ],
    answer: "The data suggest that margins are recovering.",
    explanation:
      "'Data' takes a plural verb in formal usage. Option 2 is a comma splice, option 3 should be 'among' for three, and option 4 confuses effect with affect.",
  },
  {
    topic: "summary",
    difficulty: "medium",
    stem: "Which is the best one-line summary of: \"We can cut price to defend share, but our cost base is higher than the entrant's, so a price war we win still leaves us earning less than before\"?",
    options: [
      "Winning a price war here would still destroy value.",
      "We should not compete with the entrant.",
      "Our cost base must be reduced immediately.",
      "Market share is not worth defending.",
    ],
    answer: "Winning a price war here would still destroy value.",
    explanation:
      "The sentence concedes the war is winnable and objects on economics. Options 2 and 4 discard the concession; option 3 adds a recommendation the sentence never makes.",
  },
];
