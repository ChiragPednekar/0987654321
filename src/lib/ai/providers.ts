import "server-only";

import OpenAI from "openai";
import type { RubricCriteria } from "@/lib/types/database";
import { buildJsonSchema } from "./schema";

export interface ProviderResult {
  raw: string;
  model: string;
  tokensUsed: number;
}

export interface ProviderArgs {
  system: string;
  user: string;
  criteria: RubricCriteria;
}

/**
 * OpenAI via Structured Outputs. `strict: true` makes the schema a hard
 * guarantee rather than a suggestion, so we never have to repair JSON.
 */
async function callOpenAI({
  system,
  user,
  criteria,
}: ProviderArgs): Promise<ProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // OPENAI_BASE_URL points the same client at any OpenAI-compatible endpoint —
  // Groq, OpenRouter, Together, or a local Ollama — which is how the free
  // options are reached without a second client implementation.
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const client = new OpenAI({ apiKey, baseURL });

  // Only OpenAI itself reliably implements strict json_schema. Compatible
  // gateways mostly support plain JSON mode, so ask for the weaker guarantee
  // there and let the zod parse plus retry loop catch anything malformed.
  const strictSchema = !baseURL;

  const completion = await client.chat.completions.create({
    model,
    // Deterministic-ish: the same answer should get the same grade.
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: strictSchema
      ? {
          type: "json_schema",
          json_schema: {
            name: "case_evaluation",
            strict: true,
            schema: buildJsonSchema(criteria),
          },
        }
      : { type: "json_object" },
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error("Model response was truncated before completing the JSON");
  }

  const raw = choice?.message?.content;
  if (!raw) throw new Error("Model returned an empty response");

  return {
    raw,
    model,
    tokensUsed: completion.usage?.total_tokens ?? 0,
  };
}

/**
 * Anthropic via a forced tool call, which gives the same schema guarantee.
 * Set AI_PROVIDER=anthropic to use this path.
 */
async function callAnthropic({
  system,
  user,
  criteria,
}: ProviderArgs): Promise<ProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
      tools: [
        {
          name: "submit_evaluation",
          description: "Submit the graded evaluation of the student's answer.",
          input_schema: buildJsonSchema(criteria),
        },
      ],
      tool_choice: { type: "tool", name: "submit_evaluation" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === "tool_use",
  );

  if (!toolUse) throw new Error("Model did not return a tool call");

  return {
    raw: JSON.stringify(toolUse.input),
    model,
    tokensUsed:
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
  };
}

/**
 * Google Gemini. The only major provider with a genuinely free tier, which
 * makes it the default recommendation for getting grading running at zero
 * cost. Structured output uses responseSchema.
 */
async function callGemini({
  system,
  user,
  criteria,
}: ProviderArgs): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  // Gemini's responseSchema is an OpenAPI subset: it rejects
  // additionalProperties, so strip it from the shared builder's output.
  const schema = JSON.parse(
    JSON.stringify(buildJsonSchema(criteria)),
    (key, value) => (key === "additionalProperties" ? undefined : value),
  );

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Model returned an empty response");

  return {
    raw,
    model,
    tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
  };
}

export function callModel(args: ProviderArgs): Promise<ProviderResult> {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

  switch (provider) {
    case "anthropic":
      return callAnthropic(args);
    case "gemini":
    case "google":
      return callGemini(args);
    // "openai" and any OpenAI-compatible gateway (groq, openrouter, ollama)
    // share one path, differing only by OPENAI_BASE_URL.
    default:
      return callOpenAI(args);
  }
}
