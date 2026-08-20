import type { CaseFormat, Difficulty, Domain } from "@/lib/types/database";

export const DOMAINS: {
  value: Domain;
  label: string;
  short: string;
  color: string;
  description: string;
}[] = [
  {
    value: "finance",
    label: "Finance",
    short: "Fin",
    color: "text-emerald-500",
    description: "Valuation, capital structure, deal maths.",
  },
  {
    value: "consulting",
    label: "Consulting",
    short: "Con",
    color: "text-sky-500",
    description: "Profitability, market entry, operations.",
  },
  {
    value: "product_management",
    label: "Product Management",
    short: "PM",
    color: "text-violet-500",
    description: "Metrics, prioritisation, launches, retention.",
  },
  {
    value: "marketing",
    label: "Marketing",
    short: "Mkt",
    color: "text-amber-500",
    description: "Positioning, channels, CAC and LTV.",
  },
  {
    value: "strategy",
    label: "Strategy",
    short: "Str",
    color: "text-rose-500",
    description: "Moats, portfolios, transformation.",
  },
];

export const DOMAIN_LABEL: Record<Domain, string> = Object.fromEntries(
  DOMAINS.map((d) => [d.value, d.label]),
) as Record<Domain, string>;

export const DIFFICULTIES: {
  value: Difficulty;
  label: string;
  className: string;
}[] = [
  {
    value: "easy",
    label: "Easy",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "medium",
    label: "Medium",
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "hard",
    label: "Hard",
    className: "text-rose-600 dark:text-rose-400",
  },
];

export const DIFFICULTY_CLASS: Record<Difficulty, string> = Object.fromEntries(
  DIFFICULTIES.map((d) => [d.value, d.className]),
) as Record<Difficulty, string>;

export const COMPANY_TRACKS = [
  "McKinsey",
  "BCG",
  "Bain",
  "Goldman Sachs",
  "Morgan Stanley",
  "Blackstone",
  "Google",
  "Amazon",
  "Meta",
  "Stripe",
  "Flipkart",
  "Zomato",
  "Razorpay",
] as const;

/** Answers longer than this are rejected before they reach the model. */
export const MAX_ANSWER_CHARS = 20_000;
/** Below this we refuse to spend a model call. */
export const MIN_ANSWER_CHARS = 200;

export const CASES_PER_PAGE = 20;
export const LEADERBOARD_PAGE_SIZE = 50;

/** Per-user evaluation throttle. */
export const RATE_LIMIT = { windowMs: 60_000, maxEvaluations: 5 } as const;

/**
 * The structured answer format.
 *
 * A single textarea invites a wall of prose; naming the parts pushes students
 * into the shape a rubric actually rewards, and gives the grader clean
 * boundaries instead of having to infer them. Keys match the
 * `answer_sections` jsonb column and the AnswerSections type.
 */
export const ANSWER_SECTIONS = [
  {
    key: "framework",
    label: "Framework",
    hint: "How you are breaking the problem down before touching numbers.",
    placeholder:
      "The two things that decide this: unit economics and runway.\n" +
      "I'll size each, then stress the assumption that matters most.",
    minChars: 60,
  },
  {
    key: "analysis",
    label: "Analysis",
    hint: "The working. Compute the numbers rather than describing them.",
    placeholder:
      "Runway = cash ÷ monthly burn = ₹14 Cr ÷ ₹1.0 Cr = 14 months.\n" +
      "Net new ARR = ₹72 Cr × 56% = ₹40 Cr, so burn multiple = 12 ÷ 40 = 0.3.",
    minChars: 120,
  },
  {
    key: "recommendation",
    label: "Recommendation",
    hint: "Commit to a course of action, and say what would change your mind.",
    placeholder:
      "Raise, but take ₹80-90 Cr rather than ₹116 Cr, and fund one market not two.\n" +
      "I'd reverse this if NRR fell below 110% for two consecutive quarters.",
    minChars: 60,
  },
] as const;

export type AnswerSectionKey = (typeof ANSWER_SECTIONS)[number]["key"];

/** Case formats (spec §6). Only full_case is seeded today. */
export const CASE_FORMATS: { value: CaseFormat; label: string; hint: string }[] = [
  { value: "framework", label: "Framework", hint: "Structure only — build the issue tree" },
  { value: "full_case", label: "Full Case", hint: "Clarify, structure, analyse, recommend" },
  { value: "model", label: "Model", hint: "Spreadsheet build, graded on the numbers" },
  { value: "drill", label: "Drill", hint: "Timed sprint — sizing and mental math" },
  { value: "debug", label: "Debug", hint: "Find and fix the flaw" },
];

export const CASE_FORMAT_LABEL: Record<CaseFormat, string> = Object.fromEntries(
  CASE_FORMATS.map((f) => [f.value, f.label]),
) as Record<CaseFormat, string>;

/**
 * Firm styles. These describe the *kind of question* a firm is known for and
 * imply no affiliation or endorsement — see the Terms.
 */
export const FIRM_STYLES = [
  "MBB-style",
  "Investment Banking-style",
  "Big Tech PM-style",
  "Startup-style",
] as const;
