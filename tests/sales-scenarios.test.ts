import { describe, expect, it } from "vitest";
import { SCENARIOS, validate } from "../scripts/seed-sales";

/**
 * A buyer whose buy rule cannot be met would tell a student they lost a sale
 * that was impossible to win. The seeder refuses such a scenario; this keeps
 * the whole set under that check on every test run.
 */
describe("sales role-play scenarios", () => {
  it.each(SCENARIOS.map((s) => [s.slug, s] as const))("%s can be won", (_slug, s) => {
    expect(validate(s)).toEqual([]);
  });

  it("have unique slugs and span every level", () => {
    expect(new Set(SCENARIOS.map((s) => s.slug)).size).toBe(SCENARIOS.length);
    for (const d of ["easy", "medium", "hard"]) expect(SCENARIOS.some((s) => s.difficulty === d)).toBe(true);
  });
});
