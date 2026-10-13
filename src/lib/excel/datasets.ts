import type { Grid } from "./runner";

/**
 * The sheets every platform Excel exercise is set on, and the ones a teacher
 * can set their own exercise on.
 *
 * Moved here from scripts/seed-excel.ts so the seeder and the teacher
 * authoring route share one copy. Each has a second sheet with the same
 * columns and different values: a formula answers both, a typed-in number
 * answers only the first. A saved exercise keeps its own copy of both.
 */

// ---- Sales ledger ------------------------------------------------------------
// Unit price is fixed per product, so revenue questions have one right answer.

const SALES_HEADER = ["Order ID", "Region", "Rep", "Product", "Units", "Unit price (₹)"];

export const SALES: Grid = [
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
export const SALES_HIDDEN: Grid = [
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

export const PEOPLE: Grid = [
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

export const PEOPLE_HIDDEN: Grid = [
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

export const STOCK: Grid = [
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

export const STOCK_HIDDEN: Grid = [
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

export interface ExcelDataset {
  key: "sales" | "people" | "stock";
  label: string;
  grid: Grid;
  hidden: Grid;
}

export const EXCEL_DATASETS: readonly ExcelDataset[] = [
  { key: "sales", label: "Sales ledger — orders by region, rep and product", grid: SALES, hidden: SALES_HIDDEN },
  { key: "people", label: "People — employees, salary, rating and join year", grid: PEOPLE, hidden: PEOPLE_HIDDEN },
  { key: "stock", label: "Stock — items on hand, reorder levels and costs", grid: STOCK, hidden: STOCK_HIDDEN },
];
