/**
 * How long an AI conversation may run, and how long each message may be.
 *
 * Every turn sends the whole conversation back to the model, so the cost of a
 * session grows with the square of its length. At the old limits (30 turns,
 * 4,000-character messages) one maximal negotiation cost about Rs 90 — and it
 * counted as ONE interview against a plan priced on a few rupees each. These
 * bound the worst session to roughly Rs 12–14 at today's model rates (about
 * double from January 2027), which is what the plan prices in
 * src/lib/pricing.ts are worked out against. Real practice rarely comes near
 * them: a case interviewer that has not reached a recommendation in 15
 * exchanges has gone wrong, and a spoken answer is rarely 1,500 characters.
 *
 * Shared by the routes (which enforce them) and the chat boxes (which show
 * them), so a student is never refused a message the box let them type.
 */
export const CONVERSATION_LIMITS = {
  /** The case interviewer (/api/chat). */
  caseChat: { maxTurns: 15, maxMessageChars: 1_500 },
  /** The personal interviewer. Its length is PI_MAX_QUESTIONS (src/lib/pi.ts). */
  interview: { maxMessageChars: 1_500 },
  negotiation: { maxTurns: 16, maxMessageChars: 1_500 },
  /** Sales role-play. Turns are set per scenario, up to maxTurns. */
  sales: { maxTurns: 14, maxMessageChars: 1_000 },
} as const;
