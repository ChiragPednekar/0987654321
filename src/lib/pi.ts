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
  {
    value: "behavioural",
    label: "Behavioural (STAR)",
    description: "Leadership, influence and ownership — one story, dug into until it holds or breaks.",
  },
  {
    value: "career_goals",
    label: "Career goals",
    description: "Short and long term plans, why this role, and why now — tested for whether they hang together.",
  },
  {
    value: "academics",
    label: "Academics & domain",
    description: "Your graduation subjects and specialisation, asked as a professor would.",
  },
  {
    value: "current_affairs",
    label: "Current affairs & opinion",
    description: "Business and economic news, and an opinion you have to defend.",
  },
  {
    value: "situational",
    label: "Situational judgement",
    description: "Workplace dilemmas: ethics, a difficult manager, two deadlines and one evening.",
  },
  {
    value: "red_flags",
    label: "Gaps & red flags",
    description: "Low grades, a career gap, a short stint or a switch — explained without excuses.",
  },
  {
    value: "interests",
    label: "Hobbies & interests",
    description: "Whatever is in your interests section, probed until it is clear whether it is real.",
  },
  {
    value: "partner",
    label: "Partner / final round",
    description: "A senior interviewer, a broad conversation, curveballs and a judgement on maturity.",
    needsFirm: true,
  },
];

/** Every round's value, for request validation. */
export const PI_KIND_VALUES = PI_KINDS.map((k) => k.value) as [PiKind, ...PiKind[]];
