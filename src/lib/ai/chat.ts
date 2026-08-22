import "server-only";

import OpenAI from "openai";

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
}

/** Interviewers should be varied and human, not repeatable like a grader. */
const TEMPERATURE = 0.8;
const MAX_TOKENS = 700;

async function chatOpenAI(
  system: string,
  turns: ChatTurn[],
): Promise<ChatReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  const client = new OpenAI({ apiKey, baseURL });

  const completion = await client.chat.completions.create({
    model,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
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
  };
}

async function chatAnthropic(
  system: string,
  turns: ChatTurn[],
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
      max_tokens: MAX_TOKENS,
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
  };
}

async function chatGemini(
  system: string,
  turns: ChatTurn[],
): Promise<ChatReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((turn) => ({
          // Gemini's word for the assistant is "model".
          role: turn.role === "interviewer" ? "model" : "user",
          parts: [{ text: turn.content }],
        })),
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_TOKENS,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini API error ${response.status}: ${await response.text()}`,
    );
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error("Model returned an empty response");

  return {
    content,
    model,
    tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
  };
}

export function callChat(system: string, turns: ChatTurn[]): Promise<ChatReply> {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();

  switch (provider) {
    case "anthropic":
      return chatAnthropic(system, turns);
    case "gemini":
    case "google":
      return chatGemini(system, turns);
    default:
      return chatOpenAI(system, turns);
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
