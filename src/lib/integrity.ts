/**
 * How a submission is judged for academic integrity.
 *
 * Deliberately pure and free of `server-only`: the same function scores a
 * submission on the server and previews the verdict to the student in the
 * editor, and it is the piece most worth unit-testing, because it is the piece
 * that takes marks away from people.
 *
 * ---------------------------------------------------------------------------
 * What the browser can and cannot do
 * ---------------------------------------------------------------------------
 * It cannot stop a tab switch, and it cannot see what is in the other tab.
 * Every "lockdown browser" that runs inside a normal tab is really doing what
 * this does — noticing that focus left and making that costly. Said plainly
 * here so nobody later reads `blurCount` as proof of anything more than the
 * page losing focus.
 *
 * ---------------------------------------------------------------------------
 * Two families of evidence, weighted very differently
 * ---------------------------------------------------------------------------
 * BEHAVIOURAL signals are facts about how the text arrived: it was pasted, or
 * it was never typed. They are collected in the browser and so are forgeable
 * by anyone who opens devtools — but they are not *guesses*. When they fire,
 * something specific and describable happened.
 *
 * AI-LIKENESS is the grader's opinion of the prose. It is a guess, and it is a
 * guess with a known bias: careful, formal English written by a second-language
 * speaker reads as machine-written to every detector on the market, and this
 * product's students are overwhelmingly Indian MBA candidates writing exactly
 * that register. Penalising them for writing well would be a worse failure
 * than missing a cheat.
 *
 * So the rule enforced in `assessIntegrity` is: AI-likeness never deducts a
 * mark on its own. It only counts once a behavioural signal has independently
 * established that the answer was not composed in the box. On its own it can
 * raise a flag for a teacher to look at, and nothing more.
 */

/** Raw telemetry from the editor. Untrusted — it crosses the network. */
export interface ProctorSignals {
  /** Printable keypresses into the answer fields. */
  keystrokes: number;
  pasteCount: number;
  pastedChars: number;
  /** Largest single paste, which separates a quoted figure from a whole answer. */
  largestPaste: number;
  /** Times the page lost focus or was hidden. */
  blurCount: number;
  /** Total milliseconds spent away. */
  blurMs: number;
  /** Exits from fullscreen during the attempt. */
  fullscreenExits: number;
  /**
   * Whether exam mode was running. True for every attempt made through the
   * current editor, which does not offer a way to decline it; false only for a
   * client old enough to predate the gate, or a forged payload.
   */
  proctored: boolean;
}

export const EMPTY_SIGNALS: ProctorSignals = {
  keystrokes: 0,
  pasteCount: 0,
  pastedChars: 0,
  largestPaste: 0,
  blurCount: 0,
  blurMs: 0,
  fullscreenExits: 0,
  proctored: false,
};

export type IntegritySeverity = "clean" | "suspect" | "severe";

export interface IntegrityFlag {
  code: string;
  /** Shown to the student and to the teacher. Must describe the observation, never accuse. */
  label: string;
  points: number;
  /** True when this is an observed fact rather than an inference about style. */
  behavioural: boolean;
}

export interface IntegrityVerdict {
  score: number;
  penaltyPct: number;
  severity: IntegritySeverity;
  flags: IntegrityFlag[];
}

export interface AssessInput {
  signals: ProctorSignals;
  answerChars: number;
  /**
   * Server-stamped seconds between opening the case and submitting. Null when
   * the attempt was never stamped — an old draft, a restored tab — in which
   * case the speed check is skipped rather than assumed to pass.
   */
  elapsedSeconds: number | null;
  /** The grader's 0-100 read of the prose, or null when it did not return one. */
  aiLikelihood: number | null;
}

/**
 * Penalty ladder. Two bands rather than a smooth curve, because a student has
 * to be able to understand what happened without reading a formula.
 */
const SUSPECT_BELOW = 70;
const SEVERE_BELOW = 45;
const SUSPECT_PENALTY_PCT = 15;
const SEVERE_PENALTY_PCT = 40;

/** Strikes before the account is closed. Three, with a warning at each of the first two. */
export const STRIKES_BEFORE_BLOCK = 3;

/**
 * Typed characters per final character. Normal writing lands above 1.0 —
 * backspaces and rewrites mean most people type more than they keep. Well
 * under 1.0 means most of the text was not typed at all.
 */
function typingRatio(signals: ProctorSignals, answerChars: number): number {
  if (answerChars <= 0) return 1;
  return signals.keystrokes / answerChars;
}

export function assessIntegrity({
  signals,
  answerChars,
  elapsedSeconds,
  aiLikelihood,
}: AssessInput): IntegrityVerdict {
  const flags: IntegrityFlag[] = [];
  const add = (
    code: string,
    label: string,
    points: number,
    behavioural = true,
  ) => flags.push({ code, label, points, behavioural });

  // ---- paste ---------------------------------------------------------------
  // Ratios, not raw counts: pasting a 40-character figure out of the case data
  // is ordinary work, pasting the whole answer is the thing being detected.
  const pasteRatio = answerChars > 0 ? signals.pastedChars / answerChars : 0;

  if (pasteRatio >= 0.6) {
    add("pasted_answer", "Most of this answer was pasted, not typed.", 45);
  } else if (pasteRatio >= 0.25) {
    add("pasted_section", "A large part of this answer was pasted.", 20);
  }

  if (signals.largestPaste >= 400 && pasteRatio < 0.6) {
    add("bulk_paste", "A long block of text arrived in a single paste.", 20);
  }

  // ---- typing --------------------------------------------------------------
  const ratio = typingRatio(signals, answerChars);

  // Only meaningful once there is enough text to measure. Below this a student
  // who wrote three sentences and fixed a typo would look like an outlier.
  if (answerChars >= 400) {
    if (ratio < 0.15) {
      add("not_typed", "Almost none of this answer was typed in the editor.", 40);
    } else if (ratio < 0.5) {
      add("little_typing", "Much less was typed than the answer contains.", 15);
    }
  }

  // ---- speed ---------------------------------------------------------------
  // Server-stamped only. 15 characters per second sustained across the whole
  // attempt is roughly 180 words per minute with no pauses — beyond a fast
  // typist working from their own head, and trivially reached by a paste.
  //
  // Skipped when the keystrokes account for the text regardless. The window
  // this is measured over starts when the editor mounts, and there are honest
  // ways to submit a long answer inside a short window — most obviously fixing
  // a typo and resubmitting straight after a graded attempt, which clears the
  // previous stamp and starts a fresh one. If the characters were typed, how
  // long the window happened to be says nothing, and an end-to-end run showed
  // this flag alone taking an honest submission to exactly the penalty
  // threshold.
  const typedItAnyway = ratio >= 0.8;

  if (
    !typedItAnyway &&
    elapsedSeconds !== null &&
    elapsedSeconds > 0 &&
    answerChars >= 400
  ) {
    if (answerChars / elapsedSeconds > 15) {
      add("impossible_speed", "The answer appeared faster than it could be written.", 30);
    }
  }

  // ---- attention -----------------------------------------------------------
  // Weighted lightly on purpose. A notification, a phone call or a second
  // monitor all produce a blur, and the honest student who checked the time is
  // far more common than the one who went to fetch an answer.
  if (signals.blurCount >= 8) {
    add("frequent_tab_away", `Left the page ${signals.blurCount} times while solving.`, 20);
  } else if (signals.blurCount >= 3) {
    add("tab_away", `Left the page ${signals.blurCount} times while solving.`, 8);
  }

  if (signals.blurMs >= 180_000) {
    add("long_absence", "Spent several minutes away from the page mid-answer.", 10);
  }

  /**
   * Leaving fullscreen.
   *
   * Weighted higher than a plain tab-away, and scaled, because exam mode is
   * now mandatory rather than chosen: the student was told the page stays
   * fullscreen, and the only way out is pressing Esc. One exit is still
   * cheap — Esc gets hit by accident, and some browsers drop fullscreen on
   * their own when a system dialog appears. A pattern of them is not an
   * accident.
   *
   * Still not enough on its own to reach a strike at any count, which is the
   * point of the behavioural floor further down: a student whose browser keeps
   * dropping fullscreen should lose marks for it at worst, not an account.
   */
  if (signals.proctored && signals.fullscreenExits > 0) {
    add(
      "left_exam_mode",
      `Left fullscreen ${signals.fullscreenExits} time(s) during the attempt.`,
      signals.fullscreenExits >= 3 ? 30 : 12,
    );
  }

  // ---- the model's read of the prose ---------------------------------------
  // Scored last, and gated. `behavioural: false` marks it as an opinion so the
  // UI can present it as one.
  const corroborated = flags.some((f) => f.behavioural && f.points >= 20);

  if (aiLikelihood !== null && aiLikelihood >= 60) {
    const strong = aiLikelihood >= 85;
    add(
      "ai_style",
      strong
        ? "The writing closely matches AI-generated text."
        : "The writing partly resembles AI-generated text.",
      // The deduction only lands when something observable already showed the
      // answer was not composed here. Otherwise it is recorded at zero cost:
      // visible to a teacher, invisible in the mark.
      corroborated ? (strong ? 25 : 10) : 0,
      false,
    );
  }

  const deducted = flags.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, 100 - deducted));

  /**
   * The severity floor.
   *
   * A `severe` finding both costs 40% of the mark and counts as a strike
   * towards closing the account, so it must never rest on an inference. If
   * every deduction came from the style guess — which can only happen when it
   * was corroborated, but the corroborating flags were light — the verdict is
   * capped at `suspect`.
   */
  const behaviouralPoints = flags
    .filter((f) => f.behavioural)
    .reduce((sum, f) => sum + f.points, 0);

  let severity: IntegritySeverity;
  if (score >= SUSPECT_BELOW) {
    severity = "clean";
  } else if (score >= SEVERE_BELOW || behaviouralPoints < 40) {
    severity = "suspect";
  } else {
    severity = "severe";
  }

  const penaltyPct =
    severity === "severe"
      ? SEVERE_PENALTY_PCT
      : severity === "suspect"
        ? SUSPECT_PENALTY_PCT
        : 0;

  return { score, penaltyPct, severity, flags };
}

/** What the student is told after a flagged submission, given their strike count. */
export function strikeWarning(strikes: number): string | null {
  if (strikes <= 0) return null;
  const left = STRIKES_BEFORE_BLOCK - strikes;
  if (left <= 0) {
    return "Your account has been suspended for repeated integrity violations. Contact your placement cell or CaseCode support to appeal.";
  }
  if (left === 1) {
    return "Final warning. This is your second flagged submission. One more will suspend your account.";
  }
  return `This submission was flagged and your mark was reduced. ${left} more flagged submissions will suspend your account.`;
}
