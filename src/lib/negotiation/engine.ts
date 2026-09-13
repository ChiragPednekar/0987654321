/**
 * Scoring and the acceptance rule for a negotiation exercise.
 *
 * ---------------------------------------------------------------------------
 * Multi-issue on purpose
 * ---------------------------------------------------------------------------
 * A negotiation over one number is pure haggling: whatever one side gains the
 * other loses, and the only skill is nerve. The thing a negotiation course
 * actually teaches is that several issues matter unequally to each side, so
 * trading a cheap concession for an expensive one makes the deal bigger before
 * anyone argues about splitting it.
 *
 * So every case has three or four issues with a private points table per side.
 * Two scores come out: what the student claimed for themselves, and how much
 * total value the pair found. A student can win the argument and still have
 * left money on the table, and that is exactly the lesson.
 *
 * ---------------------------------------------------------------------------
 * The walk-away is code, not a prompt instruction
 * ---------------------------------------------------------------------------
 * The counterparty is played by a model, and a model can be talked into
 * anything — flattery, persistence, a confident assertion that its position is
 * unreasonable. If it could be argued below its own reservation value the
 * exercise would teach students that pressure always works, which is the
 * opposite of true and actively harmful in a real negotiation.
 *
 * So `canAccept` is arithmetic and the route enforces it. The model decides
 * what to say and what to propose; it does not get to decide whether a deal
 * clears its own bottom line.
 *
 * Pure and free of `server-only`: the student's own scorecard is projected in
 * the browser as they build an offer.
 */

export interface IssueOption {
  key: string;
  label: string;
}

export interface Issue {
  key: string;
  label: string;
  options: IssueOption[];
}

/** issueKey -> optionKey -> points, for one side. */
export type PayoffTable = Record<string, Record<string, number>>;

/** issueKey -> optionKey. */
export type Terms = Record<string, string>;

export type Side = "student" | "counterparty";

export interface NegotiationSetup {
  issues: Issue[];
  studentPayoffs: PayoffTable;
  counterpartyPayoffs: PayoffTable;
  studentBatna: number;
  counterpartyBatna: number;
}

/** Points a side gets from a complete set of terms. Missing issues score zero. */
export function scoreTerms(payoffs: PayoffTable, terms: Terms): number {
  let total = 0;
  for (const [issueKey, optionKey] of Object.entries(terms)) {
    total += payoffs[issueKey]?.[optionKey] ?? 0;
  }
  return total;
}

/** Every issue must be settled for an offer to be a deal rather than a gesture. */
export function isComplete(issues: Issue[], terms: Terms): boolean {
  return issues.every((issue) => {
    const chosen = terms[issue.key];
    return Boolean(chosen) && issue.options.some((o) => o.key === chosen);
  });
}

/**
 * The counterparty's bottom line, enforced rather than requested.
 *
 * A deal worth less than walking away is refused no matter how persuasive the
 * conversation was. This is the single rule that makes the exercise honest.
 */
export function canAccept(setup: NegotiationSetup, terms: Terms): boolean {
  if (!isComplete(setup.issues, terms)) return false;
  return scoreTerms(setup.counterpartyPayoffs, terms) >= setup.counterpartyBatna;
}

/** The most total value the two sides could possibly have found together. */
export function maxJointValue(setup: NegotiationSetup): number {
  return setup.issues.reduce((sum, issue) => {
    const best = issue.options.reduce((hi, option) => {
      const joint =
        (setup.studentPayoffs[issue.key]?.[option.key] ?? 0) +
        (setup.counterpartyPayoffs[issue.key]?.[option.key] ?? 0);
      return Math.max(hi, joint);
    }, 0);
    return sum + best;
  }, 0);
}

export interface Scorecard {
  studentScore: number;
  counterpartyScore: number;
  jointValue: number;
  maxJoint: number;
  /** How much of the available value the pair found: the integrative score. */
  efficiencyPct: number;
  /** Beat your own walk-away? Below this, no deal was the better outcome. */
  beatBatna: boolean;
  /** Share of the joint value the student took: the distributive score. */
  claimedPct: number;
}

export function scoreDeal(setup: NegotiationSetup, terms: Terms): Scorecard {
  const studentScore = scoreTerms(setup.studentPayoffs, terms);
  const counterpartyScore = scoreTerms(setup.counterpartyPayoffs, terms);
  const jointValue = studentScore + counterpartyScore;
  const maxJoint = maxJointValue(setup);

  return {
    studentScore,
    counterpartyScore,
    jointValue,
    maxJoint,
    efficiencyPct: maxJoint > 0 ? Math.round((jointValue / maxJoint) * 1000) / 10 : 0,
    beatBatna: studentScore >= setup.studentBatna,
    claimedPct: jointValue > 0 ? Math.round((studentScore / jointValue) * 1000) / 10 : 0,
  };
}

/**
 * What the counterparty would score on a proposed set of terms, and the best
 * it could do on each issue. Fed to the model so it argues from its own
 * interests rather than inventing a position each turn.
 */
export function counterpartyView(setup: NegotiationSetup, terms: Terms | null) {
  return {
    offered: terms ? scoreTerms(setup.counterpartyPayoffs, terms) : null,
    batna: setup.counterpartyBatna,
    perIssue: setup.issues.map((issue) => ({
      issue: issue.label,
      options: issue.options.map((o) => ({
        label: o.label,
        points: setup.counterpartyPayoffs[issue.key]?.[o.key] ?? 0,
        chosen: terms?.[issue.key] === o.key,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Reading the counterparty's reply
// ---------------------------------------------------------------------------

export interface ParsedReply {
  message: string;
  offer: Terms | null;
  /** What the model asked for. Whether it is permitted is decided by canAccept. */
  wantsAccept: boolean;
}

/**
 * Pulls the structured reply out of whatever the model actually returned.
 *
 * Lives here, pure and tested, because getting it wrong is silent and severe:
 * the accept flag travels inside this JSON, so a reply that fails to parse
 * cannot close a deal, and the exercise looks like a counterparty that simply
 * never says yes. That is exactly what happened with a fence-stripping regex —
 * models fence inconsistently, sometimes add a sentence first, and truncate
 * before the closing fence when the reply runs long.
 *
 * Scanning between the first brace and the last handles all four cases.
 */
export function parseCounterpartyReply(raw: string, issues: Issue[]): ParsedReply {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");

  if (first !== -1 && last > first) {
    try {
      const parsed = JSON.parse(raw.slice(first, last + 1)) as {
        message?: unknown;
        offer?: unknown;
        accept?: unknown;
      };
      const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
      const candidate =
        parsed.offer && typeof parsed.offer === "object"
          ? (parsed.offer as Terms)
          : null;

      return {
        message: message || raw.trim(),
        // A partial offer is conversation, not terms.
        offer: candidate && isComplete(issues, candidate) ? candidate : null,
        wantsAccept: parsed.accept === true,
      };
    } catch {
      // Fall through to the prose fallback.
    }
  }

  return { message: raw.trim(), offer: null, wantsAccept: false };
}
