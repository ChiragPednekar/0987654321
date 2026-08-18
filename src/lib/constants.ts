import type { Difficulty, Domain } from "@/lib/types/database";

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
