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
          /**
           * maxItems is a cost control as much as a formatting one.
           *
           * The descriptions asked for "2-4" but nothing enforced it, so the
           * ceiling was whatever the model felt like returning. Output tokens
           * are priced five times input here, which makes the feedback lists
           * the single most expensive part of a grading — 20% of the tokens
           * and 55% of the bill.
           *
           * Three is also the better answer for the student. Nine specific
           * criticisms do not get acted on; three do.
           */
          strengths: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
            description:
              "2-3 specific things the answer did well. Reference what the student actually wrote. One sentence each.",
          },
          weaknesses: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
            description:
              "2-3 specific gaps, errors or unsupported claims. One sentence each.",
          },
          improvements: {
            type: "array",
            items: { type: "string" },
            maxItems: 3,
            description:
              "2-3 concrete, actionable next steps. One sentence each.",
          },
        },
      },
      verdict: {
        type: "string",
        description:
          "One sentence summarising the overall quality of the answer.",
      },
    },
  } as const;
}
