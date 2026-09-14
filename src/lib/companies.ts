/**
 * Shared vocabulary for company prep.
 *
 * Free of `server-only`: the report form in the browser and the route's Zod
 * schema read the same round list and limits.
 */

export const COMPANY_SECTORS = [
  "Consulting",
  "FMCG",
  "Banking & finance",
  "Technology",
  "Conglomerate",
] as const;
export type CompanySector = (typeof COMPANY_SECTORS)[number];

export const INTERVIEW_ROUNDS = [
  "online_test",
  "group_discussion",
  "case_interview",
  "technical",
  "personal_interview",
  "hr",
  "other",
] as const;
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export const ROUND_LABEL: Record<InterviewRound, string> = {
  online_test: "Online test",
  group_discussion: "Group discussion",
  case_interview: "Case interview",
  technical: "Technical / domain",
  personal_interview: "Personal interview",
  hr: "HR",
  other: "Other",
};

export const REPORT_LIMITS = {
  minQuestion: 15,
  maxQuestion: 1000,
  maxRole: 80,
  perDay: 5,
  earliestYear: 2018,
} as const;

export interface CompanyRound {
  name: string;
  detail: string;
}

export interface PracticeLink {
  label: string;
  href: string;
  why: string;
}

/**
 * Internal paths a profile may link to. Checked by the seeder so a typo cannot
 * ship a dead link, and so a profile can never link off-site.
 */
export const PRACTICE_PREFIXES = [
  "/cases",
  "/practice",
  "/interview",
  "/resume",
  "/gd",
  "/daily",
  "/sql",
  "/excel",
  "/simulation",
  "/negotiation",
  "/peer",
  "/competitions",
] as const;

export function isPracticeHref(href: string): boolean {
  return PRACTICE_PREFIXES.some((p) => href === p || href.startsWith(`${p}?`) || href.startsWith(`${p}/`));
}

/** The current academic placement year and a few before it, newest first. */
export function reportYears(now: Date = new Date()): number[] {
  const latest = now.getUTCFullYear();
  const years: number[] = [];
  for (let y = latest; y >= REPORT_LIMITS.earliestYear; y--) years.push(y);
  return years;
}
