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
