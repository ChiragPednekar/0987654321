import { describe, expect, it } from "vitest";
import { validateOfficialLinks, type OfficialLink } from "@/lib/companies";

const link = (url: string): OfficialLink => ({
  label: "Interview process",
  url,
  note: "What the firm says about its own rounds.",
});

describe("validateOfficialLinks", () => {
  it("accepts the firm's own domain and its subdomains", () => {
    expect(validateOfficialLinks([link("https://www.bcg.com/careers")], "bcg.com")).toEqual([]);
    expect(validateOfficialLinks([link("https://careers.bcg.com/x")], "bcg.com")).toEqual([]);
    expect(validateOfficialLinks([link("https://bcg.com/x")], "bcg.com")).toEqual([]);
  });

  /**
   * The reason this validator exists. Without a host check this column becomes
   * a place for prep-vendor and affiliate links to accumulate, and the entire
   * value of the feature is that the material is first-party.
   */
  it("refuses a third-party host", () => {
    const problems = validateOfficialLinks(
      [link("https://www.glassdoor.co.in/Interview/bcg.htm")],
      "bcg.com",
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/not bcg\.com/);
  });

  it("refuses a lookalike domain that merely ends with the name", () => {
    // "notbcg.com".endsWith("bcg.com") is true, which is exactly the bug a
    // naive suffix check would ship.
    expect(validateOfficialLinks([link("https://notbcg.com/x")], "bcg.com")).toHaveLength(1);
    expect(validateOfficialLinks([link("https://bcg.com.evil.net/x")], "bcg.com")).toHaveLength(1);
  });

  it("refuses plain http", () => {
    const problems = validateOfficialLinks([link("http://www.bcg.com/x")], "bcg.com");
    expect(problems.some((p) => /not https/.test(p))).toBe(true);
  });

  it("refuses links when no official domain is declared", () => {
    expect(validateOfficialLinks([link("https://www.bcg.com/x")], null)).toHaveLength(1);
  });

  it("allows a company with no links at all", () => {
    expect(validateOfficialLinks([], null)).toEqual([]);
  });

  it("requires a label and a note", () => {
    expect(
      validateOfficialLinks([{ label: "", url: "https://bcg.com/x", note: "why" }], "bcg.com"),
    ).toContain("a link has no label");
  });
});
