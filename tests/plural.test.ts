import { describe, expect, it } from "vitest";
import { plural } from "../src/lib/utils";

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    // The bug this exists to prevent: a teacher with one student read
    // "1 students across 2 batches" on their own dashboard.
    expect(plural(1, "student")).toBe("1 student");
    expect(plural(1, "case")).toBe("1 case");
  });

  it("uses the plural for zero and for many", () => {
    // Zero is plural in English — "0 students", not "0 student".
    expect(plural(0, "student")).toBe("0 students");
    expect(plural(2, "student")).toBe("2 students");
    expect(plural(508, "case")).toBe("508 cases");
  });

  it("takes an explicit plural for nouns that need one", () => {
    expect(plural(1, "batch", "batches")).toBe("1 batch");
    expect(plural(3, "batch", "batches")).toBe("3 batches");
  });
});
