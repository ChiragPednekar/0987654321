/**
 * Turning a model's draft questions into questions a student can be marked on.
 *
 * Pure, and deliberately suspicious. The model is asked to write each question
 * from one press release and to quote the sentence that proves the answer. It
 * is not trusted to have done either, so every draft is checked here:
 *
 *   - the quoted evidence must actually appear in that release;
 *   - every number in the correct answer must appear in that quote;
 *   - there are exactly four distinct options and the answer is one of them.
 *
 * A draft that fails any of these is dropped, not repaired. A quiz of three
 * questions that are true beats a quiz of five where one is invented — a wrong
 * current-affairs "fact" is worse than no question at all.
 */
import { quantitiesIn } from "@/lib/numbers";

export const QUIZ_SIZE = { target: 5, minimum: 3, perItem: 2 } as const;

export interface DraftQuestion {
  /** 1-based index into the items the model was shown. */
  item: number;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  evidence: string;
}

export interface CheckedQuestion {
  itemIndex: number;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  evidence: string;
}

export interface Rejection {
  stem: string;
  reason: string;
}

/** Lowercase, straight quotes, single spaces: "the same sentence" as a reader would judge it. */
export function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/&#8377;|₹|rs\.?\s?|inr\s?/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

export function evidenceAppears(evidence: string, body: string): boolean {
  const quote = normaliseForMatch(evidence).replace(/^["'.…\s]+|["'.…\s]+$/g, "");
  // A short quote ("the RBI") proves nothing about the answer.
  if (quote.length < 25) return false;
  return normaliseForMatch(body).includes(quote);
}

/**
 * Rotates options by a hash of the stem so the answer is not always first.
 *
 * The same scheme as scripts/seed-objective.ts, for the same reason: a random
 * shuffle is not reproducible, and a draft authored answer-first would put
 * every answer at A.
 */
export function placeAnswer(options: string[], answer: string, stem: string): { options: string[]; correctIndex: number } {
  let hash = 0;
  for (let i = 0; i < stem.length; i++) hash = (hash * 31 + stem.charCodeAt(i)) >>> 0;
  const shift = hash % options.length;
  const rotated = options.map((_, i) => options[(i + shift) % options.length]);
  return { options: rotated, correctIndex: rotated.indexOf(answer) };
}

export function checkDrafts(
  drafts: DraftQuestion[],
  bodies: string[],
): { accepted: CheckedQuestion[]; rejected: Rejection[] } {
  const accepted: CheckedQuestion[] = [];
  const rejected: Rejection[] = [];
  const perItem = new Map<number, number>();
  const seenStems = new Set<string>();

  for (const draft of drafts) {
    const stem = draft.stem.trim();
    const reject = (reason: string) => rejected.push({ stem, reason });

    const body = bodies[draft.item - 1];
    if (body === undefined) {
      reject(`refers to item ${draft.item}, which was not provided`);
      continue;
    }

    const options = draft.options.map((o) => o.trim());
    const answer = draft.answer.trim();

    if (stem.length < 20) {
      reject("stem too short to be a question");
      continue;
    }
    if (seenStems.has(normaliseForMatch(stem))) {
      reject("duplicate stem");
      continue;
    }
    if (options.length !== 4) {
      reject(`has ${options.length} options, not 4`);
      continue;
    }
    if (options.some((o) => !o)) {
      reject("has an empty option");
      continue;
    }
    if (new Set(options.map(normaliseForMatch)).size !== 4) {
      reject("has duplicate options");
      continue;
    }
    const answerAt = options.findIndex((o) => normaliseForMatch(o) === normaliseForMatch(answer));
    if (answerAt === -1) {
      reject("answer is not one of the options");
      continue;
    }
    if (!evidenceAppears(draft.evidence, body)) {
      reject("evidence is not a quote from the release");
      continue;
    }
    // Against the quote, not merely the release: a real sentence saying "three
    // tranches" must not stand behind an answer of "Four", and a figure that
    // appears somewhere else in a long release proves nothing about this one.
    const inEvidence = new Set(quantitiesIn(draft.evidence));
    const unsupported = quantitiesIn(options[answerAt]).filter((n) => !inEvidence.has(n));
    if (unsupported.length > 0) {
      reject(`answer contains ${unsupported.join(", ")}, which its quoted evidence does not`);
      continue;
    }
    // A short answer — a body, a system, a date — is a name, and a name the
    // quote does not contain is not proved by it ("SEBI" behind a sentence
    // about the Supreme Court). Longer answers are descriptions and may
    // legitimately paraphrase, so they rely on the checks above.
    const bare = normaliseForMatch(options[answerAt]).replace(/^(the|a|an) /, "");
    if (bare.split(" ").length <= 4 && !normaliseForMatch(draft.evidence).includes(bare)) {
      reject("short answer does not appear in its quoted evidence");
      continue;
    }
    const used = perItem.get(draft.item) ?? 0;
    if (used >= QUIZ_SIZE.perItem) {
      reject("too many questions from one release");
      continue;
    }

    perItem.set(draft.item, used + 1);
    seenStems.add(normaliseForMatch(stem));
    const placed = placeAnswer(options, options[answerAt], stem);
    accepted.push({
      itemIndex: draft.item - 1,
      stem,
      options: placed.options,
      correctIndex: placed.correctIndex,
      explanation: draft.explanation.trim(),
      evidence: draft.evidence.trim(),
    });
    if (accepted.length >= QUIZ_SIZE.target) break;
  }

  return { accepted, rejected };
}

/** The calendar date in India, as YYYY-MM-DD. A quiz belongs to an Indian day, not a UTC one. */
export function istDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive quiz days answered on the day itself, ending today or yesterday.
 *
 * A streak survives until the end of the day it would break on — answering
 * yesterday and not yet today still counts, or every streak would read zero
 * each morning until the student got round to it.
 *
 * Only days that had a quiz can break a streak. A day the RBI published nothing
 * worth a question has no quiz, and nobody should lose a streak to that.
 */
export function currentStreak(answeredOnDay: string[], quizDays: string[], today: string): number {
  const answered = new Set(answeredOnDay);
  const days = [...new Set(quizDays)].filter((d) => d <= today).sort().reverse();

  let streak = 0;
  for (const [i, day] of days.entries()) {
    if (answered.has(day)) {
      streak++;
      continue;
    }
    // Today's quiz, not yet taken, does not break anything.
    if (i === 0 && day === today) continue;
    break;
  }
  return streak;
}

/** Correct answers over the questions still standing. A pulled question counts for nobody. */
export function scoreAttempt(
  answers: number[],
  questions: { position: number; correct_index: number; is_pulled: boolean }[],
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const q of questions) {
    if (q.is_pulled) continue;
    total++;
    if (answers[q.position] === q.correct_index) correct++;
  }
  return { correct, total };
}
