import { describe, expect, it } from "vitest";
import { batchProgress, latestReviews, roleDomain, scoreReview, summarizeEvidence, weekStart } from "@/lib/placement/core";
import { buildJsonSchema, criterionFeedback } from "@/lib/ai/schema";
import type { PlacementAttempt, PlacementReview } from "@/lib/placement/types";

const attempt = (id: string, pct: number, over: Partial<PlacementAttempt> = {}): PlacementAttempt => ({
  id, assessment_id: "a1", diagnostic_key: null, user_id: `u-${id}`, answer: "", status: "evaluated",
  result: { breakdown: {}, percentage: pct, feedback: { strengths: [], weaknesses: [], improvements: [], verdict: "" } },
  created_at: "2026-10-01T00:00:00Z", evaluated_at: "2026-10-01T00:00:00Z", integrity: null, elapsed_seconds: null, ...over,
});
const review = (id: string, attemptId: string, pct: number, at: string): PlacementReview => ({
  id, attempt_id: attemptId, reviewer_id: "t", scores: {}, percentage: pct, feedback: "", reason: "", created_at: at,
});

describe("faculty review", () => {
  it("scores against the rubric and refuses out-of-range or missing marks", () => {
    const rubric = { analysis: 30, communication: 20 };
    expect(scoreReview(rubric, { analysis: 15, communication: 20 })).toBe(70);
    expect(() => scoreReview(rubric, { analysis: 31, communication: 0 })).toThrow(/between 0 and 30/);
    expect(() => scoreReview(rubric, { analysis: 10 })).toThrow(/every criterion/);
  });

  it("keeps every correction but counts only the latest", () => {
    const latest = latestReviews([
      review("r1", "x", 40, "2026-10-02T00:00:00Z"),
      review("r2", "x", 65, "2026-10-03T00:00:00Z"),
    ]);
    expect(latest.get("x")?.percentage).toBe(65);
  });

  it("measures AI–faculty agreement only on reviewed common assessments", () => {
    const summary = summarizeEvidence(
      [attempt("1", 70), attempt("2", 50), attempt("3", 90, { assessment_id: null, diagnostic_key: "baseline-v1" })],
      [review("r", "1", 60, "2026-10-02T00:00:00Z")],
    );
    expect(summary).toEqual({ evaluated: 2, reviewed: 1, pending: 1, meanReviewDifference: 10 });
  });
});

describe("batch progress", () => {
  const now = Date.parse("2026-10-24T00:00:00Z");
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const members = ["a", "b"].map((u) => ({ user_id: u, classroom_id: "c1", name: "MBA A" }));

  it("compares the last 30 days with the 30 before", () => {
    const scores = [
      ...Array.from({ length: 5 }, () => ({ user_id: "a", percentage: 50, evaluated_at: daysAgo(40) })),
      ...Array.from({ length: 5 }, () => ({ user_id: "b", percentage: 70, evaluated_at: daysAgo(3) })),
    ];
    const [row] = batchProgress(members, scores, now);
    expect(row).toMatchObject({ students: 2, active: 1, earlierAvg: 50, recentAvg: 70 });
  });

  it("reports no figure from fewer than five answers", () => {
    const [row] = batchProgress(members, [{ user_id: "a", percentage: 90, evaluated_at: daysAgo(1) }], now);
    expect(row.recentAvg).toBeNull();
  });
});

describe("plan helpers", () => {
  it("starts the week on Monday", () => {
    expect(weekStart(new Date("2026-10-24T10:00:00Z"))).toBe("2026-10-19");
    expect(weekStart(new Date("2026-10-19T00:30:00Z"))).toBe("2026-10-19");
  });
  it("maps a target role to a case domain", () => {
    expect(roleDomain("Sales & marketing")).toBe("marketing");
    expect(roleDomain(undefined)).toBe("finance");
  });
});

describe("explained scores", () => {
  const rubric = { analysis: 30, recommendation: 30 };

  it("keeps a quote only when the student actually wrote it", () => {
    const notes = criterionFeedback(rubric, {
      analysis: { quote: "“profit fell   from ₹3 lakh”", reason: "Correct.", next_step: "Show the unit maths." },
      recommendation: { quote: "we should raise prices", reason: "Unsupported.", next_step: "Test first." },
      invented_key: { quote: "", reason: "x", next_step: "y" },
    }, "Overall, profit fell from ₹3 lakh to ₹2.2 lakh.");
    expect(notes.analysis.quote).toBe("profit fell   from ₹3 lakh");
    expect(notes.recommendation.quote).toBeNull();
    expect(Object.keys(notes)).toEqual(["analysis", "recommendation"]);
  });

  it("asks for an explanation per criterion with a single-typed quote field", () => {
    const schema = buildJsonSchema(rubric) as { properties: { feedback: { properties: { criterion_feedback: { required: string[]; properties: Record<string, { properties: { quote: { type: unknown } } }> } } } } };
    const cf = schema.properties.feedback.properties.criterion_feedback;
    expect(cf.required).toEqual(["analysis", "recommendation"]);
    // Gemini's responseSchema rejects ["string","null"]; one type per field.
    expect(cf.properties.analysis.properties.quote.type).toBe("string");
  });
});

describe("proof of proctoring", () => {
  it("needs exam mode and a camera that was watching, refused or absent", async () => {
    const { hasProctoringProof, signalsSchema } = await import("@/lib/integrity-request");
    const s = (over: object) => signalsSchema.parse({ proctored: true, cameraRequested: true, ...over });
    expect(hasProctoringProof(s({ cameraGranted: true, cameraSamples: 10 }))).toBe(true);
    expect(hasProctoringProof(s({ cameraDenied: true }))).toBe(true);
    expect(hasProctoringProof(s({ cameraGranted: true, cameraSamples: 0 }))).toBe(false);
    expect(hasProctoringProof(s({ proctored: false, cameraGranted: true, cameraSamples: 10 }))).toBe(false);
    expect(hasProctoringProof(signalsSchema.parse({ proctored: true }))).toBe(false);
  });
});
