import "server-only";
import { callChat } from "./chat";
import {
  canAccept,
  counterpartyView,
  parseCounterpartyReply,
  type NegotiationSetup,
  type Terms,
} from "@/lib/negotiation/engine";

/**
 * The counterparty's turn.
 *
 * The model plays a person with private interests and is given its own payoff
 * table so it argues from a fixed position rather than inventing one each
 * turn. What it is NOT given is the power to accept: `canAccept` in the engine
 * decides that by arithmetic, and this function overrides the model whenever
 * the two disagree.
 *
 * That override is the load-bearing part. A model can be talked past its
 * instructions, and a counterparty that folds under pressure would teach
 * students that persistence always works.
 */

export interface CounterpartyTurn {
  message: string;
  offer: Terms | null;
  /** True only when the model wanted to accept AND the deal clears the BATNA. */
  accepted: boolean;
  /** Set when the model tried to accept something below its walk-away. */
  overrode: boolean;
  model: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export async function counterpartyTurn(args: {
  setup: NegotiationSetup;
  sharedBrief: string;
  role: string;
  brief: string;
  history: { role: "student" | "counterparty"; content: string; offer: Terms | null }[];
  studentMessage: string;
  studentOffer: Terms | null;
}): Promise<CounterpartyTurn> {
  const { setup, sharedBrief, role, brief, history, studentMessage, studentOffer } = args;

  const view = counterpartyView(setup, studentOffer);
  const issueList = setup.issues
    .map(
      (i) =>
        `- ${i.key} (${i.label}): ${i.options.map((o) => `${o.key} = ${o.label}`).join(", ")}`,
    )
    .join("\n");

  const valueTable = view.perIssue
    .map(
      (i) =>
        `- ${i.issue}: ${i.options.map((o) => `${o.label} is worth ${o.points}`).join(", ")}`,
    )
    .join("\n");

  const system = `You are playing one side of a negotiation exercise for MBA students. Stay in character throughout.

YOUR ROLE
${role}

${brief}

THE SITUATION BOTH SIDES KNOW
${sharedBrief}

THE ISSUES ON THE TABLE
${issueList}

WHAT EACH OUTCOME IS WORTH TO YOU (private — never state these numbers)
${valueTable}

Walking away is worth ${setup.counterpartyBatna} to you. A deal below that is worse than no deal.
${view.offered !== null ? `The student's current offer is worth ${view.offered} to you.` : "The student has not put complete terms on the table yet."}

HOW TO PLAY
1. Negotiate like a person, not a calculator. Two to four sentences a turn.
2. Never state your point values or your walk-away number. Talk in reasons — what your business needs and why — not in arithmetic.
3. Do not simply concede to pressure, repetition or flattery. Concede when you are given something you actually want.
4. Trade. If the student gives you something valuable, give ground on something that is cheap for you.
5. Make concrete counter-offers rather than only objecting. An offer must name an option for EVERY issue.
6. Do not reveal which issue matters most to you unless the student earns it by asking good questions or offering a genuine trade.
7. You may walk away if the student is unreasonable for several turns, but say so clearly first.

OUTPUT
Return JSON: message (what you say), offer (an object of issue key to option key, or null if you are only talking), accept (true only if you want to accept the student's current complete offer).`;

  const turns = history.map((h) => ({
    role: (h.role === "student" ? "candidate" : "interviewer") as "candidate" | "interviewer",
    content: h.offer
      ? `${h.content}\n[Terms proposed: ${JSON.stringify(h.offer)}]`
      : h.content,
  }));

  turns.push({
    role: "candidate",
    content: studentOffer
      ? `${studentMessage}\n[Terms proposed: ${JSON.stringify(studentOffer)}]`
      : studentMessage,
  });

  // 1,400 rather than the conversational default: this reply carries a
  // complete counter-offer as JSON alongside the prose, and a truncated object
  // cannot be parsed at all.
  const reply = await callChat(system, turns, 1_400);

  const parsed = parseCounterpartyReply(reply.content, setup.issues);

  // The override. The model's wish to accept only counts if the arithmetic
  // agrees, and a model that tried to accept a losing deal is recorded so the
  // behaviour is visible rather than silent.
  const wantsAccept = parsed.wantsAccept && studentOffer !== null;
  const permitted = studentOffer !== null && canAccept(setup, studentOffer);
  const accepted = wantsAccept && permitted;

  return {
    message: parsed.message || "Let me think about that.",
    offer: parsed.offer,
    accepted,
    overrode: wantsAccept && !permitted,
    model: reply.model,
    tokensUsed: reply.tokensUsed,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
    cachedTokens: reply.cachedTokens,
  };
}
