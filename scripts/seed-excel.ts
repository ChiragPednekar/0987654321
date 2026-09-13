/**
 * Seeds Excel exercises.
 *
 *   npm run seed:excel
 *   npm run seed:excel -- --dry-run     (validate only; no database needed)
 *
 * Every exercise carries two grids: the one the student sees and a hidden one
 * with the same shape and headers but different numbers, in a different row
 * order. Nothing reaches the database unless all of these hold:
 *
 *   1. Both grids have the same dimensions and the same header row. An honest
 *      formula over C2:C13 must never fail because the hidden grid is longer.
 *   2. The reference formula passes the allow-list guard and evaluates to a
 *      non-blank value on both grids.
 *   3. Its answers differ between the grids — otherwise typing the visible
 *      answer in would pass, and the hidden grid proves nothing.
 *   4. Every `controls` formula (the cells a student could add up by eye, or a
 *      lookup pinned to one row) passes the visible grid and fails the hidden
 *      one. A control that fails the visible grid is not a control at all.
 *   5. Every `alternates` formula — a different but correct way to write it —
 *      is marked correct. That is the "evaluated, not read" promise, checked.
 *
 * Idempotent on slug.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import {
  evaluateFormula,
  guardFormula,
  markFormula,
  type Grid,
} from "../src/lib/excel/runner";

config({ path: ".env.local" });
config({ path: ".env" });

// ---- Sales ledger ------------------------------------------------------------
// Unit price is fixed per product, so revenue questions have one right answer.

const SALES_HEADER = ["Order ID", "Region", "Rep", "Product", "Units", "Unit price (₹)"];

const SALES: Grid = [
  SALES_HEADER,
  [1001, "West", "Asha", "Router", 12, 2400],
  [1002, "East", "Bimal", "Switch", 30, 900],
  [1003, "North", "Chitra", "Router", 8, 2400],
  [1004, "West", "Devi", "Cable", 50, 150],
  [1005, "South", "Asha", "Switch", 22, 900],
  [1006, "East", "Farhan", "Router", 15, 2400],
  [1007, "West", "Chitra", "Switch", 18, 900],
  [1008, "North", "Bimal", "Cable", 40, 150],
  [1009, "South", "Devi", "Router", 10, 2400],
  [1010, "East", "Asha", "Cable", 60, 150],
  [1011, "West", "Farhan", "Router", 9, 2400],
  [1012, "North", "Devi", "Switch", 25, 900],
];

/** Same order ids and people, shuffled rows, reassigned regions and products. */
const SALES_HIDDEN: Grid = [
  SALES_HEADER,
  [1007, "North", "Chitra", "Switch", 28, 900],
  [1003, "West", "Chitra", "Cable", 45, 150],
  [1010, "East", "Asha", "Router", 13, 2400],
  [1001, "East", "Asha", "Switch", 20, 900],
  [1012, "West", "Devi", "Router", 6, 2400],
  [1005, "South", "Asha", "Router", 7, 2400],
  [1009, "South", "Devi", "Cable", 55, 150],
  [1002, "West", "Bimal", "Router", 14, 2400],
  [1011, "North", "Farhan", "Switch", 19, 900],
  [1006, "North", "Farhan", "Cable", 35, 150],
  [1004, "North", "Devi", "Router", 11, 2400],
  [1008, "West", "Bimal", "Switch", 16, 900],
];

// ---- Employee roster ---------------------------------------------------------

const PEOPLE_HEADER = ["Emp ID", "Name", "Department", "Salary (₹)", "Rating", "Joined"];

const PEOPLE: Grid = [
  PEOPLE_HEADER,
  ["E101", "Kavya Iyer", "Finance", 1250000, 4, 2019],
  ["E102", "Rahul Mehta", "Sales", 820000, 3, 2021],
  ["E103", "Sana Khan", "Operations", 960000, 5, 2018],
  ["E104", "Arjun Pillai", "Finance", 1480000, 3, 2016],
  ["E105", "Neha Gupta", "Sales", 913000, 5, 2020],
  ["E106", "Vivek Rao", "Operations", 780000, 2, 2022],
  ["E107", "Isha Nair", "Finance", 1100000, 5, 2021],
  ["E108", "Kunal Shah", "Sales", 1024400, 4, 2017],
  ["E109", "Pooja Das", "Operations", 1150000, 4, 2019],
  ["E110", "Aman Verma", "Sales", 690000, 2, 2023],
];

const PEOPLE_HIDDEN: Grid = [
  PEOPLE_HEADER,
  ["E105", "Neha Gupta", "Operations", 870000, 3, 2019],
  ["E102", "Rahul Mehta", "Finance", 1340000, 4, 2018],
  ["E109", "Pooja Das", "Sales", 760000, 5, 2022],
  ["E101", "Kavya Iyer", "Sales", 990000, 2, 2020],
  ["E107", "Isha Nair", "Operations", 1210000, 4, 2016],
  ["E110", "Aman Verma", "Finance", 1060000, 5, 2021],
  ["E103", "Sana Khan", "Finance", 1520000, 3, 2017],
  ["E106", "Vivek Rao", "Sales", 724600, 4, 2023],
  ["E104", "Arjun Pillai", "Operations", 940000, 5, 2018],
  ["E108", "Kunal Shah", "Operations", 1180000, 2, 2020],
];

// ---- Stores inventory --------------------------------------------------------

const STOCK_HEADER = ["SKU", "Item", "On hand", "Reorder level", "Unit cost (₹)", "Bin code"];

const STOCK: Grid = [
  STOCK_HEADER,
  ["S-01", "Bearings", 120, 100, 45, "PNQ-0012-A"],
  ["S-02", "Gaskets", 35, 60, 12, "BOM-0340-C"],
  ["S-03", "Valves", 18, 25, 850, "PNQ-0077-B"],
  ["S-04", "Seals", 240, 150, 8, "MAA-0042-B"],
  ["S-05", "Filters", 40, 40, 230, "BOM-0105-A"],
  ["S-06", "Belts", 9, 20, 560, "DEL-0231-C"],
  ["S-07", "Hoses", 75, 50, 140, "MAA-0198-A"],
  ["S-08", "Clamps", 300, 400, 3, "DEL-0006-B"],
];

const STOCK_HIDDEN: Grid = [
  STOCK_HEADER,
  ["S-05", "Filters", 22, 40, 230, "DEL-0118-B"],
  ["S-01", "Bearings", 80, 100, 45, "BOM-0009-A"],
  ["S-07", "Hoses", 48, 50, 140, "PNQ-0264-C"],
  ["S-03", "Valves", 30, 25, 850, "MAA-0051-A"],
  ["S-08", "Clamps", 450, 400, 3, "PNQ-0310-B"],
  ["S-04", "Seals", 90, 150, 8, "BOM-0187-C"],
  ["S-02", "Gaskets", 55, 60, 12, "DEL-0023-A"],
  ["S-06", "Belts", 12, 20, 560, "MAA-0402-B"],
];

type Exercise = {
  slug: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  grid: Grid;
  hidden_grid: Grid;
  solution_formula: string;
  hint?: string;
  /** Formulas that only fit the visible grid. Each must pass it and fail the hidden one. */
  controls: string[];
  /** Different, correct formulas. Each must be marked correct. */
  alternates: string[];
};

const EXERCISES: Exercise[] = [
  {
    slug: "excel-order-lookup",
    title: "Look up one order",
    topic: "lookup",
    difficulty: "easy",
    prompt: "In H2, return the number of units in order 1009.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: "=VLOOKUP(1009,A2:F13,5,FALSE)",
    hint: "VLOOKUP with FALSE for an exact match. Units is the fifth column of A:F.",
    controls: ["=E10"],
    alternates: ["=INDEX(E2:E13,MATCH(1009,A2:A13,0))"],
  },
  {
    slug: "excel-units-by-region",
    title: "Units sold in one region",
    topic: "conditional sums",
    difficulty: "easy",
    prompt: "In H2, return the total units sold in the West region.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=SUMIFS(E2:E13,B2:B13,"West")',
    hint: "SUMIFS takes the range to add first, then pairs of criteria range and criterion.",
    controls: ["=E2+E5+E8+E12"],
    alternates: ['=SUMIF(B2:B13,"West",E2:E13)'],
  },
  {
    slug: "excel-bin-code-number",
    title: "Pull a number out of a code",
    topic: "text",
    difficulty: "easy",
    prompt:
      "Bin codes look like PNQ-0012-A. In H2, return the four-digit number from the bin code of SKU S-04, as a number rather than text.",
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=VALUE(MID(VLOOKUP("S-04",A2:F9,6,FALSE),5,4))',
    hint: "Look up the code first, then MID from the fifth character for four characters, then VALUE.",
    controls: ["=VALUE(MID(F5,5,4))"],
    alternates: ['=VALUE(MID(INDEX(F2:F9,MATCH("S-04",A2:A9,0)),5,4))'],
  },
  {
    slug: "excel-count-large-orders",
    title: "Count the large orders",
    topic: "counting",
    difficulty: "easy",
    prompt:
      "In H2, count the orders of 20 units or more, leaving out cables — they are cheap and ordered in bulk.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=COUNTIFS(E2:E13,">=20",D2:D13,"<>Cable")',
    hint: 'COUNTIFS with two conditions. "<>Cable" means "not Cable".',
    controls: [],
    alternates: [
      '=COUNTIFS(E2:E13,">=20",D2:D13,"Router")+COUNTIFS(E2:E13,">=20",D2:D13,"Switch")',
    ],
  },
  {
    slug: "excel-top-finance-salary",
    title: "Highest salary in a department",
    topic: "conditional sums",
    difficulty: "medium",
    prompt: "In H2, return the highest salary in the Finance department.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=MAXIFS(D2:D11,C2:C11,"Finance")',
    hint: "MAXIFS works like SUMIFS: the range to take the maximum of, then the condition.",
    controls: ["=D5"],
    alternates: [],
  },
  {
    slug: "excel-average-switch-order",
    title: "Average order size, rounded",
    topic: "averages",
    difficulty: "medium",
    prompt:
      "In H2, return the average number of units per Switch order, rounded to one decimal place.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=ROUND(AVERAGEIFS(E2:E13,D2:D13,"Switch"),1)',
    hint: "AVERAGEIFS, wrapped in ROUND(...,1). The rounding is part of the answer.",
    controls: ["=ROUND(AVERAGE(E3,E6,E8,E13),1)"],
    alternates: ['=ROUND(SUMIFS(E2:E13,D2:D13,"Switch")/COUNTIF(D2:D13,"Switch"),1)'],
  },
  {
    slug: "excel-total-revenue",
    title: "Total revenue",
    topic: "arrays",
    difficulty: "medium",
    prompt: "Revenue for an order is units times unit price. In H2, return total revenue across all orders.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: "=SUMPRODUCT(E2:E13,F2:F13)",
    hint: "SUMPRODUCT multiplies two ranges row by row and adds the results, with no helper column.",
    controls: [],
    alternates: ["=SUMPRODUCT(F2:F13,E2:E13)"],
  },
  {
    slug: "excel-largest-order-region",
    title: "Where the biggest order came from",
    topic: "lookup",
    difficulty: "medium",
    prompt: "In H2, return the region of the single largest order by units.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: "=INDEX(B2:B13,MATCH(MAX(E2:E13),E2:E13,0))",
    hint: "VLOOKUP cannot look left of its key. INDEX over Region with MATCH on the maximum can.",
    controls: ["=B11"],
    alternates: [],
  },
  {
    slug: "excel-reorder-quantity",
    title: "How much to reorder",
    topic: "lookup",
    difficulty: "medium",
    prompt:
      "In H2, return how many units of SKU S-03 must be ordered to bring it back up to its reorder level. If it is already at or above that level, return 0.",
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=MAX(0,VLOOKUP("S-03",A2:F9,4,FALSE)-VLOOKUP("S-03",A2:F9,3,FALSE))',
    hint: "Reorder level minus on hand. MAX(0, ...) stops a surplus coming back as a negative.",
    controls: ["=D4-C4", "=MAX(0,D4-C4)"],
    alternates: [
      '=IF(VLOOKUP("S-03",A2:F9,3,FALSE)<VLOOKUP("S-03",A2:F9,4,FALSE),VLOOKUP("S-03",A2:F9,4,FALSE)-VLOOKUP("S-03",A2:F9,3,FALSE),0)',
    ],
  },
  {
    slug: "excel-costly-stock",
    title: "The most expensive well-stocked item",
    topic: "conditional sums",
    difficulty: "medium",
    prompt: "In H2, return the highest unit cost among items with more than 50 units on hand.",
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=MAXIFS(E2:E9,C2:C9,">50")',
    hint: 'MAXIFS with a comparison as the criterion: ">50", in quotes.',
    controls: ["=E8"],
    alternates: [],
  },
  {
    slug: "excel-salary-rank",
    title: "Rank one salary",
    topic: "ranking",
    difficulty: "medium",
    prompt:
      "In H2, return where employee E107's salary ranks in the company, with 1 as the highest salary.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=RANK(VLOOKUP("E107",A2:F11,4,FALSE),D2:D11)',
    hint: "Look up the salary, then RANK it against the whole Salary column. RANK is descending by default.",
    controls: ["=RANK(D8,D2:D11)"],
    alternates: ['=COUNTIF(D2:D11,">"&VLOOKUP("E107",A2:F11,4,FALSE))+1'],
  },
  {
    slug: "excel-promotion-flag",
    title: "Flag a promotion case",
    topic: "conditionals",
    difficulty: "hard",
    prompt:
      'An employee is marked "Promote" if their rating is 4 or higher and they joined in 2020 or earlier; otherwise "Hold". In H2, return the flag for employee E107.',
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula:
      '=IF(AND(VLOOKUP("E107",A2:F11,5,FALSE)>=4,VLOOKUP("E107",A2:F11,6,FALSE)<=2020),"Promote","Hold")',
    hint: "IF around AND, with one lookup for the rating and one for the year joined.",
    controls: ['=IF(AND(E8>=4,F8<=2020),"Promote","Hold")'],
    alternates: [
      '=IF(VLOOKUP("E107",A2:F11,5,FALSE)<4,"Hold",IF(VLOOKUP("E107",A2:F11,6,FALSE)>2020,"Hold","Promote"))',
    ],
  },
  {
    slug: "excel-rounded-average-salary",
    title: "Average salary of top performers",
    topic: "averages",
    difficulty: "hard",
    prompt:
      "In H2, return the average salary of Sales employees rated 4 or above, rounded to the nearest thousand rupees.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=ROUND(AVERAGEIFS(D2:D11,C2:C11,"Sales",E2:E11,">=4"),-3)',
    hint: "AVERAGEIFS with two conditions. ROUND with -3 digits rounds to thousands.",
    controls: ["=ROUND(AVERAGE(D6,D9),-3)"],
    alternates: ['=ROUND(AVERAGEIFS(D2:D11,E2:E11,">3",C2:C11,"Sales"),-3)'],
  },
  {
    slug: "excel-rep-share",
    title: "One rep's share of volume",
    topic: "conditional sums",
    difficulty: "hard",
    prompt:
      "In H2, return Asha's share of all units sold, as a percentage rounded to one decimal place (so 31.4, not 0.314).",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=ROUND(SUMIFS(E2:E13,C2:C13,"Asha")/SUM(E2:E13)*100,1)',
    hint: "Asha's units over total units, times 100, then ROUND to one decimal.",
    controls: ["=ROUND((E2+E6+E11)/SUM(E2:E13)*100,1)"],
    alternates: ['=ROUND(100*SUMIF(C2:C13,"Asha",E2:E13)/SUM(E2:E13),1)'],
  },
];

function sameShape(a: Grid, b: Grid): string | null {
  if (a.length !== b.length) return `row count ${a.length} vs ${b.length}`;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return `row ${r + 1} width ${a[r].length} vs ${b[r].length}`;
  }
  if (a[0].some((cell, c) => cell !== b[0][c])) return "header rows differ";
  return null;
}

function validate(e: Exercise): string[] {
  const problems: string[] = [];
  const say = (message: string) => problems.push(`${e.slug}: ${message}`);

  const shape = sameShape(e.grid, e.hidden_grid);
  if (shape) say(`grids differ in shape — ${shape}`);

  const guard = guardFormula(e.solution_formula);
  if (!guard.ok || !guard.formula) {
    say(`solution refused by the guard — ${guard.reason}`);
    return problems;
  }

  const visible = evaluateFormula(e.grid, guard.formula);
  const hidden = evaluateFormula(e.hidden_grid, guard.formula);
  if (!visible.ok) say(`solution fails on the visible grid — ${visible.error}`);
  if (!hidden.ok) say(`solution fails on the hidden grid — ${hidden.error}`);
  if (!visible.ok || !hidden.ok) return problems;

  if (visible.value === null || visible.value === "") say("solution is blank on the visible grid");
  if (hidden.value === null || hidden.value === "") say("solution is blank on the hidden grid");

  const typedIn = markFormula(e, JSON.stringify(visible.value));
  if (typedIn.correct) {
    say(`typing the visible answer (${visible.value}) is marked correct — the hidden grid does not discriminate`);
  }

  const self = markFormula(e, e.solution_formula);
  if (!self.correct) say(`the solution does not mark itself correct — ${JSON.stringify(self)}`);

  for (const control of e.controls) {
    const guarded = guardFormula(control);
    const onVisible = guarded.formula ? evaluateFormula(e.grid, guarded.formula) : null;
    if (!onVisible?.ok || onVisible.value !== visible.value) {
      say(`control ${control} does not even pass the visible grid, so it proves nothing`);
      continue;
    }
    const verdict = markFormula(e, control);
    if (verdict.correct) say(`control ${control} passes the hidden grid too`);
  }

  for (const alternate of e.alternates) {
    const verdict = markFormula(e, alternate);
    if (!verdict.correct) say(`alternate ${alternate} is marked wrong — ${JSON.stringify(verdict)}`);
  }

  console.log(
    `  ${e.slug.padEnd(32)} visible ${String(visible.value).padEnd(10)} hidden ${String(hidden.value).padEnd(10)}` +
      ` (${e.controls.length} controls, ${e.alternates.length} alternates)`,
  );
  return problems;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const slugs = new Set<string>();
  const problems: string[] = [];
  for (const e of EXERCISES) {
    if (slugs.has(e.slug)) problems.push(`${e.slug}: duplicate slug`);
    slugs.add(e.slug);
    problems.push(...validate(e));
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\nDry run: ${EXERCISES.length} Excel exercises valid. Nothing written.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const [i, e] of EXERCISES.entries()) {
    const { error } = await admin.from("excel_exercises").upsert(
      {
        slug: e.slug,
        title: e.title,
        prompt: e.prompt,
        topic: e.topic,
        difficulty: e.difficulty,
        grid: e.grid,
        hidden_grid: e.hidden_grid,
        answer_label: "H2",
        solution_formula: e.solution_formula,
        hint: e.hint ?? null,
        sort_order: i,
        is_published: true,
      },
      { onConflict: "slug" },
    );
    if (error) {
      console.error(`${e.slug}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`\nSeeded ${EXERCISES.length} Excel exercises.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
