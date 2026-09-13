import { describe, expect, it } from "vitest";
import {
  canAccept,
  parseCounterpartyReply,
  isComplete,
  maxJointValue,
  scoreDeal,
  scoreTerms,
  type NegotiationSetup,
} from "@/lib/negotiation/engine";

/**
 * A deliberately integrative setup: the two sides rank the issues differently,
 * so trading across them beats splitting each one down the middle.
 */
const SETUP: NegotiationSetup = {
  issues: [
    {
      key: "price",
      label: "Unit price",
      options: [
        { key: "low", label: "₹90" },
        { key: "mid", label: "₹100" },
        { key: "high", label: "₹110" },
      ],
    },
    {
      key: "terms",
      label: "Payment terms",
      options: [
        { key: "d30", label: "30 days" },
        { key: "d60", label: "60 days" },
        { key: "d90", label: "90 days" },
      ],
    },
    {
      key: "volume",
      label: "Volume commitment",
      options: [
        { key: "none", label: "No commitment" },
        { key: "year", label: "12-month commitment" },
      ],
    },
  ],
  // Buyer (the student) cares most about price.
  studentPayoffs: {
    price: { low: 40, mid: 25, high: 5 },
    terms: { d30: 5, d60: 12, d90: 20 },
    volume: { none: 10, year: 4 },
  },
  // Seller cares most about the volume commitment and is relaxed about price.
  counterpartyPayoffs: {
    price: { low: 8, mid: 18, high: 26 },
    terms: { d30: 20, d60: 12, d90: 4 },
    volume: { none: 2, year: 30 },
  },
  studentBatna: 40,
  counterpartyBatna: 40,
};

describe("scoring", () => {
  it("adds up the chosen options for one side", () => {
    expect(scoreTerms(SETUP.studentPayoffs, { price: "low", terms: "d90", volume: "none" }))
      .toBe(70);
  });

  it("treats an unsettled issue as worth nothing rather than guessing", () => {
    expect(scoreTerms(SETUP.studentPayoffs, { price: "low" })).toBe(40);
  });

  it("requires every issue to be settled before terms are a deal", () => {
    expect(isComplete(SETUP.issues, { price: "low", terms: "d90" })).toBe(false);
    expect(isComplete(SETUP.issues, { price: "low", terms: "d90", volume: "none" })).toBe(true);
    // An option that does not exist is not a settlement.
    expect(isComplete(SETUP.issues, { price: "free", terms: "d90", volume: "none" })).toBe(false);
  });
});

describe("the counterparty's walk-away", () => {
  it("refuses a deal below its own BATNA however the conversation went", () => {
    const greedy = { price: "low", terms: "d90", volume: "none" };
    expect(scoreTerms(SETUP.counterpartyPayoffs, greedy)).toBe(14);
    expect(canAccept(SETUP, greedy)).toBe(false);
  });

  it("accepts a deal that clears it", () => {
    const fair = { price: "mid", terms: "d60", volume: "year" };
    expect(scoreTerms(SETUP.counterpartyPayoffs, fair)).toBe(60);
    expect(canAccept(SETUP, fair)).toBe(true);
  });

  it("never accepts an incomplete offer", () => {
    expect(canAccept(SETUP, { price: "high", terms: "d30" })).toBe(false);
  });
});

describe("integrative value", () => {
  it("finds the largest pie the two sides could have made", () => {
    // price: low 48, mid 43, high 31 -> 48. terms: d30 25, d60 24, d90 24 -> 25.
    // volume: none 12, year 34 -> 34. Total 107.
    expect(maxJointValue(SETUP)).toBe(107);
  });

  it("rewards trading across issues over splitting each one", () => {
    // Both sides meet in the middle on everything.
    const split = scoreDeal(SETUP, { price: "mid", terms: "d60", volume: "none" });
    // The student concedes the volume commitment (cheap for them, precious to
    // the seller) and takes the price and the payment terms in exchange.
    const traded = scoreDeal(SETUP, { price: "low", terms: "d90", volume: "year" });

    expect(traded.jointValue).toBeGreaterThan(split.jointValue);
    // And the student is better off too — the trade was not charity.
    expect(traded.studentScore).toBeGreaterThan(split.studentScore);
  });

  it("separates claiming value from creating it", () => {
    // A deal that is excellent for the student and barely clears the seller.
    const lopsided = scoreDeal(SETUP, { price: "low", terms: "d90", volume: "year" });
    expect(lopsided.claimedPct).toBeGreaterThan(50);
    expect(lopsided.efficiencyPct).toBeGreaterThan(80);
  });

  it("tells a student when no deal would have been better", () => {
    const bad = scoreDeal(SETUP, { price: "high", terms: "d30", volume: "year" });
    expect(bad.studentScore).toBe(14);
    expect(bad.beatBatna).toBe(false);
  });
});

describe("reading the counterparty's reply", () => {
  const full = { price: "mid", terms: "d60", volume: "year" };
  const body = JSON.stringify({
    message: "That could work for us.",
    offer: full,
    accept: true,
  });

  it("reads a bare JSON object", () => {
    const r = parseCounterpartyReply(body, SETUP.issues);
    expect(r.message).toBe("That could work for us.");
    expect(r.offer).toEqual(full);
    expect(r.wantsAccept).toBe(true);
  });

  it("reads it out of a fenced block", () => {
    const r = parseCounterpartyReply("```json\n" + body + "\n```", SETUP.issues);
    expect(r.wantsAccept).toBe(true);
    expect(r.offer).toEqual(full);
  });

  it("reads it when the model chats before the JSON", () => {
    const r = parseCounterpartyReply("Sure, here is my position.\n\n" + body, SETUP.issues);
    expect(r.message).toBe("That could work for us.");
    expect(r.wantsAccept).toBe(true);
  });

  it("falls back to prose when the JSON is truncated, and cannot accept", () => {
    // What a token limit does mid-object. The accept flag is inside the JSON,
    // so a reply that does not parse must never be read as agreement — this is
    // the bug that made the counterparty look like it never said yes.
    const cut = "```json\n{\n  \"message\": \"I think we could";
    const r = parseCounterpartyReply(cut, SETUP.issues);
    expect(r.wantsAccept).toBe(false);
    expect(r.offer).toBeNull();
    expect(r.message.length).toBeGreaterThan(0);
  });

  it("treats a partial offer as conversation rather than terms", () => {
    const partial = JSON.stringify({ message: "How about this?", offer: { price: "mid" } });
    expect(parseCounterpartyReply(partial, SETUP.issues).offer).toBeNull();
  });

  it("never invents agreement from an absent flag", () => {
    const quiet = JSON.stringify({ message: "Not yet.", offer: full });
    expect(parseCounterpartyReply(quiet, SETUP.issues).wantsAccept).toBe(false);
  });
});
