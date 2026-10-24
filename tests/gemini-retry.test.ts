import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The daily spend cap reads the database; with no admin client it is skipped.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClientOrNull: () => null }));

import { callModel } from "@/lib/ai/providers";
import { aiBusyMessage, DailyLimitError, describeReset, RateLimitError } from "@/lib/ai/errors";

/**
 * Google answers 503 "model is currently experiencing high demand" in busy
 * spells. A student's graded answer must not fail on the first one: the call
 * retries, then moves to the fallback model, and only reports "busy" when both
 * refuse. Pinned here because the failure only shows up under real load.
 */

const OK_BODY = JSON.stringify({
  candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
  usageMetadata: { totalTokenCount: 10, promptTokenCount: 7, candidatesTokenCount: 3 },
});

function reply(status: number, body = "{}") {
  return new Response(status === 200 ? OK_BODY : body, { status });
}

const ARGS = { system: "s", user: "u", criteria: { x: 1 } };

describe("Gemini overload handling", () => {
  let calls: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "primary-model");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "backup-model");
    vi.stubEnv("GEMINI_SECOND_FALLBACK_MODEL", "light-model");
    calls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubFetch(statuses: number[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url.includes("backup-model") ? "backup" : url.includes("light-model") ? "light" : "primary");
        return reply(statuses.shift() ?? 503);
      }),
    );
  }

  async function run() {
    const pending = callModel(ARGS);
    pending.catch(() => {}); // asserted below; keeps the rejection handled while timers run
    await vi.runAllTimersAsync();
    return pending;
  }

  it("retries an overloaded model and succeeds on the same model", async () => {
    stubFetch([503, 503, 200]);
    const result = await run();
    expect(result.model).toBe("primary-model");
    expect(calls).toEqual(["primary", "primary", "primary"]);
  });

  it("moves to the fallback model when the primary stays overloaded", async () => {
    stubFetch([503, 503, 503, 200]);
    const result = await run();
    expect(result.model).toBe("backup-model");
    expect(calls).toEqual(["primary", "primary", "primary", "backup"]);
  });

  it("tries the fallback straight away when the primary is out of quota", async () => {
    stubFetch([429, 200]);
    const result = await run();
    expect(result.model).toBe("backup-model");
    expect(calls).toEqual(["primary", "backup"]);
  });

  it("reports 'busy' — not a generic failure — when every model refuses", async () => {
    stubFetch([503, 503, 503, 503, 503, 503, 503, 503, 503]);
    await expect(run()).rejects.toBeInstanceOf(RateLimitError);
    expect(calls).toHaveLength(9);
  });

  it("falls through to the lighter model when both others are out of quota", async () => {
    stubFetch([429, 429, 200]);
    const result = await run();
    expect(result.model).toBe("light-model");
    expect(calls).toEqual(["primary", "backup", "light"]);
  });

  it("reports a spent daily quota as a daily limit, with when it resets", async () => {
    const daily = JSON.stringify({
      error: {
        details: [
          { violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
          { retryDelay: "10800s" },
        ],
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(daily, { status: 429 })));
    const error = await run().catch((e) => e);
    expect(error).toBeInstanceOf(DailyLimitError);
    expect(error).toBeInstanceOf(RateLimitError); // routes still treat it as "busy, nothing lost"
    expect(aiBusyMessage(error, "try again", "nothing was used from your allowance")).toBe(
      "The AI has reached today's usage limit. It resets in about 3 hours — try again then. Nothing was used from your allowance.",
    );
  });

  it("does not ask a student to wait hours when a daily quota is spent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Please retry in 70714.2s." } }), { status: 429 })),
    );
    const error = await run().catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfterSeconds).toBeNull();
  });

  it("does not retry a request Google rejects as malformed", async () => {
    stubFetch([400]);
    await expect(run()).rejects.toThrow(/Gemini API error 400/);
    expect(calls).toEqual(["primary"]);
  });
});

describe("aiBusyMessage", () => {
  it("keeps the short-wait wording for a per-minute limit", () => {
    expect(aiBusyMessage(new RateLimitError("busy", 40), "send again", "your message is saved")).toBe(
      "The AI is busy. Wait about 40 seconds and send again — your message is saved.",
    );
    expect(aiBusyMessage(new RateLimitError("busy", null), "send again", "your message is saved")).toBe(
      "The AI is busy. Wait a moment and send again — your message is saved.",
    );
  });

  it("says when a daily limit resets, in words a student can use", () => {
    expect(describeReset(null)).toBe("within a day");
    expect(describeReset(30 * 60)).toBe("in about 30 minutes");
    expect(describeReset(3600)).toBe("in about 1 hour");
    expect(describeReset(70714)).toBe("in about 20 hours");
  });
});
