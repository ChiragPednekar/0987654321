import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { callChat } from "@/lib/ai/chat";
import { RateLimitError } from "@/lib/ai/errors";

/**
 * The case interviewer, the HR interviewer, negotiations and sales all talk
 * through callChat. A turn used to be one bare request: a busy Gemini could
 * hang it until the platform killed the route, and the student watched a
 * spinner. These pin the retry, the per-attempt time limit and the fallback.
 */

const OK = (text = "Welcome to the case.") =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { totalTokenCount: 9 } }), {
    status: 200,
  });

const TURNS = [{ role: "candidate" as const, content: "I'm ready." }];

describe("Gemini chat turns", () => {
  let calls: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "primary-model");
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "backup-model");
    calls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** Each call takes the next behaviour: a status code, "hang", or a Response. */
  function stub(behaviours: (number | "hang")[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(url.includes("backup-model") ? "backup" : "primary");
        const next = behaviours.shift() ?? 503;
        if (next === "hang") {
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          });
        }
        return Promise.resolve(next === 200 ? OK() : new Response("{}", { status: next }));
      }),
    );
  }

  async function run() {
    const pending = callChat("system", TURNS);
    pending.catch(() => {});
    await vi.runAllTimersAsync();
    return pending;
  }

  it("answers on the first try when Gemini is well", async () => {
    stub([200]);
    expect((await run()).content).toBe("Welcome to the case.");
    expect(calls).toEqual(["primary"]);
  });

  it("retries an overloaded model once", async () => {
    stub([503, 200]);
    expect((await run()).model).toBe("primary-model");
    expect(calls).toEqual(["primary", "primary"]);
  });

  it("gives up on a hung request and tries again instead of waiting forever", async () => {
    stub(["hang", 200]);
    expect((await run()).content).toBe("Welcome to the case.");
    expect(calls).toEqual(["primary", "primary"]);
  });

  it("moves to the fallback model after the primary fails twice", async () => {
    stub([503, "hang", 200]);
    expect((await run()).model).toBe("backup-model");
    expect(calls).toEqual(["primary", "primary", "backup"]);
  });

  it("goes straight to the fallback when the primary is over its quota", async () => {
    stub([429, 200]);
    expect((await run()).model).toBe("backup-model");
    expect(calls).toEqual(["primary", "backup"]);
  });

  it("reports 'busy' — never hangs — when every attempt fails", async () => {
    stub(["hang", "hang", "hang"]);
    await expect(run()).rejects.toBeInstanceOf(RateLimitError);
    expect(calls).toHaveLength(3);
  });

  it("does not retry a request Gemini rejects as malformed", async () => {
    stub([400]);
    await expect(run()).rejects.toThrow(/Gemini API error 400/);
    expect(calls).toEqual(["primary"]);
  });
});
