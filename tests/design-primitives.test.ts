import { describe, expect, it } from "vitest";
import { caseTagLabels, tagLabel } from "../src/lib/tags";
import { AVATAR_TONES, avatarTone, initials } from "../src/lib/utils";
import { greetingFor } from "../src/lib/greeting";

describe("tagLabel", () => {
  it("turns stored tags into sentence case", () => {
    expect(tagLabel("market-entry")).toBe("Market entry");
    expect(tagLabel("willingness-to-pay")).toBe("Willingness to pay");
    expect(tagLabel("cash conversion cycle")).toBe("Cash conversion cycle");
    expect(tagLabel("pricing")).toBe("Pricing");
  });

  it("restores acronyms wherever they sit", () => {
    expect(tagLabel("wacc")).toBe("WACC");
    expect(tagLabel("m&a")).toBe("M&A");
    expect(tagLabel("mbb-style")).toBe("MBB style");
    expect(tagLabel("b2b saas pricing")).toBe("B2B SaaS pricing");
    expect(tagLabel("cac")).toBe("CAC");
  });

  it("shows spelling-only duplicates once", () => {
    expect(caseTagLabels(["market-entry", "market entry", "sizing"])).toEqual(["Market entry", "Sizing"]);
    expect(caseTagLabels(["", "  ", "npv"])).toEqual(["NPV"]);
    expect(caseTagLabels(null)).toEqual([]);
  });
});

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("Chirag Yogesh Pednekar")).toBe("CP");
    expect(initials("chirag pednekar")).toBe("CP");
    expect(initials("Asha")).toBe("A");
    expect(initials("  ")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});

describe("avatarTone", () => {
  it("is stable for an id and always a known tone", () => {
    const id = "5b0f6c1e-1111-4a2b-9c3d-123456789abc";
    expect(avatarTone(id)).toBe(avatarTone(id));
    expect(AVATAR_TONES).toContain(avatarTone(id));
    expect(AVATAR_TONES).toContain(avatarTone(null));
  });
});

describe("greetingFor", () => {
  it("follows the time of day in India", () => {
    expect(greetingFor(new Date("2026-10-30T02:30:00Z"))).toBe("Good morning"); // 8:00 IST
    expect(greetingFor(new Date("2026-10-30T08:30:00Z"))).toBe("Good afternoon"); // 14:00 IST
    expect(greetingFor(new Date("2026-10-30T13:30:00Z"))).toBe("Good evening"); // 19:00 IST
    expect(greetingFor(new Date("2026-10-30T20:30:00Z"))).toBe("Good evening"); // 2:00 IST
  });
});
