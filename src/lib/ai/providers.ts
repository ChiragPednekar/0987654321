import "server-only";

import OpenAI from "openai";
import type { RubricCriteria } from "@/lib/types/database";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { buildJsonSchema } from "./schema";
import { DailyLimitError, isDailyQuota, parseRetryAfter, RateLimitError, SpendCapError } from "./errors";

export interface ProviderResult {
  raw: string;
  model: string;
  tokensUsed: number;
  /**
   * The real split, straight from the provider.
   *
   * Every one of these APIs reports input and output separately and we were
   * throwing it away, keeping only the total — which meant usage accounting
   * fell back to splitting 80/20 by assumption. Output is priced five times
   * input, so an assumed split is an assumed bill, and the admin dashboard was
   * calling it "measured".
   */
  inputTokens: number;
  outputTokens: number;
  /** Input served from the provider's prompt cache, billed at a discount. */
  cachedTokens: number;
}

export interface ProviderArgs {
  system: string;
  user: string;
  criteria: RubricCriteria;
  /**
   * Overrides the schema built from `criteria`.
   *
   * Case grading returns one object keyed by rubric criterion, which
   * buildJsonSchema() constructs from the rubric. A group discussion returns
   * an array of those — one per participant — and that shape cannot be
   * expressed by a criteria map. Rather than bend the GD result into a shape
   * it is not, the caller supplies its own schema and `criteria` is left to
   * serve only as the fallback.
   */
  jsonSchema?: Record<string, unknown>;
  /**
   * A PDF sent alongside the user message, read natively by the model — pages,
   * charts and layout, not just extracted text. Used by the deck critique.
   * Absent for every other caller, whose requests are unchanged.
   */
  pdf?: { name: string; base64: string };
}

/**
 * OpenAI via Structured Outputs. `strict: true` makes the schema a hard
 * guarantee rather than a suggestion, so we never have to repair JSON.
 */
async function callOpenAI({
  system,
  user,
  criteria,
  jsonSchema,
  pdf,
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
      {
        role: "user",
        content: pdf
          ? [
              {
                type: "file" as const,
                file: { filename: pdf.name, file_data: `data:application/pdf;base64,${pdf.base64}` },
              },
              { type: "text" as const, text: user },
            ]
          : user,
      },
    ],
    response_format: strictSchema
      ? {
          type: "json_schema",
          json_schema: {
            name: "case_evaluation",
            strict: true,
            schema: jsonSchema ?? buildJsonSchema(criteria),
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

  const usage = completion.usage;
  return {
    raw,
    model,
    tokensUsed: usage?.total_tokens ?? 0,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
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
  jsonSchema,
  pdf,
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
      messages: [
        {
          role: "user",
          content: pdf
            ? [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } },
                { type: "text", text: user },
              ]
            : user,
        },
      ],
      tools: [
        {
          name: "submit_evaluation",
          description: "Submit the graded evaluation of the student's answer.",
          input_schema: jsonSchema ?? buildJsonSchema(criteria),
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

  const usage = data.usage ?? {};
  return {
    raw: JSON.stringify(toolUse.input),
    model,
    tokensUsed: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    // Anthropic reports cache reads separately from fresh input.
    cachedTokens: usage.cache_read_input_tokens ?? 0,
  };
}

/**
 * Google Gemini. The only major provider with a genuinely free tier, which
 * makes it the default recommendation for getting grading running at zero
 * cost. Structured output uses responseSchema.
 */
/**
 * How many tokens Gemini may spend "thinking" before it grades.
 *
 * Gemini's Flash models think by default, and thinking is billed at the output
 * rate. Measured in production it was 450–3,600 tokens a call — more than the
 * answer itself, and on a three-sentence question 975 tokens of thought for 84
 * of reply. Left unset it roughly doubled the cost of every graded answer, and
 * none of it was counted.
 *
 * Measured on the calibration set (npm run compare:providers, 2026-10-23):
 * thinking off, a 512-token budget and Gemini's default all ranked strong >
 * medium > weak correctly; the default cost 3.9x as much (Rs 0.91 against
 * Rs 0.24 a grade) and took 3x as long. 512 costs the same as off on a normal
 * answer while leaving room to check arithmetic on a long one.
 * GEMINI_THINKING_BUDGET overrides it; 0 turns thinking off, -1 is Gemini's default.
 */
export function gradingThinkingBudget(): number {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  const parsed = raw === undefined || raw === "" ? NaN : Number(raw);
  // -1 is Gemini's own "dynamic" budget — the unrestricted default, kept
  // reachable so the comparison script can measure what it costs.
  return Number.isFinite(parsed) && parsed >= -1 ? Math.floor(parsed) : DEFAULT_THINKING_BUDGET;
}
const DEFAULT_THINKING_BUDGET = 512;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini({
  system,
  user,
  criteria,
  jsonSchema,
  pdf,
}: ProviderArgs): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const primary = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const lastResort = process.env.GEMINI_SECOND_FALLBACK_MODEL || "gemini-3.5-flash-lite";

  // Gemini's responseSchema is an OpenAPI subset: it rejects
  // additionalProperties, so strip it from the shared builder's output.
  const schema = JSON.parse(
    JSON.stringify(jsonSchema ?? buildJsonSchema(criteria)),
    (key, value) => (key === "additionalProperties" ? undefined : value),
  );

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: pdf
          ? [{ inlineData: { mimeType: "application/pdf", data: pdf.base64 } }, { text: user }]
          : [{ text: user }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: gradingThinkingBudget() },
    },
  });

  /**
   * Google answers 503 "model is currently experiencing high demand" in busy
   * spells, and 429 when a quota is hit. Both pass on their own, and failing a
   * student's graded answer on the first one is the wrong trade: so an
   * overloaded model is retried twice with a short backoff, then the request
   * moves to a second model that runs on separate capacity. Only when both
   * are refusing is it reported — as "busy, try again", which is the truth,
   * rather than a generic failure. A 4xx other than 429 is our request being
   * wrong, and retrying it would not help.
   */
  // Each model has its own quota (the free tier allows 20 requests a day per
  // model), so a third, lighter model keeps answering after the other two are
  // spent for the day.
  const models = [...new Set([primary, fallback, lastResort])];
  let response: Response | null = null;
  let model = primary;
  let retryAfter: number | null = null;
  let lastDetail = "";

  attempts: for (const candidate of models) {
    model = candidate;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(attempt === 1 ? 1200 + Math.random() * 400 : 3000 + Math.random() * 800);
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
            body,
          },
        );
      } catch (error) {
        // A dropped connection is treated like an overloaded model.
        lastDetail = error instanceof Error ? error.message : String(error);
        response = null;
        continue;
      }
      if (response.ok) break attempts;

      lastDetail = await response.text();
      if (response.status === 429) {
        // A quota is per model: the fallback may still have room.
        retryAfter = parseRetryAfter(lastDetail);
        continue attempts;
      }
      if (![500, 502, 503, 504].includes(response.status)) {
        throw new Error(`Gemini API error ${response.status}: ${lastDetail}`);
      }
    }
  }

  if (!response?.ok) {
    console.error("[ai] Gemini unavailable on every model", models, lastDetail.slice(0, 1500));
    if (isDailyQuota(lastDetail)) {
      throw new DailyLimitError("The AI has reached today's usage limit.", retryAfter);
    }
    // A short wait is worth telling the student. A long one is a daily quota
    // (the free tier's resets once a day), and "wait about 70714 seconds" helps
    // nobody — so past two minutes the student just hears "busy, try shortly".
    throw new RateLimitError("The AI provider is busy right now.", retryAfter !== null && retryAfter <= 120 ? retryAfter : null);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Model returned an empty response");

  const usage = data.usageMetadata ?? {};
  return {
    raw,
    model,
    tokensUsed: usage.totalTokenCount ?? 0,
    // promptTokenCount already includes cachedContentTokenCount; the cached
    // portion is priced separately below, so it is reported rather than
    // subtracted here.
    inputTokens: usage.promptTokenCount ?? 0,
    // Thinking is billed as output, so it is counted as output: leaving it
    // out made the logged cost of a call about a third of the real one.
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    cachedTokens: usage.cachedContentTokenCount ?? 0,
  };
}

/**
 * Model calls the whole platform may make in any 24 hours.
 *
 * The per-account quota (QUOTA in constants.ts) bounds what one student can
 * spend in a year, and the per-session turn limits bound one session. Neither
 * bounds a bad day: a bug that loops, a burst of accounts, or a route someone
 * finds a way to call repeatedly. This does — a hard stop on the bill,
 * checked before every call. At about Rs 0.72 a call it caps a day at roughly
 * Rs 1,500 by default; AI_DAILY_CALL_CAP raises it when a campus goes live.
 */
const DAILY_CALL_CAP = Number(process.env.AI_DAILY_CALL_CAP) || 2_000;

async function assertUnderDailyCap(): Promise<void> {
  const admin = createAdminClientOrNull();
  if (!admin) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  // Fails open: if the count cannot be read the per-account quota still
  // applies, and refusing every student over a monitoring hiccup is worse.
  if (error) {
    console.error("[ai] daily cap check failed", error.message);
    return;
  }
  if ((count ?? 0) >= DAILY_CALL_CAP) {
    console.error("[ai] daily call cap reached", { count, cap: DAILY_CALL_CAP });
    throw new SpendCapError(60 * 60);
  }
}

export async function callModel(args: ProviderArgs): Promise<ProviderResult> {
  await assertUnderDailyCap();
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
