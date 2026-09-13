/**
 * Shared vocabulary for personal interviews.
 *
 * Free of `server-only` because the round picker runs in the browser while the
 * prompt and the assessment must not. Keeping the constants here rather than
 * in src/lib/ai/pi-interview.ts is what stops the interviewer's system prompt
 * being pulled into a client bundle by an innocent-looking import of a label.
 */
import type { PiKind } from "@/lib/types/database";

export const PI_CRITERIA = {
  specificity: 30,
  self_awareness: 25,
  motivation: 25,
  communication: 20,
} as const;

export const PI_MAX_SCORE = Object.values(PI_CRITERIA).reduce((a, b) => a + b, 0);

/** How many questions before the interviewer closes. Roughly a real PI round. */
export const PI_MAX_QUESTIONS = 9;

export const PI_CRITERION_LABEL: Record<string, string> = {
  specificity: "Specificity",
  self_awareness: "Self-awareness",
  motivation: "Motivation & fit",
  communication: "Communication",
};

export const PI_KINDS: {
  value: PiKind;
  label: string;
  description: string;
  needsFirm?: boolean;
}[] = [
  {
    value: "hr_fit",
    label: "HR & fit",
    description: "Why MBA, strengths and weaknesses, teamwork, conflict, failure.",
  },
  {
    value: "resume_deep_dive",
    label: "Resume deep-dive",
    description: "Every line of your CV, attacked. What did you actually do?",
  },
  {
    value: "why_firm",
    label: "Why this firm",
    description: "Whether you have researched them or just the industry.",
    needsFirm: true,
  },
  {
    value: "stress",
    label: "Stress interview",
    description: "Interruptions, pushback, and being asked the same thing twice.",
  },
];
