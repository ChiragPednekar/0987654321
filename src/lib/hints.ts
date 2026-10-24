/**
 * Progressive hints for a case, built from its expected approach.
 *
 * Every case carries an `expected_framework`: the approach a strong answer
 * takes, usually as numbered steps. Hints reveal it a piece at a time, the way
 * an interviewer nudges — where to start, then the middle, then the rest — and
 * each one revealed costs marks (applied in /api/submissions, capped at 50%).
 *
 * Built from the case's own text rather than written separately, so a hint can
 * never disagree with the approach the grader is comparing against.
 */

export interface BuiltHint {
  step: number;
  body: string;
  penalty_pct: number;
}

/** The cost of each hint, in order: a nudge is cheap, the whole approach is not. */
export const HINT_PENALTIES = [5, 10, 15] as const;

/**
 * The approach as separate points: numbered or bulleted lines when it has
 * them; otherwise "; "-separated phrases; otherwise its paragraphs, or the
 * sentences of a single paragraph. A line
 * that is not a step (a formula above the list, a closing remark) attaches to
 * the nearest step rather than being lost.
 */
export function approachPoints(framework: string): { lead: string[]; points: string[] } {
  const text = framework.replace(/\r/g, "").trim();
  if (!text) return { lead: [], points: [] };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const STEP = /^(?:\d{1,2}[.)]|[-*•])\s+/;
  if (lines.filter((l) => STEP.test(l)).length >= 2) {
    const lead: string[] = [];
    const points: string[] = [];
    for (const line of lines) {
      if (STEP.test(line)) points.push(line.replace(STEP, ""));
      else if (points.length === 0) lead.push(line);
      else points[points.length - 1] += ` ${line}`;
    }
    return { lead, points };
  }

  if (lines.length === 1 && text.includes(";")) {
    return { lead: [], points: text.split(";").map((p) => p.trim()).filter(Boolean) };
  }

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (paragraphs.length > 1) return { lead: [], points: paragraphs };

  // One paragraph of guidance: its sentences are the steps.
  const sentences = paragraphs[0].split(/(?<=[.!?])\s+(?=[A-Z'"‘“(])/).map((x) => x.trim()).filter(Boolean);
  return { lead: [], points: sentences };
}

/** Up to three hints: the first point(s), then the middle, then the rest. */
export function buildHints(framework: string | null | undefined): BuiltHint[] {
  const { lead, points } = approachPoints(framework ?? "");
  if (points.length === 0) return [];

  const groups: string[][] =
    points.length === 1
      ? [points]
      : points.length === 2
        ? [[points[0]], [points[1]]]
        : (() => {
            const first = [points[0]];
            const rest = points.slice(1);
            const mid = Math.ceil(rest.length / 2);
            return [first, rest.slice(0, mid), rest.slice(mid)];
          })();

  const openers = ["Start here", "Then", "To finish"];
  return groups.map((group, i) => {
    const intro = i === 0 && lead.length > 0 ? `${lead.join(" ")}\n\n` : "";
    const body =
      group.length === 1
        ? `${intro}**${openers[i]}:** ${group[0]}`
        : `${intro}**${openers[i]}:**\n\n${group.map((p) => `- ${p}`).join("\n")}`;
    return { step: i + 1, body, penalty_pct: HINT_PENALTIES[i] };
  });
}
