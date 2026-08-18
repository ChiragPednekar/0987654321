import "server-only";

import type {
  CaseRow,
  EvaluationFeedback,
  RubricRow,
} from "@/lib/types/database";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompts";
import { callModel } from "./providers";
import { evaluationResponseSchema } from "./schema";

export interface EvaluationResult {
  breakdown: Record<string, number>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  feedback: EvaluationFeedback & { verdict: string };
  model: string;
  tokensUsed: number;
}

type EvaluableCase = Pick<
  CaseRow,
  | "title"
  | "domain"
  | "difficulty"
  | "scenario"
  | "instructions"
  | "supporting_data"
  | "expected_framework"
  | "model_answer"
>;

type EvaluableRubric = Pick<RubricRow, "criteria" | "descriptors" | "max_score">;

const MAX_ATTEMPTS = 3;

/**
 * Grades one answer.
 *
 * Trust boundary: the model is treated as an opinion source for per-criterion
 * points and prose only. Every number it returns is clamped to the rubric, and
 * the total is recomputed here — never read from the model.
 */
export async function evaluateSubmission(
  caseData: EvaluableCase,
  rubric: EvaluableRubric,
  answer: string,
): Promise<EvaluationResult> {
  const criteria = rubric.criteria;
  const user = buildUserPrompt({
    caseData,
    criteria,
    descriptors: rubric.descriptors ?? {},
    answer,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { raw, model, tokensUsed } = await callModel({
        system: SYSTEM_PROMPT,
        user,
        criteria,
      });

      const parsed = evaluationResponseSchema.parse(JSON.parse(raw));

      // Clamp every criterion into [0, weight] and drop anything the model
      // invented that isn't in the rubric.
      const breakdown: Record<string, number> = {};
      for (const [key, weight] of Object.entries(criteria)) {
        const value = Number(parsed.scores[key] ?? 0);
        breakdown[key] = Math.max(
          0,
          Math.min(weight, Number.isFinite(value) ? Math.round(value) : 0),
        );
      }

      // Authoritative arithmetic happens here, not in the model.
      const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
      const maxScore =
        rubric.max_score ||
        Object.values(criteria).reduce((a, b) => a + b, 0);

      return {
        breakdown,
        totalScore,
        maxScore,
        percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
        feedback: {
          strengths: parsed.feedback.strengths.slice(0, 6),
          weaknesses: parsed.feedback.weaknesses.slice(0, 6),
          improvements: parsed.feedback.improvements.slice(0, 6),
          verdict: parsed.verdict,
        },
        model,
        tokensUsed,
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff: 500ms, 1000ms.
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      }
    }
  }

  throw new Error(
    `Evaluation failed after ${MAX_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
