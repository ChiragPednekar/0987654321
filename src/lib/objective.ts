/**
 * Shared vocabulary for objective practice.
 *
 * Free of `server-only` so the track list can drive both the picker in the
 * browser and the Zod schema on the route, which is the only way those two
 * stay in step.
 */
import type { ObjectiveTrack } from "@/lib/types/database";

/** Tuple rather than array so z.enum() accepts it. */
export const OBJECTIVE_TRACK_VALUES = [
  "quant",
  "data_interpretation",
  "logical_reasoning",
  "verbal",
  "finance_concepts",
  "accounting",
  "marketing_concepts",
  "operations_concepts",
  "current_affairs",
] as const;

export const OBJECTIVE_SET_SIZE = { default: 10, max: 30 } as const;

export interface ObjectiveTrackMeta {
  value: ObjectiveTrack;
  label: string;
  short: string;
  group: "Aptitude" | "Domain";
  description: string;
}

/**
 * Grouped because the two halves are used at different moments. Aptitude is
 * the elimination round almost every recruiter runs first; the domain tracks
 * are what gets asked once a student is already in an interview for a specific
 * role.
 */
export const OBJECTIVE_TRACKS: ObjectiveTrackMeta[] = [
  {
    value: "quant",
    label: "Quantitative Aptitude",
    short: "Quant",
    group: "Aptitude",
    description: "Percentages, ratio, profit and loss, speed, interest.",
  },
  {
    value: "data_interpretation",
    label: "Data Interpretation",
    short: "DI",
    group: "Aptitude",
    description: "Read a table or chart and compute the answer.",
  },
  {
    value: "logical_reasoning",
    label: "Logical Reasoning",
    short: "LR",
    group: "Aptitude",
    description: "Arrangements, syllogisms, assumptions, sufficiency.",
  },
  {
    value: "verbal",
    label: "Verbal Ability",
    short: "Verbal",
    group: "Aptitude",
    description: "Comprehension, usage, summary, para-completion.",
  },
  {
    value: "finance_concepts",
    label: "Finance Concepts",
    short: "Finance",
    group: "Domain",
    description: "Valuation, capital structure, statement linkages.",
  },
  {
    value: "accounting",
    label: "Accounting",
    short: "Accounts",
    group: "Domain",
    description: "Statements, ratios, revenue recognition.",
  },
  {
    value: "marketing_concepts",
    label: "Marketing Concepts",
    short: "Marketing",
    group: "Domain",
    description: "Unit economics, pricing, segmentation, channels.",
  },
  {
    value: "operations_concepts",
    label: "Operations & Supply Chain",
    short: "Ops",
    group: "Domain",
    description: "Inventory, lead time, capacity, quality, cost-to-serve.",
  },
  {
    value: "current_affairs",
    label: "Business Current Affairs",
    short: "Current",
    group: "Domain",
    description: "Indian economy, regulation, capital markets.",
  },
];

export const OBJECTIVE_TRACK_LABEL = Object.fromEntries(
  OBJECTIVE_TRACKS.map((t) => [t.value, t.label]),
) as Record<ObjectiveTrack, string>;

/** One question as the student is allowed to see it — no key, no explanation. */
export interface ObjectiveQuestionForStudent {
  id: string;
  track: ObjectiveTrack;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  context: string | null;
  stem: string;
  options: string[];
}

/** What comes back after marking: the key, revealed only now. */
export interface ObjectiveResultRow {
  id: string;
  stem: string;
  options: string[];
  chosen: number | null;
  correct_index: number;
  explanation: string;
  topic: string;
}
