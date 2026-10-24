/**
 * Provider errors the application needs to tell apart.
 *
 * Almost every model failure is genuinely "something went wrong, try again".
 * A rate limit is not: it is temporary, it is the provider's doing rather than
 * the student's, and it has a known wait. Reporting it as a generic failure
 * sends a student to support over something that fixes itself in forty seconds
 * — and on Gemini's free tier, which allows five requests a minute, it is the
 * failure they will hit most.
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    /** Seconds the provider asked us to wait, when it said. */
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * A daily allowance has run out: the provider's per-day quota (Gemini's free
 * tier allows 20 requests a day per model) or the platform's own ceiling.
 *
 * Still a RateLimitError, so every route treats it as "not your fault, nothing
 * lost" — but "wait a moment" would be untrue for something that resets in
 * hours, so aiBusyMessage() says when it resets instead.
 */
export class DailyLimitError extends RateLimitError {
  constructor(message: string, retryAfterSeconds: number | null) {
    super(message, retryAfterSeconds);
    this.name = "DailyLimitError";
  }
}

/**
 * The platform's own daily ceiling on model calls has been reached.
 */
export class SpendCapError extends DailyLimitError {
  constructor(retryAfterSeconds: number) {
    super("The daily AI limit for the platform has been reached.", retryAfterSeconds);
    this.name = "SpendCapError";
  }
}

/** True when a provider's 429 body names a per-day quota rather than a per-minute one. */
export function isDailyQuota(detail: string): boolean {
  return /PerDay/i.test(detail);
}

/** "about 3 hours", "about 40 minutes", or "within a day" when the provider did not say. */
export function describeReset(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "within a day";
  if (seconds < 55 * 60) return `in about ${Math.max(1, Math.round(seconds / 60))} minutes`;
  const hours = Math.round(seconds / 3600);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * What a student is told when the AI refused for capacity. One wording for
 * every route; each passes what to do again and what was kept, e.g.
 * aiBusyMessage(err, "try again", "nothing was used from your allowance").
 */
export function aiBusyMessage(err: RateLimitError, retry: string, kept: string): string {
  if (err instanceof DailyLimitError) {
    const keptSentence = kept.charAt(0).toUpperCase() + kept.slice(1);
    return `The AI has reached today's usage limit. It resets ${describeReset(err.retryAfterSeconds)} — ${retry} then. ${keptSentence}.`;
  }
  const wait = err.retryAfterSeconds;
  return wait
    ? `The AI is busy. Wait about ${wait} seconds and ${retry} — ${kept}.`
    : `The AI is busy. Wait a moment and ${retry} — ${kept}.`;
}

/** Pulls a retry delay out of whatever shape the provider used to say it. */
export function parseRetryAfter(detail: string): number | null {
  // Gemini returns `"retryDelay": "39s"` inside its error body.
  const gemini = detail.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (gemini) return Math.ceil(Number(gemini[1]));

  // OpenAI and Anthropic prefer a header, which the caller passes through as
  // "retry-after: N" when it has one.
  const header = detail.match(/retry-after[":\s]+(\d+)/i);
  if (header) return Number(header[1]);

  return null;
}
