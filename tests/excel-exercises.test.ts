import { describe, expect, it } from "vitest";
import { EXERCISES, validate } from "../scripts/seed-excel";

/**
 * The seeder's guarantees, on every test run: each reference formula works on
 * both sheets with different answers, every memorised or row-pinned control
 * fails the hidden sheet, and every alternate correct formula is accepted.
 */
describe("Excel exercises", () => {
  it.each(EXERCISES.map((e) => [e.slug, e] as const))("%s is sound", (_slug, e) => {
    expect(validate(e, () => {})).toEqual([]);
  });

  it("have unique slugs and span every level", () => {
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
    for (const d of ["easy", "medium", "hard"]) expect(EXERCISES.some((e) => e.difficulty === d)).toBe(true);
  });
});
