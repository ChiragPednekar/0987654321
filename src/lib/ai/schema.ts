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
    required: ["scores", "feedback", "verdict"],
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
    },
  } as const;
}
