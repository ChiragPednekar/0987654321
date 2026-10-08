/**
 * Canonical rubrics for written practice formats (guesstimates, WAT, behavioural,
 * root cause analysis, stock pitch, brand teardown, memo, and role-specific formats).
 *
 * Centralised here so weights and criteria are declared once, preventing drift
 * between seed banks where a format might otherwise be marked two different ways.
 */

export type Rubric = Record<string, [number, string]>;

export const GUESSTIMATE_RUBRIC: Rubric = {
  structure: [30, "Breaks the number into a chain of quantities that multiply to the answer, stated before any arithmetic."],
  assumptions: [30, "States each assumption explicitly with a reason. A defensible wrong number beats an unstated right one."],
  arithmetic: [20, "The maths is actually done and is correct given the assumptions."],
  sanity_check: [20, "Tests the answer against something known, and says what would move it most."],
};

export const GUESSTIMATE_EXPANSION_RUBRIC: Rubric = {
  structure: [30, "Breaks the number into a chain of quantities that multiply to the answer, stated before any arithmetic."],
  assumptions: [30, "States each assumption explicitly with a reason. A defensible wrong number beats an unstated right one."],
  arithmetic: [20, "Computes cleanly, carries units, and keeps the magnitudes straight."],
  sanity: [20, "Checks the result against something known and says whether it looks too high or too low."],
};

export const WAT_RUBRIC: Rubric = {
  position: [25, "Takes a clear position in the opening and holds it."],
  argument: [35, "Reasons are distinct, ordered, and actually support the position."],
  evidence: [20, "Uses concrete examples or figures rather than assertion."],
  expression: [20, "Tight, readable prose. No padding, no throat-clearing."],
};

export const WAT_EXPANSION_RUBRIC: Rubric = {
  position: [30, "Takes a clear position in the opening lines rather than surveying both sides and stopping."],
  argument: [30, "Supports the position with reasons and examples that actually bear on it."],
  balance: [20, "Acknowledges the strongest counter-argument and answers it."],
  expression: [20, "Clear, economical prose within the word limit, organised into coherent paragraphs."],
};

export const BEHAVIOURAL_RUBRIC: Rubric = {
  specificity: [35, "Grounded in the candidate's own history, not in general aspiration."],
  structure: [25, "Situation, action, result — followed without narrating the framework."],
  insight: [25, "Shows what the candidate actually took from it, concretely."],
  delivery: [15, "Sounds spoken, not recited. Right length."],
};

export const BEHAVIOURAL_EXPANSION_RUBRIC: Rubric = {
  situation: [20, "Sets the context concretely — where, when, what was at stake — without a long preamble."],
  action: [35, "Says what THEY did, in the first person singular, with the reasoning behind each choice."],
  result: [25, "Gives an outcome with a number or an observable consequence, not 'it went well'."],
  reflection: [20, "Says what they would do differently and what the experience changed about how they work."],
};

export const RCA_RUBRIC: Rubric = {
  isolation: [30, "Narrows the problem down the funnel or the segment tree before theorising about causes."],
  hypotheses: [25, "Generates causes that are mutually exclusive and could each be tested with available data."],
  evidence: [25, "Uses the figures given to rule causes in or out rather than asserting one."],
  action: [20, "Ends with what to do next and what would confirm the diagnosis."],
};

export const STOCK_PITCH_RUBRIC: Rubric = {
  thesis: [30, "A clear, falsifiable call in the opening, not a survey of considerations."],
  evidence: [30, "Uses the figures given and computes what they imply rather than restating them."],
  risks: [25, "Names what would make the call wrong and how it would be spotted early."],
  structure: [15, "Reads like a note a PM would act on: conclusion first, support after."],
};

export const BRAND_TEARDOWN_RUBRIC: Rubric = {
  diagnosis: [30, "Identifies what the brand actually stands for today, from evidence rather than from the brand's own claims."],
  gap: [25, "Names the gap between the promise and the experience, or between the target and the actual buyer."],
  recommendation: [30, "Proposes specific changes with reasons, and says what should stay untouched."],
  feasibility: [15, "Checks the recommendation against cost, channel and the existing customer base."],
};

export const MEMO_RUBRIC: Rubric = {
  recommendation: [30, "Opens with the decision being asked for, stated in one sentence."],
  reasoning: [30, "Three or four reasons that stand on the evidence given, in descending order of weight."],
  objections: [20, "Anticipates the reader's strongest objection and answers it in the memo."],
  brevity: [20, "Fits the length, has no throat-clearing, and could be acted on without a meeting."],
};

export const PRODUCT_SENSE_RUBRIC: Rubric = {
  user: [25, "Chooses a specific user segment and a specific problem before proposing anything, and says why that segment."],
  insight: [25, "Identifies a real need or pain point with a reason it is unmet today, not a generic 'users want convenience'."],
  solution: [25, "Proposes a concrete solution tied to the need, and prioritises within it rather than listing features."],
  tradeoffs_metrics: [25, "Names what the solution costs or risks and how success would be measured."],
};

export const METRICS_RUBRIC: Rubric = {
  north_star: [30, "Picks one primary metric that captures value delivered to users, and explains why it beats the obvious alternatives."],
  tree: [30, "Breaks it into input metrics a team can actually move, in a coherent hierarchy."],
  guardrails: [20, "Names the counter-metrics that would expose gaming or harm, and why each matters here."],
  judgement: [20, "Says what they would do if the numbers disagreed, and avoids vanity metrics."],
};

export const PRIORITISATION_RUBRIC: Rubric = {
  criteria: [25, "Sets explicit criteria tied to the stated goal before ranking anything."],
  evaluation: [30, "Applies the criteria to each option honestly, using the figures given, including effort and risk."],
  decision: [25, "Commits to an order and says clearly what is not being done and why."],
  communication: [20, "Explains how the decision would be defended to the stakeholders who lose out."],
};

export const RESEARCH_NOTE_RUBRIC: Rubric = {
  call: [25, "States rating, target value and the core thesis in the opening lines."],
  valuation: [30, "Derives the target from the figures given with a clear method, and shows the arithmetic."],
  drivers: [25, "Identifies the two or three variables the thesis actually depends on, with evidence."],
  risks: [20, "Names what would break the call and the signal that would show it early."],
};

export const GTM_RUBRIC: Rubric = {
  segment: [25, "Chooses a beachhead customer segment and justifies it over the alternatives."],
  proposition: [20, "States the value proposition and pricing in terms that segment cares about."],
  channels: [30, "Picks channels and a sequence that fit the segment and the budget, with rough economics."],
  milestones: [25, "Sets measurable milestones and says what result would change the plan."],
};

export const MARKETING_MIX_RUBRIC: Rubric = {
  diagnosis: [25, "Works out from the figures which part of the mix is actually causing the problem."],
  consistency: [25, "Keeps product, price, place and promotion consistent with each other and with the target customer."],
  recommendation: [30, "Makes specific changes with reasons, rather than touching every lever."],
  economics: [20, "Checks the recommendation against margin or unit economics."],
};

export const CAMPAIGN_CRITIQUE_ROLES_RUBRIC: Rubric = {
  objective: [20, "States what the campaign was actually trying to achieve and for whom."],
  evidence: [30, "Reads the results correctly — separates reach from response from business outcome, and spots misleading numbers."],
  critique: [30, "Explains why it worked or failed with reasons tied to audience, message or channel, not taste."],
  next_steps: [20, "Proposes what to test or change next, with a measure of success."],
};

export const CAMPAIGN_CRITIQUE_RUBRIC: Rubric = {
  objective: [25, "Establishes what the campaign was trying to achieve before judging whether it worked."],
  evidence: [30, "Reads the numbers given and says what they do and do not show."],
  critique: [25, "Separates the idea from the execution and from the media choice."],
  alternative: [20, "Proposes what should have been done instead, at the same budget."],
};
