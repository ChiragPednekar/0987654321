import { z } from "zod";
import type { RubricCriteria } from "@/lib/types/database";

/**
 * The shape we ask the model for. Note it does NOT include `total_score` —
 * we compute that ourselves from the per-criterion scores. Models are
 * unreliable at arithmetic and this number decides rankings.
 */
export const evaluationResponseSchema = z.object({
  scores: z.record(z.string(), z.number()),
  feedback: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    improvements: z.array(z.string()),
  }),
  verdict: z.string(),
  /**
   * Optional so a provider or model that omits it still parses. A missing
   * value means "not assessed" and is carried through as null — never as
   * zero, which would read as a positive finding of human authorship.
   */
  ai_likelihood: z.number().min(0).max(100).optional(),
});

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;

/**
 * Builds a strict JSON Schema for the given rubric so the provider's
 * structured-output mode guarantees us exactly the criteria we asked for —
 * no missing keys, no invented ones.
 */
export function buildJsonSchema(criteria: RubricCriteria) {
  const keys = Object.keys(criteria);

  return {
    type: "object",
    additionalProperties: false,
    required: ["scores", "feedback", "verdict", "ai_likelihood"],
    properties: {
      scores: {
        type: "object",
        additionalProperties: false,
        required: keys,
        properties: Object.fromEntries(
          keys.map((key) => [
            key,
            {
              type: "integer",
              minimum: 0,
              maximum: criteria[key],
              description: `Points awarded for ${key.replace(/_/g, " ")}, out of ${criteria[key]}.`,
            },
          ]),
        ),
      },
      feedback: {
        type: "object",
        additionalProperties: false,
        required: ["strengths", "weaknesses", "improvements"],
        properties: {
          strengths: {
            type: "array",
            items: { type: "string" },
            description:
              "2-4 specific things the answer did well. Quote or reference the answer.",
          },
          weaknesses: {
            type: "array",
            items: { type: "string" },
            description:
              "2-4 specific gaps, errors or unsupported claims.",
          },
          improvements: {
            type: "array",
            items: { type: "string" },
            description:
              "2-4 concrete, actionable next steps for the next attempt.",
          },
        },
      },
      verdict: {
        type: "string",
        description:
          "One or two sentences summarising the overall quality of the answer.",
      },
      ai_likelihood: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description:
          "0-100: how strongly the prose resembles unedited AI output. Judge style only, never quality. Formal or second-language English is not evidence. When unsure, answer low.",
      },
    },
  } as const;
}
