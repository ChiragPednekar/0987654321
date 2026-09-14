import { describe, expect, it } from "vitest";
import {
  EMPTY_STATE,
  applyClaims,
  buyRuleMet,
  gateSummary,
  parseBuyerReply,
  quoteIsStudents,
  settleTurn,
  type BuyRule,
  type SalesNeed,
  type SalesObjection,
} from "@/lib/sales/engine";

const NEEDS: SalesNeed[] = [
  { key: "stockouts", label: "Stock-outs", detail: "" },
  { key: "credit", label: "Credit tracking", detail: "" },
  { key: "time", label: "Owner's time", detail: "" },
];
const OBJECTIONS: SalesObjection[] = [
  { key: "staff", label: "Staff will not use it", detail: "" },
  { key: "price", label: "Price", detail: "" },
];
const RULE: BuyRule = { needsRequired: 2, objectionsRequired: ["staff"] };

const STUDENT = [
  "Thanks for your time. How do you find out today when an item is about to run out?",
  "What happens when a retailer delays payment beyond thirty days?",
  "We train your two billing staff on-site for a week and the app works in Marathi.",
];

describe("quoteIsStudents", () => {
  it("accepts the student's own words, ignoring case, spacing and curly quotes", () => {
    expect(quoteIsStudents("how do you find out  today when an item is about to run out", STUDENT)).toBe(true);
    expect(quoteIsStudents("“What happens when a retailer delays payment”", STUDENT)).toBe(true);
  });

  it("rejects a paraphrase, a buyer's line, or a quote too short to prove anything", () => {
    expect(quoteIsStudents("asked about running out of stock", STUDENT)).toBe(false);
    expect(quoteIsStudents("We lose sales every week when fast movers run out", STUDENT)).toBe(false);
    expect(quoteIsStudents("Thanks", STUDENT)).toBe(false);
  });
});

describe("applyClaims", () => {
  it("keeps grounded claims about real keys and rejects the rest", () => {
    const { state, rejected } = applyClaims(EMPTY_STATE, {
      needs: NEEDS,
      objections: OBJECTIONS,
      uncovered: [
        { key: "stockouts", quote: "How do you find out today when an item is about to run out?" },
        { key: "credit", quote: "the student asked about credit" }, // paraphrase
        { key: "loyalty", quote: "What happens when a retailer delays payment" }, // no such need
      ],
      resolved: [{ key: "staff", quote: "We train your two billing staff on-site for a week" }],
      studentMessages: STUDENT,
      turn: 3,
    });
    expect(Object.keys(state.uncovered)).toEqual(["stockouts"]);
    expect(Object.keys(state.resolved)).toEqual(["staff"]);
    expect(rejected.map((r) => r.key)).toEqual(["credit", "loyalty"]);
  });

  it("keeps the first moment a need was uncovered", () => {
    const first = applyClaims(EMPTY_STATE, {
      needs: NEEDS,
      objections: OBJECTIONS,
      uncovered: [{ key: "credit", quote: "What happens when a retailer delays payment" }],
      resolved: [],
      studentMessages: STUDENT,
      turn: 2,
    }).state;
    const later = applyClaims(first, {
      needs: NEEDS,
      objections: OBJECTIONS,
      uncovered: [{ key: "credit", quote: "the app works in Marathi" }],
      resolved: [],
      studentMessages: STUDENT,
      turn: 5,
    }).state;
    expect(later.uncovered.credit.turn).toBe(2);
  });
});

describe("the buy gate", () => {
  const twoNeedsNoObjection = {
    uncovered: { stockouts: { quote: "q", turn: 1 }, credit: { quote: "q", turn: 2 } },
    resolved: {},
  };
  const ready = { ...twoNeedsNoObjection, resolved: { staff: { quote: "q", turn: 3 } } };

  it("needs both the needs and the required objection", () => {
    expect(buyRuleMet(RULE, EMPTY_STATE)).toBe(false);
    expect(buyRuleMet(RULE, twoNeedsNoObjection)).toBe(false);
    expect(buyRuleMet(RULE, ready)).toBe(true);
  });

  it("overrides a premature buy — pressure cannot close the sale", () => {
    const early = settleTurn({ decision: "buy", rule: RULE, state: twoNeedsNoObjection, turn: 4, maxTurns: 12 });
    expect(early).toEqual({ outcome: "live", overrode: true, reason: null });
  });

  it("honours a buy once the rule is met", () => {
    expect(settleTurn({ decision: "buy", rule: RULE, state: ready, turn: 6, maxTurns: 12 }).outcome).toBe("won");
  });

  it("ends a meeting that runs out of turns as lost, and honours a walk-away", () => {
    expect(settleTurn({ decision: "continue", rule: RULE, state: ready, turn: 12, maxTurns: 12 }).outcome).toBe("lost");
    expect(settleTurn({ decision: "buy", rule: RULE, state: EMPTY_STATE, turn: 12, maxTurns: 12 })).toMatchObject({ outcome: "lost", overrode: true });
    expect(settleTurn({ decision: "walk_away", rule: RULE, state: EMPTY_STATE, turn: 3, maxTurns: 12 }).outcome).toBe("lost");
  });

  it("tells the buyer privately what is still missing, by label", () => {
    const summary = gateSummary(RULE, twoNeedsNoObjection, OBJECTIONS);
    expect(summary).toMatch(/must NOT agree/);
    expect(summary).toMatch(/Staff will not use it/);
    expect(gateSummary(RULE, ready, OBJECTIONS)).toMatch(/may agree/);
  });
});

describe("parseBuyerReply", () => {
  it("reads the JSON even with prose around it", () => {
    const parsed = parseBuyerReply(
      'Sure.\n{"message":"We lose sales when fast movers run out.","uncovered":[{"key":"stockouts","quote":"about to run out"}],"resolved":[],"decision":"continue"}',
    );
    expect(parsed.message).toBe("We lose sales when fast movers run out.");
    expect(parsed.uncovered).toEqual([{ key: "stockouts", quote: "about to run out" }]);
    expect(parsed.decision).toBe("continue");
  });

  it("treats an unknown decision as continue and malformed claims as none", () => {
    const parsed = parseBuyerReply('{"message":"Fine.","uncovered":[{"key":1},"x"],"decision":"sign now"}');
    expect(parsed.decision).toBe("continue");
    expect(parsed.uncovered).toEqual([]);
  });

  it("falls back to prose that proves nothing and decides nothing", () => {
    expect(parseBuyerReply("Let me think about it.")).toEqual({
      message: "Let me think about it.",
      uncovered: [],
      resolved: [],
      decision: "continue",
    });
  });
});
