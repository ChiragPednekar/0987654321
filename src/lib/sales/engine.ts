/**
 * The rules of a sales role-play, kept out of the model's hands.
 *
 * The buyer is played by a model, and a model can be flattered, pressured or
 * simply worn down into "okay, I'll take it". A role-play where that works
 * teaches the opposite of selling: the lesson is that a buyer commits when
 * their needs have been found and their concerns answered, not when the seller
 * pushes hardest. So, as the negotiation engine does with the walk-away:
 *
 *   - Each scenario has hidden needs and objections, and a buy rule: how many
 *     needs must be uncovered and which objections must be resolved.
 *   - Every turn, the model reports which needs the student uncovered and which
 *     objections they resolved, each with a QUOTE of the student's own words.
 *     A claim whose quote the student never wrote is discarded.
 *   - The buyer may commit only when the buy rule is met. If the model decides
 *     to buy early, the decision is overridden and its reply is replaced.
 *
 * What this cannot stop is a student instructing the model, inside their own
 * message, to report needs as uncovered — the quote would be real. That only
 * inflates their own practice result, and the end-of-session review reads the
 * whole transcript, where such a message is plain to see.
 *
 * Pure: no model, no database. See tests/sales-engine.test.ts.
 */

export interface SalesNeed {
  key: string;
  label: string;
  /** Hidden. What the buyer actually cares about and would say if asked well. */
  detail: string;
}

export interface SalesObjection {
  key: string;
  label: string;
  /** Hidden. The concern, and what a good answer would address. */
  detail: string;
}

export interface BuyRule {
  needsRequired: number;
  /** Objection keys that must be resolved before the buyer can commit. */
  objectionsRequired: string[];
}

export interface SalesState {
  /** need key -> the student's words that uncovered it, and the turn. */
  uncovered: Record<string, { quote: string; turn: number }>;
  /** objection key -> the student's words that resolved it, and the turn. */
  resolved: Record<string, { quote: string; turn: number }>;
}

export interface Claim {
  key: string;
  quote: string;
}

export type ModelDecision = "continue" | "buy" | "walk_away";

export const EMPTY_STATE: SalesState = { uncovered: {}, resolved: {} };

/** A quote shorter than this proves nothing ("yes", "ok, sure"). */
export const MIN_QUOTE_CHARS = 12;

export function normaliseQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^["'.…\s]+|["'.…\s]+$/g, "")
    .trim();
}

/** True if the quote is something the student actually wrote. */
export function quoteIsStudents(quote: string, studentMessages: string[]): boolean {
  const q = normaliseQuote(quote);
  if (q.length < MIN_QUOTE_CHARS) return false;
  return studentMessages.some((m) => normaliseQuote(m).includes(q));
}

/**
 * Folds one turn's claims into the state, keeping only claims about real keys
 * backed by the student's own words. The first quote that uncovered a need is
 * kept — it is the moment that mattered.
 */
export function applyClaims(
  state: SalesState,
  args: {
    needs: SalesNeed[];
    objections: SalesObjection[];
    uncovered: Claim[];
    resolved: Claim[];
    studentMessages: string[];
    turn: number;
  },
): { state: SalesState; rejected: Claim[] } {
  const next: SalesState = {
    uncovered: { ...state.uncovered },
    resolved: { ...state.resolved },
  };
  const rejected: Claim[] = [];
  const needKeys = new Set(args.needs.map((n) => n.key));
  const objectionKeys = new Set(args.objections.map((o) => o.key));

  for (const claim of args.uncovered) {
    if (!needKeys.has(claim.key) || !quoteIsStudents(claim.quote, args.studentMessages)) {
      rejected.push(claim);
      continue;
    }
    next.uncovered[claim.key] ??= { quote: claim.quote.trim(), turn: args.turn };
  }
  for (const claim of args.resolved) {
    if (!objectionKeys.has(claim.key) || !quoteIsStudents(claim.quote, args.studentMessages)) {
      rejected.push(claim);
      continue;
    }
    next.resolved[claim.key] ??= { quote: claim.quote.trim(), turn: args.turn };
  }
  return { state: next, rejected };
}

export function buyRuleMet(rule: BuyRule, state: SalesState): boolean {
  return (
    Object.keys(state.uncovered).length >= rule.needsRequired &&
    rule.objectionsRequired.every((key) => key in state.resolved)
  );
}

/** What is still missing, for the model's private view of the gate. */
export function gateSummary(rule: BuyRule, state: SalesState, objections: SalesObjection[]): string {
  const found = Object.keys(state.uncovered).length;
  const open = rule.objectionsRequired.filter((k) => !(k in state.resolved));
  if (buyRuleMet(rule, state)) {
    return "The seller has earned the right to ask for the business. You may agree to buy if they now make a clear, fair proposal.";
  }
  const parts = [];
  if (found < rule.needsRequired) {
    parts.push(`they have understood ${found} of the ${rule.needsRequired} needs they must uncover`);
  }
  if (open.length > 0) {
    const labels = open.map((k) => objections.find((o) => o.key === k)?.label ?? k);
    parts.push(`these concerns are still unanswered: ${labels.join("; ")}`);
  }
  return `You must NOT agree to buy yet — ${parts.join(", and ")}. Stay interested if they deserve it, but do not commit.`;
}

export const OVERRIDE_REPLY =
  "I can see why you think this fits, but I'm not ready to commit yet. There are things I'd still need to be comfortable with before I take it further.";

export type Outcome = "live" | "won" | "lost";

/**
 * Settles the turn. A premature "buy" is overridden to "continue"; running out
 * of turns without a sale ends the meeting as lost; a walk-away is honoured
 * (the model is told to warn before it walks).
 */
export function settleTurn(args: {
  decision: ModelDecision;
  rule: BuyRule;
  state: SalesState;
  turn: number;
  maxTurns: number;
}): { outcome: Outcome; overrode: boolean; reason: string | null } {
  const met = buyRuleMet(args.rule, args.state);

  if (args.decision === "buy") {
    if (met) return { outcome: "won", overrode: false, reason: "buyer agreed" };
    // Falls through to the turn limit check with the decision overridden.
    if (args.turn >= args.maxTurns) {
      return { outcome: "lost", overrode: true, reason: "meeting ran out of time" };
    }
    return { outcome: "live", overrode: true, reason: null };
  }
  if (args.decision === "walk_away") {
    return { outcome: "lost", overrode: false, reason: "buyer ended the meeting" };
  }
  if (args.turn >= args.maxTurns) {
    return { outcome: "lost", overrode: false, reason: "meeting ran out of time" };
  }
  return { outcome: "live", overrode: false, reason: null };
}

/** Pulls the buyer's structured turn out of a model reply, tolerating prose around the JSON. */
export function parseBuyerReply(raw: string): {
  message: string;
  uncovered: Claim[];
  resolved: Claim[];
  decision: ModelDecision;
} {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      const parsed = JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
      const claims = (value: unknown): Claim[] =>
        Array.isArray(value)
          ? value
              .filter((c): c is { key: unknown; quote: unknown } => !!c && typeof c === "object")
              .filter((c) => typeof c.key === "string" && typeof c.quote === "string")
              .map((c) => ({ key: c.key as string, quote: c.quote as string }))
          : [];
      const decision = parsed.decision === "buy" || parsed.decision === "walk_away" ? parsed.decision : "continue";
      const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
      return {
        message: message || raw.trim(),
        uncovered: claims(parsed.uncovered),
        resolved: claims(parsed.resolved),
        decision,
      };
    } catch {
      // Fall through.
    }
  }
  // Prose with no JSON: the buyer spoke, nothing was proven, nothing decided.
  return { message: raw.trim(), uncovered: [], resolved: [], decision: "continue" };
}
