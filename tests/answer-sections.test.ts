import { describe, expect, it } from "vitest";
import { ANSWER_SECTIONS, CASE_ANSWER_SECTIONS } from "@/lib/constants";
import {
  carryOverDraft,
  composeAnswer,
  filledSections,
  firstIncomplete,
  sectionsFor,
} from "@/lib/answer-sections";

describe("the case answer", () => {
  it("is the seven steps, in order", () => {
    expect(CASE_ANSWER_SECTIONS.map((s) => s.key)).toEqual([
      "clarify",
      "hypothesis",
      "structure",
      "analysis",
      "recommendation",
      "risks",
      "next_steps",
    ]);
  });

  it("is used for full cases, and the three parts for every other written format", () => {
    expect(sectionsFor("full_case")).toBe(CASE_ANSWER_SECTIONS);
    for (const format of ["memo", "wat", "behavioural", "guesstimate", null, undefined]) {
      expect(sectionsFor(format)).toBe(ANSWER_SECTIONS);
    }
  });

  it("reaches the grader as one answer, each filled box under its own heading", () => {
    const text = composeAnswer(CASE_ANSWER_SECTIONS, {
      clarify: " Why did profit fall? ",
      structure: "Revenue vs cost",
      next_steps: "",
    });
    expect(text).toBe("## Clarify the problem\n\nWhy did profit fall?\n\n## Structure\n\nRevenue vs cost");
  });

  it("stores only the boxes that were filled", () => {
    expect(filledSections(CASE_ANSWER_SECTIONS, { clarify: "x", risks: "  " })).toEqual({ clarify: "x" });
  });

  it("names the first box that still needs work", () => {
    const done = Object.fromEntries(CASE_ANSWER_SECTIONS.map((s) => [s.key, "x".repeat(s.minChars)]));
    expect(firstIncomplete(CASE_ANSWER_SECTIONS, done)).toBeUndefined();
    expect(firstIncomplete(CASE_ANSWER_SECTIONS, { ...done, hypothesis: "short" })?.key).toBe("hypothesis");
  });

  it("carries a three-box draft into the seven boxes without dropping anything", () => {
    const values = carryOverDraft(CASE_ANSWER_SECTIONS, {
      framework: "my tree",
      analysis: "my maths",
      recommendation: "my call",
    });
    expect(values.structure).toBe("my tree");
    expect(values.analysis).toBe("my maths");
    expect(values.recommendation).toBe("my call");
    expect(values.clarify).toBe("");
  });

  it("asks for at least as much as the grader's minimum when every box is filled", () => {
    const total = CASE_ANSWER_SECTIONS.reduce((n, s) => n + s.minChars, 0);
    expect(total).toBeGreaterThanOrEqual(200);
  });
});
