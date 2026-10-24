import "server-only";

import OpenAI from "openai";
import { DailyLimitError, isDailyQuota, parseRetryAfter, RateLimitError } from "./errors";

/**
 * Free-form conversational completion for the Case Chat interviewer (spec §6).
 *
 * Deliberately separate from `callModel` in ./providers. That path exists to
 * produce a graded JSON object and pins every provider to a strict schema;
 * an interviewer needs prose and a multi-turn history, and forcing the two
 * through one signature would make both worse. The provider switch is
 * duplicated rather than abstracted because it is nine lines and the two
 * request shapes genuinely differ.
 */

export interface ChatTurn {
  role: "interviewer" | "candidate";
  content: string;
}

export interface ChatReply {
  content: string;
  model: string;
  tokensUsed: number;
  /**
   * The real split. An interview is the expensive operation — many turns, each
   * carrying the whole conversation as input — so pricing it from an assumed
   * 80/20 split was the least defensible estimate in the system.
   */
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

/** Interviewers should be varied and human, not repeatable like a grader. */
const TEMPERATURE = 0.8;

/**
 * Enough for a conversational turn. Callers that need more must say so.
 *
 * The negotiation counterparty asks for JSON carrying a message plus a
 * complete counter-offer, and 700 tokens truncated it mid-object often enough
 * that replies arrived as unparseable text — which silently blocked the
 * counterparty from ever accepting a deal, because the accept flag lives in
 * the JSON that never finished.
 */
const MAX_TOKENS = 700;

async function chatOpenAI(
  system: string,
  turns: ChatTurn[],
  maxTokens: number,
): Promise<ChatReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const client = new OpenAI({ apiKey, baseURL });

  const completion = await client.chat.completions.create({
    model,
    temperature: TEMPERATURE,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      ...turns.map((turn) => ({
        role: (turn.role === "interviewer" ? "assistant" : "user") as
          | "assistant"
          | "user",
        content: turn.content,
      })),
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Model returned an empty response");

  return {
    content,
    model,
    tokensUsed: completion.usage?.total_tokens ?? 0,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
    cachedTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  };
}

async function chatAnthropic(
  system: string,
  turns: ChatTurn[],
  maxTokens: number,
): Promise<ChatReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      // Anthropic takes the system prompt as a top-level field rather than a
      // message, and rejects a conversation that does not start with `user`.
      system,
      messages: turns.map((turn) => ({
        role: turn.role === "interviewer" ? "assistant" : "user",
        content: turn.content,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error ${response.status}: ${await response.text()}`,
    );
  }

  const data = await response.json();
  const content = data.content?.[0]?.text?.trim();
  if (!content) throw new Error("Model returned an empty response");

  return {
    content,
    model,
    tokensUsed:
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    cachedTokens: data.usage?.cache_read_input_tokens ?? 0,
  };
}

/** One Gemini attempt may take this long before it is abandoned and retried. */
const GEMINI_ATTEMPT_MS = 15_000;

class AttemptTimeout extends Error {}

function geminiSleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini for conversational turns, made as sturdy as grading's callGemini.
 *
 * A turn used to be one bare request with no time limit: when Gemini was busy
 * it could sit until the platform killed the route at 60 seconds, and the page
 * — unable to read the gateway's error — left the student watching a spinner.
 * Now each attempt is cut off at GEMINI_ATTEMPT_MS; an overloaded or slow
 * model is retried once, then the request moves to the fallback model, which
 * runs on separate capacity; a 429 (quota) moves straight to the fallback, and
 * a 429 anywhere also earns one try on a lighter model with its own quota. The
 * worst case answers in about 47 seconds, inside the route's 60.
 */
async function chatGemini(
  system: string,
  turns: ChatTurn[],
  maxTokens: number,
): Promise<ChatReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const primary = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const lastResort = process.env.GEMINI_SECOND_FALLBACK_MODEL || "gemini-3.5-flash-lite";
  // Two tries on the primary, one on the fallback, one on a lighter model with
  // its own quota (see providers.ts).
  const plan = primary === fallback ? [primary, primary, primary, lastResort] : [primary, primary, fallback, lastResort];

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((turn) => ({
      // Gemini's word for the assistant is "model".
      role: turn.role === "interviewer" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: maxTokens,
      // No thinking for a conversational turn: it is billed as output,
      // and it counts against maxOutputTokens, so a model that thought
      // for 700 tokens could cut its own reply short.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let lastProblem = "";
  let retryAfter: number | null = null;
  let dailyQuota = false;
  for (let i = 0; i < plan.length; i++) {
    const model = plan[i];
    // A quota on the primary will not lift on a second try; skip to the fallback.
    if (i === 1 && retryAfter !== null && plan[2] !== primary) continue;
    // The lighter model is only for quota exhaustion, which Google refuses
    // instantly. After slow or overloaded attempts it would push the turn past
    // the route's 60 seconds, so it is skipped unless a 429 was seen.
    if (i === 3 && retryAfter === null) continue;
    if (i === 1) await geminiSleep(1_200);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new AttemptTimeout()), GEMINI_ATTEMPT_MS);
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body,
          signal: controller.signal,
        },
      );
    } catch (error) {
      clearTimeout(timer);
      lastProblem = controller.signal.aborted ? `${model} took longer than ${GEMINI_ATTEMPT_MS / 1000}s` : String(error);
      continue;
    }

    try {
      if (!response.ok) {
        const detail = await response.text();
        if (response.status === 429) {
          retryAfter = parseRetryAfter(detail) ?? 0;
          dailyQuota = isDailyQuota(detail);
          lastProblem = `${model} is over its quota`;
          continue;
        }
        if ([500, 502, 503, 504].includes(response.status)) {
          lastProblem = `${model} answered ${response.status}`;
          continue;
        }
        // Our request is wrong; another try would not help.
        throw new Error(`Gemini API error ${response.status}: ${detail}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!content) {
        lastProblem = `${model} returned an empty reply`;
        continue;
      }

      return {
        content,
        model,
        tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
        cachedTokens: data.usageMetadata?.cachedContentTokenCount ?? 0,
      };
    } catch (error) {
      if (error instanceof AttemptTimeout || controller.signal.aborted) {
        lastProblem = `${model} took longer than ${GEMINI_ATTEMPT_MS / 1000}s`;
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  console.error("[ai] Gemini chat unavailable on every attempt", plan, lastProblem);
  if (dailyQuota) {
    throw new DailyLimitError("The AI has reached today's usage limit.", retryAfter || null);
  }
  throw new RateLimitError(
    "The AI interviewer is busy right now. Please try again in a moment.",
    retryAfter !== null && retryAfter > 0 && retryAfter <= 120 ? retryAfter : null,
  );
}


export function callChat(
  system: string,
  turns: ChatTurn[],
  maxTokens: number = MAX_TOKENS,
): Promise<ChatReply> {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

  switch (provider) {
    case "anthropic":
      return chatAnthropic(system, turns, maxTokens);
    case "gemini":
    case "google":
      return chatGemini(system, turns, maxTokens);
    default:
      return chatOpenAI(system, turns, maxTokens);
  }
}

/** The interviewer's brief. */
export function interviewerSystemPrompt(caseData: {
  title: string;
  domain: string;
  difficulty: string;
  scenario: string;
  instructions: string;
  expected_framework: string | null;
  model_answer: string | null;
}) {
  return `You are conducting a live case interview for a management consulting / finance role. The case is "${caseData.title}" (${caseData.domain}, ${caseData.difficulty}).

THE CASE
${caseData.scenario}

WHAT THE CANDIDATE IS ASKED TO DO
${caseData.instructions}
${caseData.expected_framework ? `\nSTRONG APPROACHES USUALLY INVOLVE\n${caseData.expected_framework}` : ""}
${caseData.model_answer ? `\nREFERENCE ANSWER (for your judgement only — never recite it)\n${caseData.model_answer}` : ""}

HOW TO CONDUCT THE INTERVIEW
- You are the interviewer, not a tutor. Ask one question at a time and wait.
- Open by framing the situation in two or three sentences and asking how they would approach it.
- Push on reasoning. When they assert a number, ask where it came from. When they name a framework, ask why that one.
- If they ask a clarifying question, answer it from the case data. If the data does not cover it, tell them to make an assumption and state it.
- Do not confirm whether an answer is right or wrong mid-interview. Stay neutral.
- Never reveal the reference answer, and never do their arithmetic for them.
- If they are badly stuck for two turns, offer one narrow nudge — the next sub-question, not the answer.
- Keep every turn under 120 words. This is a conversation, not a lecture.
- After roughly eight to ten exchanges, or when they give a final recommendation, close the interview: say the interview is complete and give three sentences of feedback — one thing done well, one thing to improve, one concrete next step.`;
}
