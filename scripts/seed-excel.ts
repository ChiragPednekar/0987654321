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
import {
  PEOPLE,
  PEOPLE_HIDDEN,
  PNL,
  PNL_HIDDEN,
  SALES,
  SALES_HIDDEN,
  STOCK,
  STOCK_HIDDEN,
} from "../src/lib/excel/datasets";

config({ path: ".env.local" });
config({ path: ".env" });


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

export const EXERCISES: Exercise[] = [
  {
    slug: "excel-units-by-rep",
    title: "Units sold by one rep",
    topic: "conditional sums",
    difficulty: "easy",
    prompt: 'In H2, return the total units sold by Asha.',
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=SUMIFS(E2:E13,C2:C13,"Asha")',
    hint: "SUMIFS takes the range to add first, then the range to test and the value to test it against.",
    controls: ["=94"],
    alternates: ['=SUMIF(C2:C13,"Asha",E2:E13)'],
  },
  {
    slug: "excel-largest-order",
    title: "The largest single order",
    topic: "aggregates",
    difficulty: "easy",
    prompt: "In H2, return the number of units in the largest single order.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: "=MAX(E2:E13)",
    hint: "One function, one range.",
    controls: ["=60"],
    alternates: ["=LARGE(E2:E13,1)"],
  },
  {
    slug: "excel-average-units-region",
    title: "Average order size in one region",
    topic: "conditional averages",
    difficulty: "medium",
    prompt: "In H2, return the average number of units per order in the East region.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=AVERAGEIFS(E2:E13,B2:B13,"East")',
    hint: "AVERAGEIFS follows the same argument order as SUMIFS.",
    controls: ["=35"],
    alternates: ['=AVERAGEIF(B2:B13,"East",E2:E13)'],
  },
  {
    slug: "excel-average-salary-top-rated",
    title: "What the best-rated people earn",
    topic: "conditional averages",
    difficulty: "medium",
    prompt: "In H2, return the average salary of employees with a rating of 5.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: "=AVERAGEIFS(D2:D11,E2:E11,5)",
    hint: "A numeric criterion does not need quotes.",
    controls: ["=991000"],
    alternates: ["=AVERAGEIF(E2:E11,5,D2:D11)"],
  },
  {
    slug: "excel-name-highest-paid",
    title: "Who earns the most",
    topic: "lookup",
    difficulty: "hard",
    prompt: "In H2, return the NAME of the highest-paid employee.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: "=INDEX(B2:B11,MATCH(MAX(D2:D11),D2:D11,0))",
    hint: "MAX finds the value, MATCH finds which row it is on, INDEX reads the name off that row. VLOOKUP cannot look leftwards.",
    controls: ['="Arjun Pillai"'],
    alternates: ["=INDEX(B2:B11,MATCH(LARGE(D2:D11,1),D2:D11,0))"],
  },
  {
    slug: "excel-stock-value",
    title: "Value of stock on hand",
    topic: "arithmetic across columns",
    difficulty: "easy",
    prompt: "In H2, return the total value of stock on hand — quantity x unit cost, across all SKUs.",
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: "=SUMPRODUCT(C2:C9,E2:E9)",
    hint: "The same shape as the revenue question on the sales ledger.",
    controls: ["=48680"],
    alternates: ["=SUMPRODUCT(E2:E9,C2:C9)"],
  },
  {
    slug: "excel-depot-from-bin",
    title: "Which depot holds a SKU",
    topic: "text and lookup",
    difficulty: "hard",
    prompt:
      'In H2, return the three-letter depot code for SKU S-03. The bin code is formatted DEPOT-NNNN-X.',
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=LEFT(INDEX(F2:F9,MATCH("S-03",A2:A9,0)),3)',
    hint: "Find the row first, read the bin code, then cut the first three characters off it.",
    controls: ['="PNQ"'],
    alternates: ['=LEFT(VLOOKUP("S-03",A2:F9,6,FALSE),3)'],
  },
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
  },  // ---- Sales ledger -----------------------------------------------------------
  {
    slug: "excel-orders-in-region",
    title: "How many orders came from one region",
    topic: "counting",
    difficulty: "easy",
    prompt: "In H2, return the number of orders from the North region.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=COUNTIF(B2:B13,"North")',
    hint: "COUNTIF takes the range to test and the value to look for.",
    controls: ["=3"],
    alternates: ['=COUNTIFS(B2:B13,"North")'],
  },
  {
    slug: "excel-second-largest-order",
    title: "The second-largest order",
    topic: "aggregates",
    difficulty: "easy",
    prompt: "In H2, return the number of units in the second-largest order.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: "=LARGE(E2:E13,2)",
    hint: "LARGE(range, k) returns the k-th largest value.",
    controls: ["=50", "=E5"],
    alternates: [],
  },
  {
    slug: "excel-median-order",
    title: "The typical order size",
    topic: "averages",
    difficulty: "easy",
    prompt: "In H2, return the median number of units per order.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: "=MEDIAN(E2:E13)",
    hint: "With an even number of orders, the median is the average of the two middle values — MEDIAN does that for you.",
    controls: ["=20"],
    alternates: [],
  },
  {
    slug: "excel-largest-cable-order",
    title: "Largest order of one product",
    topic: "conditional aggregates",
    difficulty: "medium",
    prompt: "In H2, return the number of units in the largest single Cable order.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=MAXIFS(E2:E13,D2:D13,"Cable")',
    hint: "MAXIFS works like SUMIFS: the range to take the maximum of first, then range and criterion pairs.",
    controls: ["=60", "=E11"],
    alternates: [],
  },
  {
    slug: "excel-smallest-order-rep",
    title: "One rep's smallest order",
    topic: "conditional aggregates",
    difficulty: "medium",
    prompt: "In H2, return the number of units in Devi's smallest order.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=MINIFS(E2:E13,C2:C13,"Devi")',
    hint: "MINIFS is the mirror image of MAXIFS.",
    controls: ["=10"],
    alternates: [],
  },
  {
    slug: "excel-big-east-orders",
    title: "Big orders in one region",
    topic: "counting",
    difficulty: "medium",
    prompt: "In H2, return how many orders from the East region were for 20 units or more.",
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=COUNTIFS(B2:B13,"East",E2:E13,">=20")',
    hint: 'COUNTIFS takes pairs of range and criterion; every pair must be true. A comparison goes in quotes: ">=20".',
    controls: ["=2"],
    alternates: ['=COUNTIFS(E2:E13,">19",B2:B13,"East")'],
  },
  {
    slug: "excel-order-size-band",
    title: "Banding one order by size",
    topic: "conditionals",
    difficulty: "hard",
    prompt: 'In H2, look up order 1006 and return "Large" if it is for 30 units or more, "Medium" if 15 or more, and "Small" otherwise.',
    grid: SALES,
    hidden_grid: SALES_HIDDEN,
    solution_formula: '=IFS(VLOOKUP(1006,A2:E13,5,FALSE)>=30,"Large",VLOOKUP(1006,A2:E13,5,FALSE)>=15,"Medium",TRUE,"Small")',
    hint: "Look the units up first (VLOOKUP or INDEX/MATCH), then test the biggest band first — IFS stops at the first true condition.",
    controls: ['="Medium"', '=IF(E7>=30,"Large",IF(E7>=15,"Medium","Small"))'],
    alternates: ['=IF(INDEX(E2:E13,MATCH(1006,A2:A13,0))>=30,"Large",IF(INDEX(E2:E13,MATCH(1006,A2:A13,0))>=15,"Medium","Small"))'],
  },
  // ---- People -----------------------------------------------------------------
  {
    slug: "excel-headcount-dept",
    title: "Headcount in one department",
    topic: "counting",
    difficulty: "easy",
    prompt: "In H2, return the number of employees in Operations.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=COUNTIF(C2:C11,"Operations")',
    hint: "One COUNTIF over the department column.",
    controls: ["=3"],
    alternates: ['=COUNTIFS(C2:C11,"Operations")'],
  },
  {
    slug: "excel-employee-dept-lookup",
    title: "Which department is an employee in",
    topic: "lookup",
    difficulty: "easy",
    prompt: "In H2, return the department of employee E107.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=VLOOKUP("E107",A2:C11,3,FALSE)',
    hint: "VLOOKUP's last argument should be FALSE for an exact match.",
    controls: ['="Finance"', "=C8"],
    alternates: ['=INDEX(C2:C11,MATCH("E107",A2:A11,0))'],
  },
  {
    slug: "excel-dept-payroll",
    title: "A department's payroll",
    topic: "conditional sums",
    difficulty: "easy",
    prompt: "In H2, return the total salary bill of the Finance department.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=SUMIFS(D2:D11,C2:C11,"Finance")',
    hint: "SUMIFS: the range to add, then the range to test and the value.",
    controls: ["=D2+D5+D8"],
    alternates: ['=SUMIF(C2:C11,"Finance",D2:D11)'],
  },
  {
    slug: "excel-long-tenure",
    title: "Employees who joined before 2019",
    topic: "counting",
    difficulty: "medium",
    prompt: "In H2, return how many employees joined before 2019.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=COUNTIF(F2:F11,"<2019")',
    hint: 'A comparison criterion goes in quotes: "<2019".',
    controls: ["=3"],
    alternates: ['=COUNTIFS(F2:F11,"<=2018")'],
  },
  {
    slug: "excel-sales-pay-gap",
    title: "The pay gap inside one team",
    topic: "conditional aggregates",
    difficulty: "medium",
    prompt: "In H2, return the difference between the highest and the lowest salary in the Sales department.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=MAXIFS(D2:D11,C2:C11,"Sales")-MINIFS(D2:D11,C2:C11,"Sales")',
    hint: "MAXIFS minus MINIFS, each with the same condition.",
    controls: ["=334400", "=D9-D11"],
    alternates: [],
  },
  {
    slug: "excel-raise-cost",
    title: "What a raise for top performers costs",
    topic: "conditional sums",
    difficulty: "hard",
    prompt: "In H2, return the extra annual cost of giving every employee rated 5 a 10% raise.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: "=SUMIFS(D2:D11,E2:E11,5)*0.1",
    hint: "Add up the salaries of everyone rated 5, then take 10% of the total.",
    controls: ["=297300", "=(D4+D6+D8)*0.1"],
    alternates: ["=0.1*SUMIF(E2:E11,5,D2:D11)", "=SUMIFS(D2:D11,E2:E11,5)/10"],
  },
  {
    slug: "excel-salary-spread",
    title: "How spread out salaries are",
    topic: "statistics",
    difficulty: "hard",
    prompt: "In H2, return the sample standard deviation of salaries, rounded to the nearest rupee.",
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: "=ROUND(STDEV(D2:D11),0)",
    hint: "STDEV is the sample standard deviation. ROUND with 0 digits gives a whole number.",
    controls: [],
    alternates: [],
  },
  {
    slug: "excel-email-lowest-paid",
    title: "Build an email address",
    topic: "text and lookup",
    difficulty: "hard",
    prompt: 'In H2, build the email address of the lowest-paid employee: their full name in lower case with the space replaced by a dot, followed by "@firm.in" — for example "kavya.iyer@firm.in".',
    grid: PEOPLE,
    hidden_grid: PEOPLE_HIDDEN,
    solution_formula: '=LOWER(SUBSTITUTE(INDEX(B2:B11,MATCH(MIN(D2:D11),D2:D11,0))," ","."))&"@firm.in"',
    hint: "Find the name with INDEX/MATCH on the minimum salary, then SUBSTITUTE the space, LOWER it, and join on the domain with &.",
    controls: ['="aman.verma@firm.in"', '=LOWER(SUBSTITUTE(B11," ","."))&"@firm.in"'],
    alternates: ['=CONCATENATE(LOWER(SUBSTITUTE(INDEX(B2:B11,MATCH(SMALL(D2:D11,1),D2:D11,0))," ",".")),"@firm.in")'],
  },
  // ---- Stock ------------------------------------------------------------------
  {
    slug: "excel-item-stock-value",
    title: "Value of one item's stock",
    topic: "lookup",
    difficulty: "easy",
    prompt: "In H2, return the value of the Valves on hand — quantity on hand x unit cost.",
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=INDEX(C2:C9,MATCH("Valves",B2:B9,0))*INDEX(E2:E9,MATCH("Valves",B2:B9,0))',
    hint: "Look up each of the two numbers for Valves, then multiply them.",
    controls: ["=15300", "=C4*E4"],
    alternates: ['=VLOOKUP("Valves",B2:E9,2,FALSE)*VLOOKUP("Valves",B2:E9,4,FALSE)'],
  },
  {
    slug: "excel-reorder-flag",
    title: "Does an item need reordering",
    topic: "conditionals",
    difficulty: "medium",
    prompt: 'In H2, return "Reorder" if the Valves on hand are below their reorder level, and "OK" otherwise.',
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=IF(VLOOKUP("Valves",B2:D9,2,FALSE)<VLOOKUP("Valves",B2:D9,3,FALSE),"Reorder","OK")',
    hint: "Look up both numbers for Valves and compare them inside an IF.",
    controls: ['="Reorder"', '=IF(C4<D4,"Reorder","OK")'],
    alternates: ['=IF(INDEX(C2:C9,MATCH("Valves",B2:B9,0))>=INDEX(D2:D9,MATCH("Valves",B2:B9,0)),"OK","Reorder")'],
  },
  {
    slug: "excel-shortfall-units",
    title: "How many units to bring stock back up",
    topic: "lookup",
    difficulty: "hard",
    prompt: "In H2, return how many Gaskets must be bought to bring stock up to the reorder level — or 0 if stock is already at or above it.",
    grid: STOCK,
    hidden_grid: STOCK_HIDDEN,
    solution_formula: '=MAX(0,VLOOKUP("Gaskets",B2:D9,3,FALSE)-VLOOKUP("Gaskets",B2:D9,2,FALSE))',
    hint: "Reorder level minus on hand, but never below zero — MAX(0, ...) does that.",
    controls: ["=25", "=D3-C3"],
    alternates: ['=IF(INDEX(D2:D9,MATCH("Gaskets",B2:B9,0))>INDEX(C2:C9,MATCH("Gaskets",B2:B9,0)),INDEX(D2:D9,MATCH("Gaskets",B2:B9,0))-INDEX(C2:C9,MATCH("Gaskets",B2:B9,0)),0)'],
  },
  // ---- Monthly P&L --------------------------------------------------------------
  {
    slug: "excel-annual-revenue",
    title: "Revenue for the year",
    topic: "aggregates",
    difficulty: "easy",
    prompt: "In H2, return the total revenue for the year, in ₹ lakh.",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: "=SUM(B2:B13)",
    hint: "One SUM over the revenue column.",
    controls: ["=1746"],
    alternates: ["=SUMPRODUCT(B2:B13)"],
  },
  {
    slug: "excel-heavy-marketing-months",
    title: "Months of heavy marketing",
    topic: "counting",
    difficulty: "easy",
    prompt: "In H2, return the number of months in which marketing spend was more than ₹10 lakh.",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: '=COUNTIF(E2:E13,">10")',
    hint: '">10" means strictly more than 10, so a month of exactly 10 does not count.',
    controls: ["=6"],
    alternates: ['=COUNTIFS(E2:E13,">10")'],
  },
  {
    slug: "excel-gross-margin",
    title: "Gross margin for the year",
    topic: "arithmetic across columns",
    difficulty: "medium",
    prompt: "In H2, return the full-year gross margin — (revenue − COGS) ÷ revenue — as a percentage rounded to one decimal place (so 42.3, not 0.423).",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: "=ROUND((SUM(B2:B13)-SUM(C2:C13))/SUM(B2:B13)*100,1)",
    hint: "Total revenue and total COGS first; the margin of the totals, not the average of monthly margins.",
    controls: [],
    alternates: ["=ROUND(100*(1-SUM(C2:C13)/SUM(B2:B13)),1)"],
  },
  {
    slug: "excel-operating-profit-month",
    title: "Operating profit in one month",
    topic: "lookup",
    difficulty: "medium",
    prompt: "In H2, return October's operating profit in ₹ lakh: revenue minus COGS, opex and marketing.",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: '=VLOOKUP("Oct",A2:E13,2,FALSE)-VLOOKUP("Oct",A2:E13,3,FALSE)-VLOOKUP("Oct",A2:E13,4,FALSE)-VLOOKUP("Oct",A2:E13,5,FALSE)',
    hint: "Four lookups on the same month, or the row's cells directly once you have found it.",
    controls: ["=32"],
    alternates: ["=B8-C8-D8-E8", "=B8-SUM(C8:E8)"],
  },
  {
    slug: "excel-cost-per-customer",
    title: "Marketing cost per new customer",
    topic: "arithmetic across columns",
    difficulty: "medium",
    prompt: "In H2, return the year's marketing spend per new customer, in rupees, rounded to the nearest rupee. Marketing is in ₹ lakh; one lakh is 1,00,000.",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: "=ROUND(SUM(E2:E13)*100000/SUM(F2:F13),0)",
    hint: "Total spend over total customers — and convert lakh to rupees before dividing, or after.",
    controls: [],
    alternates: ["=ROUND(SUM(E2:E13)/SUM(F2:F13)*100000,0)"],
  },
  {
    slug: "excel-revenue-growth",
    title: "Revenue growth across the year",
    topic: "lookup",
    difficulty: "hard",
    prompt: "In H2, return the percentage growth in monthly revenue from April to March, rounded to one decimal place (so 35.0 for 35%).",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: '=ROUND((VLOOKUP("Mar",A2:B13,2,FALSE)/VLOOKUP("Apr",A2:B13,2,FALSE)-1)*100,1)',
    hint: "Growth = end ÷ start − 1. Multiply by 100 and round.",
    controls: ["=35"],
    alternates: ["=ROUND((B13/B2-1)*100,1)", "=ROUND((B13-B2)/B2*100,1)"],
  },
  {
    slug: "excel-best-revenue-month",
    title: "The strongest month",
    topic: "lookup",
    difficulty: "hard",
    prompt: "In H2, return the name of the month with the highest revenue.",
    grid: PNL,
    hidden_grid: PNL_HIDDEN,
    solution_formula: "=INDEX(A2:A13,MATCH(MAX(B2:B13),B2:B13,0))",
    hint: "MAX finds the revenue, MATCH finds its row, INDEX reads the month off that row.",
    controls: ['="Oct"', "=A8"],
    alternates: ["=INDEX(A2:A13,MATCH(LARGE(B2:B13,1),B2:B13,0))"],
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

export function validate(e: Exercise, log: (line: string) => void = console.log): string[] {
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

  log(
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

if (process.argv[1]?.endsWith("seed-excel.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
