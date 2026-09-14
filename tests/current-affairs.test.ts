import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  htmlToText,
  isRoutine,
  newsworthiness,
  parseFeedDate,
  parseRbiFeed,
} from "@/lib/current-affairs/feed";
import {
  checkDrafts,
  currentStreak,
  evidenceAppears,
  istDate,
  placeAnswer,
  scoreAttempt,
  type DraftQuestion,
} from "@/lib/current-affairs/questions";

// A trimmed copy of the real RBI press-release feed, captured 2026-09-13.
const FEED = readFileSync(new URL("./fixtures/rbi-press-releases.xml", import.meta.url), "utf8");

describe("parseRbiFeed", () => {
  const items = parseRbiFeed(FEED);

  it("reads every item with a title, an rbi.org.in link, a date and the release text", () => {
    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item.title.length).toBeGreaterThan(10);
      expect(item.url).toMatch(/^https:\/\/www\.rbi\.org\.in\//);
      expect(Number.isNaN(Date.parse(item.publishedAt))).toBe(false);
    }
  });

  it("decodes the rupee sign and keeps the figures in the body", () => {
    const omo = items.find((i) => i.title.includes("OMO Sale"))!;
    expect(omo.body).toContain("₹1,00,000 crore");
    expect(omo.body).toContain("September 17, 2026");
    expect(omo.body).not.toMatch(/<[a-z]/i);
  });

  it("reads the feed's zoneless timestamps as IST", () => {
    const kyc = items.find((i) => i.title.includes("Know Your Customer"))!;
    // Fri, 11 Sep 2026 21:40 IST is 16:10 UTC.
    expect(kyc.publishedAt).toBe("2026-09-11T16:10:00.000Z");
  });

  it("drops an item whose link is not the RBI's", () => {
    const forged = FEED.replace(/https:\/\/www\.rbi\.org\.in\/scripts\/BS_PressReleaseDisplay\.aspx\?prid=63587/, "https://evil.example/x");
    expect(parseRbiFeed(forged)).toHaveLength(4);
  });
});

describe("parseFeedDate", () => {
  it("honours an explicit offset when one is given", () => {
    expect(parseFeedDate("11 Sep, 2026 +0530")).toBe("2026-09-10T18:30:00.000Z");
    expect(parseFeedDate("Fri, 11 Sep 2026 10:00:00 GMT")).toBe("2026-09-11T10:00:00.000Z");
  });

  it("returns null for something that is not a date", () => {
    expect(parseFeedDate("yesterday")).toBeNull();
  });
});

describe("routine filtering", () => {
  const items = parseRbiFeed(FEED);
  const byTitle = (s: string) => items.find((i) => i.title.includes(s))!;

  it("keeps policy news and drops daily data releases", () => {
    expect(isRoutine(byTitle("Know Your Customer"))).toBe(false);
    expect(isRoutine(byTitle("OMO Sale"))).toBe(false);
    expect(isRoutine(byTitle("Reverse Repo"))).toBe(true);
    // Money supply is both routine by title and too short to question.
    expect(isRoutine(byTitle("Money Supply"))).toBe(true);
  });

  it("ranks a named lender's penalty below real policy", () => {
    expect(newsworthiness(byTitle("monetary penalty"))).toBeLessThan(newsworthiness(byTitle("OMO Sale")));
  });

  it("flattens table cells into readable text", () => {
    expect(htmlToText("<table><tr><td>Tranche</td><td>&#8377;50,000 crore</td></tr></table>")).toBe(
      "Tranche ₹50,000 crore",
    );
  });
});

describe("checkDrafts", () => {
  const omo = parseRbiFeed(FEED).find((i) => i.title.includes("OMO Sale"))!.body;

  const good: DraftQuestion = {
    item: 1,
    stem: "In September 2026, the RBI announced OMO sale auctions of government securities for what aggregate amount?",
    options: ["₹1,00,000 crore", "₹50,000 crore", "₹75,000 crore", "₹1,50,000 crore"],
    answer: "₹1,00,000 crore",
    explanation: "The release sets the aggregate at ₹1,00,000 crore across three tranches.",
    evidence: "OMO sale auctions of Government of India securities for an aggregate amount of ₹1,00,000 crore",
  };

  it("accepts a grounded question and moves the answer off position A", () => {
    const { accepted, rejected } = checkDrafts([good], [omo]);
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].options[accepted[0].correctIndex]).toBe("₹1,00,000 crore");
  });

  it("rejects evidence the release does not contain", () => {
    const { accepted, rejected } = checkDrafts(
      [{ ...good, evidence: "The Reserve Bank has decided to cut the repo rate by 25 basis points" }],
      [omo],
    );
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toMatch(/not a quote/);
  });

  it("rejects an answer whose figure is not in the release, even with real evidence", () => {
    const { rejected } = checkDrafts(
      [{ ...good, options: ["₹2,00,000 crore", "₹50,000 crore", "₹75,000 crore", "₹1,50,000 crore"], answer: "₹2,00,000 crore" }],
      [omo],
    );
    expect(rejected[0].reason).toMatch(/200000/);
  });

  it("rejects a number word the quote contradicts, even though the quote is real", () => {
    const { accepted, rejected } = checkDrafts(
      [
        {
          ...good,
          stem: "How many tranches did the RBI's September 2026 OMO sale programme involve?",
          options: ["Four", "Two", "Three", "Five"],
          answer: "Four",
          evidence: "in three tranches of ₹50,000 crore, ₹25,000 crore, and ₹25,000 crore",
        },
      ],
      [omo],
    );
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toMatch(/\b4\b/);
  });

  it("rejects a figure that is in the release but not in the quote offered for it", () => {
    // 50,000 is in the release (a tranche), but this quote is about the total.
    const { rejected } = checkDrafts(
      [{ ...good, options: ["₹50,000 crore", "₹1,00,000 crore", "₹75,000 crore", "₹1,50,000 crore"], answer: "₹50,000 crore", evidence: "OMO sale auctions of Government of India securities for an aggregate amount of ₹1,00,000 crore" }],
      [omo],
    );
    expect(rejected[0].reason).toMatch(/50000/);
  });

  it("rejects a short answer its quote does not name, but lets a long answer paraphrase", () => {
    const kycQuote = "The Hon'ble Supreme Court in its order dated August 4, 2026 has directed the Reserve Bank";
    const kyc = parseRbiFeed(FEED).find((i) => i.title.includes("Know Your Customer"))!.body;
    const base = { ...good, item: 1, evidence: kycQuote };

    const named = checkDrafts(
      [{ ...base, options: ["The Supreme Court", "SEBI", "The Ministry of Finance", "NITI Aayog"], answer: "The Supreme Court" }],
      [kyc],
    );
    expect(named.accepted).toHaveLength(1);

    const wrongName = checkDrafts(
      [{ ...base, options: ["SEBI", "The Supreme Court", "The Ministry of Finance", "NITI Aayog"], answer: "SEBI" }],
      [kyc],
    );
    expect(wrongName.rejected[0].reason).toMatch(/short answer/);

    const described = checkDrafts(
      [
        {
          ...base,
          options: [
            "To set a procedure for banks placing debit holds on accounts linked to money mules",
            "To raise capital requirements for small finance banks",
            "To cut the repo rate for cooperative banks",
            "To merge regional rural banks",
          ],
          answer: "To set a procedure for banks placing debit holds on accounts linked to money mules",
        },
      ],
      [kyc],
    );
    expect(described.accepted).toHaveLength(1);
  });

  it("rejects an answer that is not among the options, and duplicate options", () => {
    expect(checkDrafts([{ ...good, answer: "₹3 crore" }], [omo]).rejected[0].reason).toMatch(/not one of the options/);
    expect(
      checkDrafts([{ ...good, options: ["₹1,00,000 crore", "₹1,00,000 crore", "a", "b"] }], [omo]).rejected[0].reason,
    ).toMatch(/duplicate options/);
  });

  it("rejects a reference to an item that was never shown", () => {
    expect(checkDrafts([{ ...good, item: 9 }], [omo]).rejected[0].reason).toMatch(/not provided/);
  });

  it("caps questions per release so one announcement cannot fill the quiz", () => {
    const drafts = [0, 1, 2].map((i) => ({ ...good, stem: `${good.stem} (variant ${i})` }));
    const { accepted, rejected } = checkDrafts(drafts, [omo]);
    expect(accepted).toHaveLength(2);
    expect(rejected[0].reason).toMatch(/too many/);
  });

  it("tolerates curly quotes and spacing differences in a quote, but not a paraphrase", () => {
    expect(evidenceAppears("an   aggregate amount of ₹1,00,000 crore in three tranches", omo)).toBe(true);
    expect(evidenceAppears("a total of one lakh crore rupees in three parts", omo)).toBe(false);
  });
});

describe("placeAnswer", () => {
  it("is stable for the same stem, so re-running cannot move an answer under a past attempt", () => {
    const a = placeAnswer(["w", "x", "y", "z"], "w", "Which body sets the repo rate?");
    const b = placeAnswer(["w", "x", "y", "z"], "w", "Which body sets the repo rate?");
    expect(a).toEqual(b);
    expect(a.options[a.correctIndex]).toBe("w");
  });
});

describe("istDate", () => {
  it("rolls over at midnight India time, not UTC", () => {
    expect(istDate(new Date("2026-09-13T18:29:00Z"))).toBe("2026-09-13");
    expect(istDate(new Date("2026-09-13T18:31:00Z"))).toBe("2026-09-14");
  });
});

describe("currentStreak", () => {
  const quizDays = ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];

  it("counts consecutive days answered on the day", () => {
    expect(currentStreak(["2026-09-11", "2026-09-12", "2026-09-13"], quizDays, "2026-09-13")).toBe(3);
  });

  it("does not break before today's quiz has been taken", () => {
    expect(currentStreak(["2026-09-11", "2026-09-12"], quizDays, "2026-09-13")).toBe(2);
  });

  it("breaks on a missed quiz day", () => {
    expect(currentStreak(["2026-09-10", "2026-09-12", "2026-09-13"], quizDays, "2026-09-13")).toBe(2);
  });

  it("is not broken by a day with no quiz", () => {
    // No quiz was published on the 12th.
    expect(currentStreak(["2026-09-11", "2026-09-13"], ["2026-09-11", "2026-09-13"], "2026-09-13")).toBe(2);
  });
});

describe("scoreAttempt", () => {
  it("leaves a pulled question out of both sides of the score", () => {
    const questions = [
      { position: 0, correct_index: 2, is_pulled: false },
      { position: 1, correct_index: 0, is_pulled: true },
      { position: 2, correct_index: 1, is_pulled: false },
    ];
    expect(scoreAttempt([2, 3, 1], questions)).toEqual({ correct: 2, total: 2 });
    expect(scoreAttempt([2, 0, 0], questions)).toEqual({ correct: 1, total: 2 });
  });
});
