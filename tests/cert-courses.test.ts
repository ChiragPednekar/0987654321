import { describe, expect, it } from "vitest";
import { CERT_COURSES } from "@/lib/cert-courses";
import { gradeCheck, MODULE_CHECKS, publicCheck } from "@/lib/cert-course-checks";

/**
 * The prep courses are the gate in front of the certificate exams: a module is
 * done only when its knowledge check is passed (075). These pin the content
 * and the grading so a course edit cannot silently leave a module with no
 * check — which would make the exam impossible to unlock — or leak an answer.
 */

/** The cases each exam is sat on (migrations 071 and 075). */
const EXAM_CASES: Record<string, string[]> = {
  "consulting-case-certificate": ["market-entry-10", "operations-capacity-3"],
  "finance-case-certificate": ["npv-irr-project-1", "dcf-valuation-1"],
  "product-marketing-certificate": ["prioritization-11", "product-launch-10"],
};

describe("prep course knowledge checks", () => {
  const modules = Object.values(CERT_COURSES).flatMap((c) => c.modules);

  it("gives every module a four-question check", () => {
    for (const m of modules) {
      expect(MODULE_CHECKS[m.id], m.id).toBeDefined();
      expect(MODULE_CHECKS[m.id]).toHaveLength(4);
    }
  });

  it("has four distinct options per question and an answer that points at one", () => {
    for (const questions of Object.values(MODULE_CHECKS)) {
      for (const q of questions) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(4);
      }
    }
  });

  it("does not always put the right answer in the same place", () => {
    const positions = new Set(Object.values(MODULE_CHECKS).flat().map((q) => q.answer));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it("never sends the answer to the page", () => {
    for (const id of Object.keys(MODULE_CHECKS)) {
      for (const q of publicCheck(id)) {
        expect(q).not.toHaveProperty("answer");
        expect(q).not.toHaveProperty("explanation");
      }
    }
  });

  it("passes 3 of 4 and fails 2 of 4", () => {
    const id = "consulting-mod-2";
    const right = MODULE_CHECKS[id].map((q) => q.answer);
    const wrong = (a: number) => (a + 1) % 4;
    expect(gradeCheck(id, right).passed).toBe(true);
    expect(gradeCheck(id, [wrong(right[0]), ...right.slice(1)]).passed).toBe(true);
    expect(gradeCheck(id, [wrong(right[0]), wrong(right[1]), ...right.slice(2)]).passed).toBe(false);
  });
});

describe("prep courses never hand out the exam", () => {
  it.each(Object.keys(EXAM_CASES))("the %s course does not recommend its exam's cases", (slug) => {
    const recommended = CERT_COURSES[slug].modules.flatMap((m) => m.recommendedCases.map((c) => c.slug));
    for (const examCase of EXAM_CASES[slug]) expect(recommended).not.toContain(examCase);
  });
});
