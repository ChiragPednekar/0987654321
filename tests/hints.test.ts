import { describe, expect, it } from "vitest";
import { approachPoints, buildHints, HINT_PENALTIES } from "@/lib/hints";

// Real expected_framework shapes from the case library.
const NUMBERED =
  "1. **Screen the peers** on growth, margin and risk.\n2. **Apply** the multiple to EBITDA.\n3. **Bridge** to equity value.\n4. **Adjust** for size.\n5. **Cross-check** with EV/Revenue.\n6. **Present a range**.";
const FORMULA_THEN_STEPS =
  "Profit = (Price × Volume) − (Variable cost × Volume) − Fixed cost\n\n1. **Decompose** the change.\n2. **Size each driver**.\n3. **Test** the claims.\n4. **Prioritise**.";
const SEMICOLONS = "Beachhead selection; switching motivation; GTM motion affordable at price point; staged expansion";
const PARAGRAPHS =
  "**Bottom-up** is usually more defensible:\n\nPopulation → filter → penetration → price.\n\nThen **cross-check top-down**.\n\nIf the two land within a factor of two, the estimate is usable.";

describe("buildHints", () => {
  it("reveals a numbered approach in three steps: start, middle, rest", () => {
    const hints = buildHints(NUMBERED);
    expect(hints.map((h) => h.step)).toEqual([1, 2, 3]);
    expect(hints[0].body).toContain("Screen the peers");
    expect(hints[1].body).toMatch(/Apply[\s\S]*Bridge/);
    expect(hints[2].body).toMatch(/Cross-check[\s\S]*Present a range/);
  });

  it("charges more for each later hint, and never more than the 50% cap in total", () => {
    const hints = buildHints(NUMBERED);
    expect(hints.map((h) => h.penalty_pct)).toEqual([...HINT_PENALTIES]);
    expect(hints.reduce((s, h) => s + h.penalty_pct, 0)).toBeLessThanOrEqual(50);
  });

  it("keeps a formula written above the steps with the first hint", () => {
    const [first] = buildHints(FORMULA_THEN_STEPS);
    expect(first.body).toContain("Profit = ");
    expect(first.body).toContain("Decompose");
  });

  it("splits a one-line, semicolon-separated approach", () => {
    expect(approachPoints(SEMICOLONS).points).toHaveLength(4);
    expect(buildHints(SEMICOLONS)).toHaveLength(3);
  });

  it("uses paragraphs when there are no numbered steps", () => {
    const hints = buildHints(PARAGRAPHS);
    expect(hints).toHaveLength(3);
    expect(hints[0].body).toContain("Bottom-up");
  });

  it("loses no part of the approach across the hints", () => {
    const all = buildHints(NUMBERED).map((h) => h.body).join("\n");
    for (const word of ["Screen", "Apply", "Bridge", "Adjust", "Cross-check", "Present"]) expect(all).toContain(word);
  });

  it("splits a single paragraph of guidance into its sentences", () => {
    const hints = buildHints(
      "The CV is already in the interviewer's hand, so repeating it adds nothing. A strong answer has a spine that connects two or three choices. It should invite a follow-up question rather than close the subject.",
    );
    expect(hints).toHaveLength(3);
    expect(hints[0].body).toContain("CV is already");
  });

  it("makes fewer hints from a short approach, and none from nothing", () => {
    expect(buildHints("Check the formula in cell C4 against the definition.")).toHaveLength(1);
    expect(buildHints("")).toEqual([]);
    expect(buildHints(null)).toEqual([]);
  });
});
