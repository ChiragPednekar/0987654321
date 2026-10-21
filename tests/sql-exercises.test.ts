import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkExercises, EXERCISES } from "../scripts/seed-sql";

/**
 * Every SQL exercise must run on both datasets, return rows on both, and fail
 * a query that memorised the visible answer when it meets the hidden data —
 * or a correct student query could be marked wrong, or a hardcoded one right.
 */
describe("SQL exercises", () => {
  it("all pass the seeder's checks", async () => {
    expect(await checkExercises()).toEqual([]);
  }, 30_000);

  it("cover every level and at least ten topics", () => {
    for (const d of ["easy", "medium", "hard"]) expect(EXERCISES.some((e) => e.difficulty === d)).toBe(true);
    expect(new Set(EXERCISES.map((e) => e.topic)).size).toBeGreaterThanOrEqual(10);
  });
});
