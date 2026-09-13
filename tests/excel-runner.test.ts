import { describe, expect, it } from "vitest";
import {
  compareValues,
  evaluateFormula,
  guardFormula,
  markFormula,
  type CellValue,
  type Grid,
} from "@/lib/excel/runner";
import { ALLOWED, BRIDGED } from "@/lib/excel/functions";

/**
 *      A      | B      | C     | D     | E
 * 1 | Region  | Rep    | Units | Price | Shipped
 * 2 | West    | Asha   | 10    | 5     | TRUE
 * 3 | East    | Bimal  | 20    | 3     | FALSE
 * 4 | West    | Chitra | 7     | 5     | TRUE
 * 5 | North   | Asha   | 12    | 4     | TRUE
 * 6 | East    | Devi   | 5     | 3     | FALSE
 */
const GRID: Grid = [
  ["Region", "Rep", "Units", "Price", "Shipped"],
  ["West", "Asha", 10, 5, true],
  ["East", "Bimal", 20, 3, false],
  ["West", "Chitra", 7, 5, true],
  ["North", "Asha", 12, 4, true],
  ["East", "Devi", 5, 3, false],
];

/**
 * Every expected value here was worked out by hand from the grid above, never
 * read back from the library. That is the entire point of this table.
 *
 * Two libraries sit under this evaluator and they disagree about argument
 * shape, in two ways that both fail SILENTLY:
 *   - a range arrives 2D and formulajs wants it flat (COUNTIFS returned 1
 *     where Excel returns 2);
 *   - the parser special-cases SUMIF and AVERAGEIF, passing its own context
 *     first and leaving the references unresolved (both returned 0).
 * Neither raised an error. Only a hand-computed expectation catches them.
 */
const CASES: Array<[formula: string, expected: CellValue, working: string]> = [
  // Aggregates
  ["SUM(C2:C6)", 54, "10+20+7+12+5"],
  ["AVERAGE(C2:C6)", 10.8, "54/5"],
  ["COUNT(C2:C6)", 5, "five numeric cells"],
  ["COUNTA(A2:A6)", 5, "five non-empty cells"],
  ["MIN(C2:C6)", 5, "Devi"],
  ["MAX(C2:C6)", 20, "Bimal"],
  ["MEDIAN(C2:C6)", 10, "5,7,10,12,20 -> middle is 10"],
  ["STDEV(C2:C6)", 5.80517, "sample sd: sqrt(134.8/4)"],

  // The criteria family — the reason the bridge exists at all
  ['SUMIF(A2:A6,"West",C2:C6)', 17, "10+7"],
  ['SUMIF(C2:C6,">8")', 42, "10+20+12"],
  ['SUMIFS(C2:C6,A2:A6,"West")', 17, "10+7"],
  ['SUMIFS(C2:C6,A2:A6,"East",D2:D6,3)', 25, "20+5"],
  ['SUMIFS(C2:C6,C2:C6,">8")', 42, "10+20+12"],
  ['COUNTIF(A2:A6,"West")', 2, "rows 2 and 4"],
  ['COUNTIFS(A2:A6,"West",C2:C6,">8")', 1, "only the 10"],
  ['AVERAGEIF(A2:A6,"West",C2:C6)', 8.5, "17/2"],
  ['AVERAGEIFS(C2:C6,B2:B6,"Asha")', 11, "(10+12)/2"],
  ['MAXIFS(C2:C6,A2:A6,"East")', 20, "Bimal"],
  ['MINIFS(C2:C6,A2:A6,"East")', 5, "Devi"],

  // Lookups
  ['MATCH("Chitra",B2:B6,0)', 3, "third row of the range"],
  ['INDEX(C2:C6,MATCH("Chitra",B2:B6,0))', 7, "Chitra's units"],
  ['VLOOKUP("Devi",B2:D6,2,FALSE)', 5, "Devi's units"],
  ['VLOOKUP("Bimal",B2:D6,3,FALSE)', 3, "Bimal's price"],
  // Wildcards are honoured by the lookups (and refused for the criteria family, below)
  ['MATCH("Ch*",B2:B6,0)', 3, "Chitra"],
  ['VLOOKUP("De*",B2:D6,2,FALSE)', 5, "Devi's units"],

  // Criteria built by concatenation, which is how a threshold from a cell is written
  ['COUNTIF(C2:C6,">"&AVERAGE(C2:C6))', 2, "above 10.8: 20 and 12"],
  ['SUMIFS(C2:C6,C2:C6,">="&C2)', 42, "at least 10: 10+20+12"],
  ["COUNTIF(A2:A6,A2)", 2, "criterion is a cell holding West"],
  ["ROUND(968700,-3)", 969000, "negative digits round to thousands"],
  ["C2*D2+C3*D3", 110, "cell arithmetic is not range arithmetic"],
  ["SUM(C2:C6)*2", 108, "an operator on a function's result is fine"],
  ["HLOOKUP(\"Units\",C1:E6,2,FALSE)", 10, "first row under the Units header"],

  // Arithmetic across columns
  ["SUMPRODUCT(C2:C6,D2:D6)", 208, "50+60+35+48+15"],
  ["ROUND(AVERAGE(C2:C6),1)", 10.8, "10.8 already"],
  ["ROUNDUP(AVERAGE(C2:C6),0)", 11, "10.8 up"],
  ["ROUNDDOWN(AVERAGE(C2:C6),0)", 10, "10.8 down"],
  ["ABS(C6-C3)", 15, "|5-20|"],
  ["LARGE(C2:C6,2)", 12, "20,12,10,7,5"],
  ["SMALL(C2:C6,2)", 7, "5,7,10,12,20"],
  ["RANK(C2,C2:C6)", 3, "20,12,10 -> 10 is third"],

  // Conditionals
  ['IF(SUM(C2:C6)>50,"big","small")', "big", "54 > 50"],
  ["AND(C2>5,D2>4)", true, "10>5 and 5>4"],
  ["OR(C2>50,D2>4)", true, "second is true"],
  ["NOT(E3)", true, "E3 is FALSE"],
  ['IFS(SUM(C2:C6)>100,"huge",SUM(C2:C6)>50,"big",TRUE,"small")', "big", "54"],
  ['SWITCH(2,1,"one",2,"two","other")', "two", "matches 2"],
  ['IFERROR(1/0,"err")', "err", "division by zero"],

  // Text
  ['TEXTJOIN("-",TRUE,A2:A4)', "West-East-West", "first three regions"],
  ['CONCATENATE(A2," ",B2)', "West Asha", "joined"],
  ["LEN(B4)", 6, "Chitra"],
  ['LEFT(B4,2)', "Ch", "Chitra"],
  ['RIGHT(B4,2)', "ra", "Chitra"],
  ['MID(B4,2,3)', "hit", "Chitra"],
  ['TRIM("  Asha  ")', "Asha", "spaces removed"],
  ['UPPER(A2)', "WEST", "West"],
  ['LOWER(A2)', "west", "West"],
  ['PROPER("west bengal")', "West Bengal", "title case"],
  ['SUBSTITUTE(A2,"est","ELL")', "WELL", "West -> WELL"],
  ['VALUE("12")', 12, "text to number"],
  ['TEXT(1.5,"0.0")', "1.5", "formatted"],

  // Information and dates
  ["ISBLANK(A2)", false, "A2 has West"],
  ["ISNUMBER(C2)", true, "C2 is 10"],
  ["ISTEXT(A2)", true, "A2 is text"],
  ["YEAR(DATE(2024,3,2))", 2024, "from DATE"],
  ["MONTH(DATE(2024,3,2))", 3, "from DATE"],
  ["DAY(DATE(2024,3,2))", 2, "from DATE"],
];

describe("conformance against hand-computed Excel values", () => {
  it.each(CASES)("%s = %s (%s)", (formula, expected) => {
    const guard = guardFormula(formula);
    expect(guard.ok, guard.reason ?? "").toBe(true);

    const result = evaluateFormula(GRID, guard.formula!);
    expect(result.ok, result.error ?? "").toBe(true);

    // Compared through the same routine that marks a student, tolerance and all.
    const comparison = compareValues(expected, result.value!);
    expect(comparison.match, `${formula}: ${comparison.reason ?? ""}`).toBe(true);
  });

  it("exercises every bridged function", () => {
    // A bridged function with no hand-computed case is how a wrong answer key
    // ships. If this fails, add a case above rather than shrinking the list.
    const exercised = new Set<string>();
    for (const [formula] of CASES) {
      for (const match of formula.matchAll(/([A-Za-z][A-Za-z0-9._]*)\s*\(/g)) {
        exercised.add(match[1].toUpperCase());
      }
    }
    const missing = BRIDGED.filter((name) => !exercised.has(name));
    expect(missing, `bridged but never checked: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("guardFormula", () => {
  it("accepts a formula with or without the leading =", () => {
    expect(guardFormula("=SUM(C2:C6)").formula).toBe("SUM(C2:C6)");
    expect(guardFormula("SUM(C2:C6)").formula).toBe("SUM(C2:C6)");
  });

  it("names a substitute for the functions people reach for", () => {
    const result = guardFormula('=XLOOKUP("Devi",B2:B6,C2:C6)');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/INDEX with MATCH/);
  });

  it("refuses a function it has not verified rather than returning #NAME?", () => {
    expect(ALLOWED.has("BETAINV")).toBe(false);
    expect(guardFormula("=BETAINV(0.5,1,2)").ok).toBe(false);
  });

  it("refuses a cross-sheet reference, since there is only one sheet", () => {
    expect(guardFormula("=SUM(Sheet2!A1:A5)").ok).toBe(false);
  });

  it.each([
    "SUM(C2:C6*D2:D6)",
    "SUMPRODUCT((C2:C6)*(D2:D6))",
    "SUMPRODUCT((C2:C6<D2:D6)*1)",
    "SUMPRODUCT(--(A2:A6=\"West\"),C2:C6)",
    "SUM($C$2:$C$6/2)",
    "COUNTA(A:A)-1+B:B",
  ])("refuses range arithmetic the parser would silently get wrong: %s", (formula) => {
    // Each of these returns a plausible wrong number rather than an error.
    const result = guardFormula(formula);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/SUMPRODUCT\(C2:C6,D2:D6\)/);
  });

  it.each(['COUNTIF(B2:B6,"A*")', 'SUMIFS(C2:C6,B2:B6,"?sha")', 'SUMIF(B2:B6,"*"&A2,C2:C6)'])(
    "refuses wildcards in the criteria family, which return 0: %s",
    (formula) => {
      const result = guardFormula(formula);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Wildcards/);
    },
  );

  it("does not mistake operators inside a criterion string for range arithmetic", () => {
    expect(guardFormula('=COUNTIFS(C2:C6,">=8",A2:A6,"<>West")').ok).toBe(true);
    expect(guardFormula('=SUBSTITUTE(A2,"*","-")').ok).toBe(true);
  });

  it("refuses an empty formula", () => {
    expect(guardFormula("   ").ok).toBe(false);
    expect(guardFormula("=").ok).toBe(false);
  });

  it("allows a bare constant, which the second grid is there to catch", () => {
    // Not the guard's job. 17 is a legal formula; what exposes it as a typed-in
    // answer is that it stays 17 when the numbers underneath change.
    expect(guardFormula("=17").ok).toBe(true);
  });
});

describe("evaluateFormula", () => {
  it("reports Excel's own error text", () => {
    const result = evaluateFormula(GRID, 'VLOOKUP("Nobody",B2:D6,2,FALSE)');
    expect(result.ok).toBe(false);
    expect(result.error).toBe("#N/A");
  });

  it("reports a division by zero rather than returning infinity", () => {
    const result = evaluateFormula(GRID, "C2/(C2-C2)");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("#DIV/0!");
  });

  it("evaluates from a cell beyond the data, so a whole-column reference works", () => {
    // If the answer cell sat inside column A this would be a circular reference.
    const result = evaluateFormula(GRID, "COUNTA(A:A)");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(6); // the header plus five rows
  });

  it("does not let a bare range stand in for an answer", () => {
    // The parser resolves a bare range by implicit intersection rather than
    // returning an array, so a student who submits one gets a blank or a
    // #VALUE! — never a number that happens to look right.
    expect(evaluateFormula(GRID, "A1:B2").ok).toBe(false);

    const single = evaluateFormula(GRID, "C2:C6");
    expect(single.ok).toBe(true);
    expect(compareValues(54, single.value!).match).toBe(false);
  });
});

describe("compareValues", () => {
  it("tolerates float drift but not a rounding mistake", () => {
    expect(compareValues(10.8, 10.799999999999999).match).toBe(true);
    expect(compareValues(10.8, 10.79).match).toBe(false);
  });

  it("ignores case and surrounding space in text", () => {
    expect(compareValues("West", " west ").match).toBe(true);
    expect(compareValues("West", "East").match).toBe(false);
  });

  it("does not accept text where a number is expected", () => {
    const result = compareValues(17, "17");
    expect(result.match).toBe(false);
    expect(result.reason).toMatch(/Expected a number/);
  });

  it("treats a blank and an empty string as the same", () => {
    expect(compareValues(null, "").match).toBe(true);
  });
});

describe("markFormula", () => {
  // Same shape and headers as GRID, different numbers: West is 4+9 = 13 here.
  const HIDDEN: Grid = [
    ["Region", "Rep", "Units", "Price", "Shipped"],
    ["West", "Asha", 4, 6, true],
    ["East", "Bimal", 11, 2, false],
    ["West", "Chitra", 9, 6, false],
    ["North", "Asha", 3, 5, true],
    ["East", "Devi", 8, 2, true],
  ];
  const exercise = {
    grid: GRID,
    hidden_grid: HIDDEN,
    solution_formula: '=SUMIFS(C2:C6,A2:A6,"West")',
    tolerance: 0.000001,
  };

  it("accepts a different formula that computes the same thing", () => {
    const verdict = markFormula(exercise, '=SUMIF(A2:A6,"West",C2:C6)');
    expect(verdict).toEqual({ correct: true, value: 17 });
  });

  it("catches a typed-in constant on the hidden grid", () => {
    // The control that proves the check can fail: 17 is right on GRID.
    const verdict = markFormula(exercise, "=17");
    expect(verdict.correct).toBe(false);
    expect(verdict.correct === false && verdict.stage).toBe("hidden");
  });

  it("catches a formula that hardcodes the rows it happens to see", () => {
    // C2+C4 is West on GRID; on HIDDEN it is still 4+9, so it passes — which is
    // exactly why the seeder must shuffle which rows are West. Here it does not.
    const shuffled: Grid = HIDDEN.map((row, i) =>
      i === 2 ? ["West", "Bimal", 11, 2, false] : i === 3 ? ["East", "Chitra", 9, 6, false] : row,
    );
    const verdict = markFormula({ ...exercise, hidden_grid: shuffled }, "=C2+C4");
    expect(verdict.correct === false && verdict.stage).toBe("hidden");
  });

  it("reports a wrong answer on the visible grid with the value it got", () => {
    const verdict = markFormula(exercise, '=SUMIFS(C2:C6,A2:A6,"East")');
    expect(verdict).toMatchObject({ correct: false, stage: "visible", value: 25 });
  });

  it("refuses a function off the allow-list before evaluating", () => {
    const verdict = markFormula(exercise, '=XLOOKUP("West",A2:A6,C2:C6)');
    expect(verdict).toMatchObject({ correct: false, stage: "refused" });
  });

  it("reports an evaluation error as the student's error", () => {
    const verdict = markFormula(exercise, "=C2/0");
    expect(verdict).toMatchObject({ correct: false, stage: "error", error: "#DIV/0!" });
  });

  it("blames the exercise, not the student, when the reference is broken", () => {
    const verdict = markFormula({ ...exercise, solution_formula: "=C2/0" }, "=17");
    expect(verdict).toMatchObject({ correct: false, stage: "misconfigured" });
  });

  it("reads a tolerance that arrives from Postgres as a string", () => {
    const verdict = markFormula(
      { ...exercise, solution_formula: "=AVERAGE(C2:C6)", tolerance: "0.01" },
      "=10.805",
    );
    // 10.805 is within 1% of 10.8 on the visible grid, and a constant on the hidden one.
    expect(verdict.correct === false && verdict.stage).toBe("hidden");
  });
});
