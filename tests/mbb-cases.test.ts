import { describe, expect, it } from "vitest";
import { buildMbbCases, CASES_PER_FIRM_LEVEL, MBB_FIRMS } from "../scripts/templates/mbb";
import { validate } from "../scripts/seed-mbb";

/**
 * The company pages for every consulting firm link to MBB-style practice, and
 * the library filters by firm and level. Each firm must have cases at every
 * level, in that firm's interview format, and every answer key must agree with
 * its own exhibits.
 */
const cases = buildMbbCases();

describe("MBB-style case set", () => {
  it("covers every firm at every level", () => {
    for (const firm of MBB_FIRMS) {
      for (const level of ["easy", "medium", "hard"] as const) {
        const n = cases.filter((c) => c.companyTrack === firm.track && c.difficulty === level).length;
        expect(n, `${firm.track} ${level}`).toBe(CASES_PER_FIRM_LEVEL);
      }
    }
  });

  it("gives every level all six case types, and every firm all six", () => {
    for (const level of ["easy", "medium", "hard"] as const) {
      expect(new Set(cases.filter((c) => c.difficulty === level).map((c) => c.tags[0])).size).toBe(6);
    }
    for (const firm of MBB_FIRMS) {
      expect(new Set(cases.filter((c) => c.companyTrack === firm.track).map((c) => c.tags[0])).size).toBe(6);
    }
  });

  it("runs McKinsey interviewer-led and the other firms candidate-led", () => {
    for (const c of cases) {
      const expected = c.companyTrack === "McKinsey" ? "interviewer-led" : "candidate-led";
      expect(c.tags).toContain(expected);
      expect(c.scenario).toContain(expected === "interviewer-led" ? "interviewer-led" : "candidate-led");
    }
  });

  it("makes harder levels ask for more", () => {
    const questions = (level: string) =>
      Math.min(...cases.filter((c) => c.difficulty === level).map((c) => c.modelAnswer.split(/\n\*\*\d+\. /).length));
    expect(questions("medium")).toBeGreaterThan(questions("easy"));
    expect(questions("hard")).toBeGreaterThan(questions("medium"));
  });

  it("passes the seed's own validation: no failed interpolation, rubrics sum to 100", () => {
    expect(validate(cases)).toEqual([]);
  });

  it("is deterministic, so re-seeding updates rows in place", () => {
    expect(buildMbbCases()).toEqual(cases);
  });

  it("states the profit fall that its own exhibit implies", () => {
    for (const c of cases.filter((x) => x.categorySlug === "profitability")) {
      const rows = c.supportingData["Exhibit 1 — segment P&L"] as Array<Record<string, number>>;
      const col = (prefix: string) => rows.reduce((s, r) => s + Number(Object.entries(r).find(([k]) => k.startsWith(prefix))![1]), 0);
      const fall = col("revenue last") - col("cost last") - (col("revenue this") - col("cost this"));
      const stated = c.modelAnswer.match(/a fall of [^\d]*([\d,]+)/);
      expect(stated, c.slug).not.toBeNull();
      expect(Number(stated![1].replace(/,/g, "")), c.slug).toBe(fall);
    }
  });

  it("recommends the targeted increase only when it beats a blanket one", () => {
    for (const c of cases.filter((x) => x.categorySlug === "pricing" && x.difficulty === "hard")) {
      const m = c.modelAnswer.match(/gives [^\d]*([\d,.]+) [A-Za-z]+ of contribution, against [^\d]*([\d,.]+) [A-Za-z]+ for a blanket/);
      expect(m, c.slug).not.toBeNull();
      expect(Number(m![1].replace(/,/g, ""))).toBeGreaterThan(Number(m![2].replace(/,/g, "")));
    }
  });
});

describe("orderedEntries", () => {
  it("puts numbered exhibits back in order after jsonb reorders them", async () => {
    const { orderedEntries } = await import("@/lib/supporting-data");
    const fromDb = { "Exhibit 1 — current economics": 1, "Exhibit 3 — customer segments": 3, "Exhibit 2 — demand sensitivity": 2 };
    expect(orderedEntries(fromDb).map(([k]) => k[8])).toEqual(["1", "2", "3"]);
  });

  it("leaves other cases' keys alone", async () => {
    const { orderedEntries } = await import("@/lib/supporting-data");
    expect(orderedEntries({ revenue: 1, costs: 2 }).map(([k]) => k)).toEqual(["revenue", "costs"]);
  });
});
