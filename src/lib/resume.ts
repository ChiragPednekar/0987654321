import { normaliseNumber, numbersIn } from "@/lib/numbers";

export { numbersIn };

/**
 * Shared vocabulary for the resume bullet critique.
 *
 * Free of `server-only`: the parser and the limits drive the editor in the
 * browser as well as the route's validation, which is the only way the two
 * agree about what "too many bullets" means.
 */

export const RESUME_LIMITS = {
  maxBullets: 12,
  maxBulletChars: 400,
  maxRoleChars: 120,
} as const;

export const RESUME_VERDICTS = ["strong", "needs_work", "weak"] as const;
export type ResumeVerdict = (typeof RESUME_VERDICTS)[number];

export const RESUME_ISSUES = [
  "weak_verb",
  "no_number",
  "unclear_ownership",
  "vague",
  "too_long",
  "jargon",
  "off_target",
] as const;
export type ResumeIssue = (typeof RESUME_ISSUES)[number];

export const RESUME_ISSUE_LABEL: Record<ResumeIssue, string> = {
  weak_verb: "Weak opening verb",
  no_number: "No measurable result",
  unclear_ownership: "Unclear what you did",
  vague: "Vague",
  too_long: "Too long",
  jargon: "Internal jargon",
  off_target: "Not relevant to the role",
};

export const RESUME_VERDICT_LABEL: Record<ResumeVerdict, string> = {
  strong: "Strong",
  needs_work: "Needs work",
  weak: "Weak",
};

/** The token a rewrite uses where a real number belongs and we do not know it. */
export const NUMBER_PLACEHOLDER = "[X]";

export interface BulletCritique {
  original: string;
  verdict: ResumeVerdict;
  issues: ResumeIssue[];
  /** One or two sentences, specific to this bullet. */
  feedback: string;
  rewrite: string;
  /** Numbers the model put in the rewrite that the student never wrote. Replaced by [X]. */
  invented_numbers: string[];
}

export interface ResumeCritiqueResult {
  summary: string;
  top_fixes: string[];
  bullets: BulletCritique[];
}

/**
 * One bullet per line, with the markers people paste in from Word or a PDF
 * stripped off. Blank lines are dropped rather than sent as empty bullets.
 */
export function parseBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        // A numbered marker needs a space after it, or "4.5x growth" loses its 4.
        .replace(/^\s*(?:[-*•●▪◦‣–—]\s*|\d{1,2}[.)]\s+)/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line.length > 0);
}

/**
 * Removes any number from a rewrite that the student did not write.
 *
 * This is the property the whole feature rests on. A model asked to "add
 * impact" will cheerfully turn "improved onboarding" into "cut onboarding time
 * by 40%", and a student who pastes that into a CV is now claiming a result
 * they never measured — which an interviewer will ask about. So the rewrite may
 * only reuse the original's own numbers; anything else becomes [X], a visible
 * gap the student fills in with the truth or deletes.
 *
 * Enforced here rather than trusted to the prompt, because a prompt is a
 * request and this is a guarantee.
 */
export function stripInventedNumbers(
  original: string,
  rewrite: string,
): { rewrite: string; invented: string[] } {
  const allowed = new Set(numbersIn(original));
  const invented: string[] = [];

  const cleaned = rewrite.replace(/\d[\d,]*(?:\.\d+)?/g, (match) => {
    const normalised = normaliseNumber(match);
    if (allowed.has(normalised)) return match;
    invented.push(match);
    return NUMBER_PLACEHOLDER;
  });

  return { rewrite: cleaned, invented };
}
