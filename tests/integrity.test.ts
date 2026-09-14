import { describe, expect, it } from "vitest";
import {
  assessIntegrity,
  EMPTY_SIGNALS,
  strikeWarning,
  STRIKES_BEFORE_BLOCK,
  type ProctorSignals,
} from "@/lib/integrity";

/** A student who typed a 2,000-character answer over twenty minutes. */
function honest(overrides: Partial<ProctorSignals> = {}): ProctorSignals {
  return { ...EMPTY_SIGNALS, keystrokes: 2400, ...overrides };
}

const CLEAN = {
  signals: honest(),
  answerChars: 2000,
  elapsedSeconds: 1200,
  aiLikelihood: null,
};

describe("assessIntegrity", () => {
  it("leaves an ordinary answer alone", () => {
    const v = assessIntegrity(CLEAN);
    expect(v.severity).toBe("clean");
    expect(v.penaltyPct).toBe(0);
    expect(v.flags).toHaveLength(0);
  });

  it("does not punish a short answer for a low typing ratio", () => {
    // Under the 400-character floor the ratio is noise: one paste of a quoted
    // figure into a three-sentence answer would otherwise look conclusive.
    const v = assessIntegrity({
      ...CLEAN,
      signals: honest({ keystrokes: 10 }),
      answerChars: 300,
    });
    expect(v.flags.map((f) => f.code)).not.toContain("not_typed");
  });

  it("catches an answer that was pasted whole", () => {
    const v = assessIntegrity({
      ...CLEAN,
      signals: honest({
        keystrokes: 20,
        pasteCount: 1,
        pastedChars: 2000,
        largestPaste: 2000,
      }),
    });
    expect(v.severity).toBe("severe");
    expect(v.penaltyPct).toBe(40);
    expect(v.flags.map((f) => f.code)).toEqual(
      expect.arrayContaining(["pasted_answer", "not_typed"]),
    );
  });

  it("treats pasting a figure out of the case data as ordinary work", () => {
    const v = assessIntegrity({
      ...CLEAN,
      signals: honest({ pasteCount: 3, pastedChars: 120, largestPaste: 60 }),
    });
    expect(v.severity).toBe("clean");
  });

  it("does not call a typed answer too fast, however short the window", () => {
    // The honest resubmission: a student fixes a typo and submits again
    // minutes after their last attempt, which cleared the previous stamp. The
    // keystrokes account for the text, so the window length proves nothing.
    // Found by an end-to-end run where this flag alone put a clean submission
    // on the penalty threshold.
    const v = assessIntegrity({
      ...CLEAN,
      signals: honest({ keystrokes: 2400 }),
      elapsedSeconds: 16,
    });
    expect(v.flags.map((f) => f.code)).not.toContain("impossible_speed");
    expect(v.severity).toBe("clean");
  });

  it("flags an untyped answer arriving faster than it could be written", () => {
    const v = assessIntegrity({
      ...CLEAN,
      signals: honest({ keystrokes: 30 }), // 2,000 characters in 16 seconds
      elapsedSeconds: 16,
    });
    expect(v.flags.map((f) => f.code)).toContain("impossible_speed");
  });

  it("skips the speed check when the server never stamped a start", () => {
    // Null must mean "unknown", never "instant". Reading it as zero elapsed
    // would fail every restored draft.
    const v = assessIntegrity({ ...CLEAN, elapsedSeconds: null });
    expect(v.flags.map((f) => f.code)).not.toContain("impossible_speed");
  });

  it("treats one dropped fullscreen as cheap and a pattern of them as not", () => {
    // Esc gets pressed by accident, and some browsers drop fullscreen on their
    // own for a system dialog. Doing it repeatedly through a mandatory exam
    // mode is a different thing.
    const once = assessIntegrity({
      ...CLEAN,
      signals: honest({ proctored: true, fullscreenExits: 1 }),
    });
    expect(once.severity).toBe("clean");

    const repeatedly = assessIntegrity({
      ...CLEAN,
      signals: honest({ proctored: true, fullscreenExits: 4 }),
    });
    expect(repeatedly.score).toBeLessThan(once.score);

    // ...but never far enough on its own to put the account at risk.
    expect(repeatedly.severity).not.toBe("severe");
  });

  it("tolerates a handful of tab switches", () => {
    const v = assessIntegrity({ ...CLEAN, signals: honest({ blurCount: 4 }) });
    expect(v.severity).toBe("clean");
  });

  describe("AI-likeness", () => {
    it("never costs a mark on its own, however confident the model is", () => {
      // The false-positive case this whole gate exists for: a second-language
      // student writing careful formal English, typed in full, at a normal
      // pace. The flag is recorded; the mark is untouched.
      const v = assessIntegrity({ ...CLEAN, aiLikelihood: 99 });
      expect(v.penaltyPct).toBe(0);
      expect(v.severity).toBe("clean");
      const flag = v.flags.find((f) => f.code === "ai_style");
      expect(flag).toBeDefined();
      expect(flag?.points).toBe(0);
      expect(flag?.behavioural).toBe(false);
    });

    it("counts once the answer is also shown to have been pasted", () => {
      const pasted = honest({
        keystrokes: 20,
        pasteCount: 1,
        pastedChars: 2000,
        largestPaste: 2000,
      });
      const without = assessIntegrity({ ...CLEAN, signals: pasted });
      const with_ = assessIntegrity({
        ...CLEAN,
        signals: pasted,
        aiLikelihood: 95,
      });
      expect(with_.score).toBeLessThan(without.score);
    });

    it("cannot by itself push a submission over the strike line", () => {
      // The case the cap exists for: enough behavioural evidence to corroborate
      // (so the style guess counts at all) but not enough to justify a strike
      // on its own. The arithmetic would otherwise reach `severe` purely
      // because the model was confident, and a strike is a step towards
      // closing someone's account.
      const signals = honest({
        keystrokes: 800, // ratio 0.40 -> little_typing, 15
        pasteCount: 1,
        pastedChars: 700, // ratio 0.35 -> pasted_section, 20
        largestPaste: 300, // under the bulk-paste floor
      });

      const confident = assessIntegrity({ ...CLEAN, signals, aiLikelihood: 95 });

      // The deduction really did land — this is not passing by the flag being
      // ignored — and the verdict still stops short of a strike.
      expect(confident.flags.find((f) => f.code === "ai_style")?.points).toBe(25);
      expect(confident.score).toBeLessThan(45);
      expect(confident.severity).toBe("suspect");
    });
  });

  it("keeps the score inside 0-100 when everything fires at once", () => {
    const v = assessIntegrity({
      signals: {
        keystrokes: 0,
        pasteCount: 4,
        pastedChars: 4000,
        largestPaste: 4000,
        blurCount: 30,
        blurMs: 900_000,
        fullscreenExits: 5,
        proctored: true,
      },
      answerChars: 4000,
      elapsedSeconds: 10,
      aiLikelihood: 100,
    });
    expect(v.score).toBe(0);
    expect(v.severity).toBe("severe");
  });
});

describe("strikeWarning", () => {
  it("says nothing to a student with a clean record", () => {
    expect(strikeWarning(0)).toBeNull();
  });

  it("escalates, and names suspension only once it has happened", () => {
    expect(strikeWarning(1)).toMatch(/2 more/);
    expect(strikeWarning(2)).toMatch(/Final warning/);
    expect(strikeWarning(STRIKES_BEFORE_BLOCK)).toMatch(/suspended/);
  });
});

/**
 * Multiple choice, SQL and Excel have no prose. Passing answerChars: 0 must
 * therefore disable every check that needs text rather than reading the
 * absence as evidence — a quiz that scored "almost none of this was typed"
 * would flag every honest student on the platform.
 */
describe("an activity with no prose", () => {
  const noProse = { answerChars: 0, elapsedSeconds: 600, aiLikelihood: null };

  it("cannot raise a paste, typing or speed flag", () => {
    const verdict = assessIntegrity({
      ...noProse,
      // Deliberately absurd: a huge paste and no keystrokes, which on a case
      // would be the strongest possible finding.
      signals: {
        ...EMPTY_SIGNALS,
        proctored: true,
        pastedChars: 5000,
        largestPaste: 5000,
        pasteCount: 3,
        keystrokes: 0,
      },
    });
    const codes = verdict.flags.map((f) => f.code);
    expect(codes).not.toContain("pasted_answer");
    expect(codes).not.toContain("pasted_section");
    expect(codes).not.toContain("not_typed");
    expect(codes).not.toContain("little_typing");
    expect(codes).not.toContain("impossible_speed");
  });

  it("still counts leaving the page, which is the whole point on a quiz", () => {
    const verdict = assessIntegrity({
      ...noProse,
      signals: { ...EMPTY_SIGNALS, proctored: true, blurCount: 9 },
    });
    expect(verdict.flags.map((f) => f.code)).toContain("frequent_tab_away");
    expect(verdict.score).toBeLessThan(100);
  });

  it("does not punish an ordinary sitting", () => {
    const verdict = assessIntegrity({
      ...noProse,
      // One glance away, which everyone does.
      signals: { ...EMPTY_SIGNALS, proctored: true, blurCount: 1, blurMs: 4000 },
    });
    expect(verdict.severity).toBe("clean");
    expect(verdict.penaltyPct).toBe(0);
  });

  it("never reaches a strike on a single stray fullscreen exit", () => {
    const verdict = assessIntegrity({
      ...noProse,
      signals: { ...EMPTY_SIGNALS, proctored: true, fullscreenExits: 1 },
    });
    expect(verdict.severity).not.toBe("severe");
  });
});

/**
 * A competition entry is prose graded by the same model a case is, so
 * ai_likelihood genuinely applies here — unlike the quiz and the workbenches.
 * What must NOT change is the rule that it cannot convict alone.
 */
describe("a competition entry", () => {
  const typedItThemselves = {
    ...EMPTY_SIGNALS,
    proctored: true,
    keystrokes: 4200,
    blurCount: 1,
  };

  it("does not penalise a well-written entry the model calls AI-like", () => {
    const verdict = assessIntegrity({
      signals: typedItThemselves,
      answerChars: 4000,
      elapsedSeconds: null,
      aiLikelihood: 97,
    });
    // Typed, present, nothing pasted: the model's opinion stands alone and so
    // must cost nothing. This is the ESL false-positive case.
    expect(verdict.penaltyPct).toBe(0);
    expect(verdict.severity).toBe("clean");
  });

  it("does penalise one that was not typed and also reads as AI", () => {
    const verdict = assessIntegrity({
      signals: {
        ...EMPTY_SIGNALS,
        proctored: true,
        keystrokes: 20,
        pastedChars: 3900,
        largestPaste: 3900,
        pasteCount: 1,
      },
      answerChars: 4000,
      elapsedSeconds: null,
      aiLikelihood: 97,
    });
    expect(verdict.penaltyPct).toBeGreaterThan(0);
    expect(verdict.flags.map((f) => f.code)).toContain("ai_style");
  });

  it("skips the speed check when there is no meaningful clock", () => {
    // A competition runs for days, so elapsedSeconds is null by design.
    const verdict = assessIntegrity({
      signals: typedItThemselves,
      answerChars: 4000,
      elapsedSeconds: null,
      aiLikelihood: null,
    });
    expect(verdict.flags.map((f) => f.code)).not.toContain("impossible_speed");
  });
});
