import { describe, expect, it } from "vitest";
import { CASES } from "../scripts/seed-negotiations";
import { maxJointValue } from "@/lib/negotiation/engine";

/**
 * A negotiation the student cannot win teaches them they negotiated badly when
 * the case was impossible. Every seeded case must have a deal both sides
 * prefer to walking away, and value that only trading across issues finds.
 */

type Terms = Record<string, string>;

function allDeals(c: (typeof CASES)[number]): Terms[] {
  return c.issues.reduce<Terms[]>(
    (deals, issue) => deals.flatMap((d) => issue.options.map((o) => ({ ...d, [issue.key]: o.key }))),
    [{}],
  );
}

const score = (payoffs: Record<string, Record<string, number>>, t: Terms) =>
  Object.entries(t).reduce((s, [issue, option]) => s + (payoffs[issue]?.[option] ?? 0), 0);

describe.each(CASES.map((c) => [c.slug, c] as const))("%s", (_slug, c) => {
  it("scores every option for both sides", () => {
    for (const issue of c.issues) {
      for (const o of issue.options) {
        expect(c.student_payoffs[issue.key]?.[o.key], `${issue.key}/${o.key}`).toBeTypeOf("number");
        expect(c.counterparty_payoffs[issue.key]?.[o.key], `${issue.key}/${o.key}`).toBeTypeOf("number");
      }
    }
  });

  it("has a deal both sides prefer to walking away", () => {
    const winWin = allDeals(c).filter(
      (t) => score(c.student_payoffs, t) > c.student_batna && score(c.counterparty_payoffs, t) > c.counterparty_batna,
    );
    expect(winWin.length).toBeGreaterThan(0);
  });

  it("rewards trading across issues over splitting every one down the middle", () => {
    const middle: Terms = Object.fromEntries(c.issues.map((i) => [i.key, i.options[Math.floor((i.options.length - 1) / 2)].key]));
    const midJoint = score(c.student_payoffs, middle) + score(c.counterparty_payoffs, middle);
    const max = maxJointValue({
      issues: c.issues,
      studentPayoffs: c.student_payoffs,
      counterpartyPayoffs: c.counterparty_payoffs,
      studentBatna: c.student_batna,
      counterpartyBatna: c.counterparty_batna,
    });
    expect(max).toBeGreaterThan(midJoint);
  });
});

it("has unique slugs and a spread of difficulty", () => {
  expect(new Set(CASES.map((c) => c.slug)).size).toBe(CASES.length);
  for (const d of ["easy", "medium", "hard"]) expect(CASES.some((c) => c.difficulty === d)).toBe(true);
});
