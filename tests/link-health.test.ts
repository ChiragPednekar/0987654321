import { describe, expect, it } from "vitest";
import { isBrokenStatus, isConfirmedDead, type LinkHealth } from "@/lib/companies";

const health = (over: Partial<LinkHealth>): LinkHealth => ({
  url: "https://www.kearney.com/careers/interviewing",
  status: 200,
  checked_at: "2026-09-22T00:00:00.000Z",
  failures: 0,
  ...over,
});

describe("isBrokenStatus", () => {
  it("treats only a page the server says is gone as broken", () => {
    expect(isBrokenStatus(404)).toBe(true);
    expect(isBrokenStatus(410)).toBe(true);
  });

  /**
   * Corrected after the first real run. All seven mckinsey.com links came back
   * unreachable, and every one had been opened by hand in a browser the same
   * day — the fetcher times out where a person gets the page. Acting on it
   * would have hidden McKinsey's four published sample cases.
   */
  it("does NOT treat an unreachable host as broken", () => {
    expect(isBrokenStatus(null)).toBe(false);
  });

  /**
   * The reason this function is narrow rather than "anything that is not 2xx".
   * kearney.com returns 403 to every programmatic request and serves the same
   * page perfectly in a browser. A broad check would have hidden three good
   * links the day this was written.
   */
  it("does NOT treat a live site refusing a robot as broken", () => {
    expect(isBrokenStatus(403)).toBe(false); // Kearney does exactly this
    expect(isBrokenStatus(429)).toBe(false); // rate limited, not gone
    expect(isBrokenStatus(500)).toBe(false); // having a bad day
    expect(isBrokenStatus(503)).toBe(false);
  });

  it("treats a redirect or success as fine", () => {
    expect(isBrokenStatus(200)).toBe(false);
    expect(isBrokenStatus(301)).toBe(false);
  });
});

describe("isConfirmedDead", () => {
  it("never hides a link that merely timed out", () => {
    expect(isConfirmedDead(health({ status: null, failures: 50 }))).toBe(false);
  });

  it("needs two consecutive failures, so one bad night hides nothing", () => {
    expect(isConfirmedDead(health({ status: 404, failures: 1 }))).toBe(false);
    expect(isConfirmedDead(health({ status: 404, failures: 2 }))).toBe(true);
  });

  it("never hides a link that is merely refusing us", () => {
    // Many consecutive 403s still is not death — it is Kearney being Kearney.
    expect(isConfirmedDead(health({ status: 403, failures: 99 }))).toBe(false);
  });

  it("treats an unchecked link as fine rather than suspect", () => {
    expect(isConfirmedDead(undefined)).toBe(false);
  });

  it("forgets past failures once the link answers again", () => {
    // The route resets `failures` to 0 on any non-broken status, so a
    // recovered link is indistinguishable from one that never failed.
    expect(isConfirmedDead(health({ status: 200, failures: 0 }))).toBe(false);
  });
});
