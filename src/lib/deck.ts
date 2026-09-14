/**
 * Shared vocabulary for the presentation (deck) critique.
 *
 * Free of `server-only`: the upload form checks size and type in the browser
 * with the same limits the route enforces.
 */
import { stripInventedNumbers } from "@/lib/resume";

export const DECK_LIMITS = {
  /**
   * Under the ~4.5 MB request-body cap serverless functions impose. A deck
   * exported as PDF at "minimum size" is far smaller than this; the limit is
   * explained on the page rather than discovered as a failed upload.
   */
  maxBytes: 4 * 1024 * 1024,
  maxPages: 30,
  maxContextChars: 160,
} as const;

export const DECK_CRITERIA = {
  storyline: "Storyline",
  action_titles: "Action titles",
  one_message: "One message per slide",
  evidence: "Evidence & charts",
  design: "Design & readability",
} as const;
export type DeckCriterion = keyof typeof DECK_CRITERIA;

export const SLIDE_ISSUES = [
  "topic_title",
  "too_dense",
  "no_takeaway",
  "weak_chart",
  "unsourced_data",
  "inconsistent_design",
  "off_story",
] as const;
export type SlideIssue = (typeof SLIDE_ISSUES)[number];

export const SLIDE_ISSUE_LABEL: Record<SlideIssue, string> = {
  topic_title: "Title names a topic, not a takeaway",
  too_dense: "Too much on the slide",
  no_takeaway: "No clear takeaway",
  weak_chart: "Chart does not make the point",
  unsourced_data: "Data without a source",
  inconsistent_design: "Inconsistent design",
  off_story: "Does not advance the story",
};

export interface SlideCritique {
  slide: number;
  title_as_written: string;
  /** What the model says it read on the slide — the only figures a suggested title may use. */
  figures_on_slide: string[];
  suggested_title: string;
  issues: SlideIssue[];
  comment: string;
  /** Numbers removed from the suggested title because they were not on the slide. */
  invented_numbers: string[];
}

export interface DeckCritiqueResult {
  scores: Record<DeckCriterion, number>;
  summary: string;
  top_fixes: string[];
  slides: SlideCritique[];
}

/** A real PDF starts with this signature, whatever the file is named or claims to be. */
export function isPdf(bytes: Uint8Array): boolean {
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  return signature.every((b, i) => bytes[i] === b);
}

/**
 * Page count when the PDF states it plainly, else null.
 *
 * Reads the `/Type /Page` dictionary markers. Many PDFs compress those into
 * object streams, in which case this finds none and returns null — so it is
 * only ever used to refuse an obviously oversized deck before paying for a
 * model call, never to accept or describe one.
 */
export function countPagesIfVisible(bytes: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(bytes);
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches && matches.length > 0 ? matches.length : null;
}

/**
 * A suggested title may use only figures the model read on that slide or in
 * the original title. Anything else becomes [X] — the same guarantee as resume
 * rewrites, so a "better" title never states a number the deck does not.
 */
export function groundSuggestedTitle(
  suggested: string,
  titleAsWritten: string,
  figuresOnSlide: string[],
): { title: string; invented: string[] } {
  const { rewrite, invented } = stripInventedNumbers(
    [titleAsWritten, ...figuresOnSlide].join(" "),
    suggested,
  );
  return { title: rewrite, invented };
}
