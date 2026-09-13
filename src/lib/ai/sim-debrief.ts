import "server-only";
import { z } from "zod";
import { callModel } from "./providers";
import type { Decisions, RoundOutcome } from "@/lib/sim/engine";

/**
 * Reads a finished run and says what the student's pattern of decisions
 * reveals.
 *
 * This is the only model call the simulation makes, and the division of labour
 * is deliberate. The market is arithmetic and belongs in a deterministic
 * engine; "you raised price every time share fell, which is the opposite of
 * what the numbers were telling you" is a judgement about a person, and that
 * is what a model is actually good at.
 *
 * It is given the decisions and the results together, because the interesting
 * feedback is about the relationship between them — whether the student
 * responded to what they saw.
 */

const SCHEMA = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  verdict: z.string(),
});

export interface SimDebrief {
  strengths: string[];
  weaknesses: string[];
  verdict: string;
  model: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

const SYSTEM = `You are debriefing a student who has just finished an eight-quarter business simulation. They ran a manufacturer against two computer-run rivals: Meridian, which competes on price, and Apex, which holds a premium position and invests in the product.

Each quarter the student set four things: price, marketing spend, R&D spend, and capacity investment. You are shown every decision and every result.

WHAT TO LOOK FOR
- Whether they responded to what the results were telling them, or kept doing the same thing while the numbers moved.
- Lost sales. Demand above capacity is revenue that was there and could not be served, and it is the most commonly ignored line in the whole report.
- Whether price cuts actually bought profitable share, or bought volume at a margin that could not carry the fixed costs.
- Whether they let brand or quality decay while spending on capacity, or the reverse.
- Debt: whether it funded growth that paid for itself, or covered losses.

RULES
- Reference specific quarters and numbers from what you were given.
- Weaknesses must say what to do differently, not merely what went wrong.
- Do not invent figures. If something is not in the data, do not claim it.
- Be direct. A student who went bankrupt should be told why in the first sentence.`;

export async function debriefRun(
  rounds: { round: number; decisions: Decisions; outcome: RoundOutcome }[],
  status: "completed" | "bankrupt",
  cumulativeProfit: number,
  finalScoreValue: number,
): Promise<SimDebrief> {
  const crore = (n: number) => `${(n / 10_000_000).toFixed(2)}cr`;

  const table = rounds
    .map((r) => {
      const you = r.outcome.firms[0];
      const rivals = r.outcome.firms
        .slice(1)
        .map((f) => `${f.name} ${f.price}/${f.share}%`)
        .join(" ");
      return [
        `Q${r.round}:`,
        `price ${r.decisions.price}`,
        `mktg ${crore(r.decisions.marketing)}`,
        `R&D ${crore(r.decisions.rnd)}`,
        `capex ${crore(r.decisions.capacityInvestment)}`,
        `| sold ${you.unitsSold}`,
        `lost ${you.lostSales}`,
        `share ${you.share}%`,
        `profit ${crore(you.profit)}`,
        `cash ${crore(you.cash)}`,
        `debt ${crore(you.debt)}`,
        `quality ${you.quality}`,
        `brand ${you.brand}`,
        `| rivals ${rivals}`,
      ].join(" ");
    })
    .join("\n");

  const user = `## Outcome
${status === "bankrupt" ? "The run ended in bankruptcy." : "The run completed all eight quarters."}
Cumulative profit ${crore(cumulativeProfit)}. Final score ${crore(finalScoreValue)}.

## Every quarter
${table}`;

  const { raw, model, tokensUsed, inputTokens, outputTokens, cachedTokens } =
    await callModel({
      system: SYSTEM,
      user,
      criteria: { placeholder: 1 },
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["strengths", "weaknesses", "verdict"],
        properties: {
          strengths: {
            type: "array",
            items: { type: "string" },
            description: "2-4 things the student did well, citing specific quarters.",
          },
          weaknesses: {
            type: "array",
            items: { type: "string" },
            description: "2-4 specific changes for the next run, citing quarters and numbers.",
          },
          verdict: {
            type: "string",
            description: "Three or four sentences on how the run went and what drove the result.",
          },
        },
      },
    });

  const parsed = SCHEMA.parse(JSON.parse(raw));

  return {
    strengths: parsed.strengths.slice(0, 4),
    weaknesses: parsed.weaknesses.slice(0, 4),
    verdict: parsed.verdict,
    model,
    tokensUsed,
    inputTokens,
    outputTokens,
    cachedTokens,
  };
}
