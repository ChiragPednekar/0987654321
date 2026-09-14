import { describe, expect, it } from "vitest";
import { lastChecked, sourceProblems, type CompanySource } from "@/lib/companies";
import { COMPANIES } from "../scripts/content/companies";

const TODAY = "2026-09-14";
const ok: CompanySource = { label: "Firm careers — campus hiring", url: "https://careers.example.com/campus", checked_on: "2026-09-10" };

describe("sourceProblems", () => {
  it("accepts a public https source checked in the past", () => {
    expect(sourceProblems([ok], TODAY)).toEqual([]);
  });

  it("accepts a check dated today", () => {
    expect(sourceProblems([{ ...ok, checked_on: TODAY }], TODAY)).toEqual([]);
  });

  it("refuses a check dated in the future", () => {
    expect(sourceProblems([{ ...ok, checked_on: "2026-09-15" }], TODAY)).toEqual([
      expect.stringContaining("in the future"),
    ]);
  });

  it("refuses dates that are not real calendar days", () => {
    for (const checked_on of ["2026-02-30", "14-09-2026", "2026-9-1", ""]) {
      expect(sourceProblems([{ ...ok, checked_on }], TODAY)).toEqual([expect.stringContaining("not a YYYY-MM-DD date")]);
    }
  });

  it("refuses http, non-URLs and private addresses", () => {
    expect(sourceProblems([{ ...ok, url: "http://careers.example.com" }], TODAY)).toEqual([expect.stringContaining("https")]);
    expect(sourceProblems([{ ...ok, url: "careers page" }], TODAY)).toEqual([expect.stringContaining("not a URL")]);
    expect(sourceProblems([{ ...ok, url: "https://localhost/x" }], TODAY)).toEqual([expect.stringContaining("public")]);
  });

  it("refuses the same source listed twice", () => {
    expect(sourceProblems([ok, { ...ok, url: ok.url + "/" }], TODAY)).toEqual([expect.stringContaining("listed twice")]);
  });

  it("refuses an empty or overlong label", () => {
    expect(sourceProblems([{ ...ok, label: " " }], TODAY)).toHaveLength(1);
    expect(sourceProblems([{ ...ok, label: "x".repeat(121) }], TODAY)).toHaveLength(1);
  });
});

describe("lastChecked", () => {
  it("is null for an unverified profile", () => {
    expect(lastChecked([])).toBeNull();
  });

  it("is the most recent check", () => {
    expect(
      lastChecked([ok, { ...ok, url: "https://b.example.com", checked_on: "2026-09-12" }, { ...ok, url: "https://c.example.com", checked_on: "2026-08-01" }]),
    ).toBe("2026-09-12");
  });
});

describe("seeded company profiles", () => {
  it("list only valid sources", () => {
    for (const c of COMPANIES) expect(sourceProblems(c.sources ?? [], TODAY), c.slug).toEqual([]);
  });
});
