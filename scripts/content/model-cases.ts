/**
 * Model Workspace cases: valuation builds graded cell by cell.
 *
 * Every expected value is COMPUTED by the `value` function from the stated
 * inputs, never typed in. A hand-typed expected number is how a model case
 * ends up marking a correct student wrong; computing it from the same inputs
 * the student reads means the key and the brief cannot disagree.
 *
 * Companies are hypothetical.
 */

export interface ModelCellSeed {
  row: number;
  col: number;
  label: string;
  unit: string | null;
  formula: string;
  explanation: string;
  /** Computes the expected value from already-computed cells, keyed by label. */
  value: (c: Record<string, number>) => number;
  tolerancePct?: number;
}

export interface ModelCaseSeed {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  minutes: number;
  scenario: string;
  instructions: string;
  supporting: Record<string, unknown>;
  tags: string[];
  cells: ModelCellSeed[];
}

// ---- DCF -------------------------------------------------------------------

const DCF = {
  revenue0: 5000,
  growth: 0.12,
  ebitdaMargin: 0.2,
  daPct: 0.04,
  tax: 0.25,
  capexPct: 0.06,
  wcPct: 0.1,
  wacc: 0.11,
  g: 0.05,
  netDebt: 2000,
  shares: 50,
};

function fcf(revenue: number, previousRevenue: number): number {
  const ebitda = revenue * DCF.ebitdaMargin;
  const da = revenue * DCF.daPct;
  const nopat = (ebitda - da) * (1 - DCF.tax);
  const capex = revenue * DCF.capexPct;
  const wc = (revenue - previousRevenue) * DCF.wcPct;
  return nopat + da - capex - wc;
}

const dcfCase: ModelCaseSeed = {
  slug: "model-dcf-cement-maker",
  title: "Build the Model: DCF of a Cement Maker",
  difficulty: "hard",
  minutes: 45,
  scenario:
    "**Vindhya Cements** (a hypothetical listed company) is being valued ahead of an investment committee. You have the operating assumptions below. Build a three-year discounted cash flow with a Gordon-growth terminal value and arrive at a value per share.\n\nAll figures are ₹ crore except per-share values. Cash flows arrive at the end of each year; discount FY27 by one year, FY28 by two and FY29 by three.",
  instructions:
    "Fill every cell. Each is checked against a 2% band, so rounding is fine — a wrong formula is not.\n\nFree cash flow = EBIT × (1 − tax) + D&A − capex − increase in working capital, where EBIT = EBITDA − D&A.\n\nWork down the sheet: revenue, then free cash flow, then present values, then terminal value and enterprise value, then equity.",
  supporting: {
    notes: "₹ crore unless stated. FY26 is the last actual year.",
    inputs: [
      { input: "FY26 revenue", value: "5,000" },
      { input: "Revenue growth, FY27–FY29", value: "12% a year" },
      { input: "EBITDA margin", value: "20% of revenue" },
      { input: "Depreciation & amortisation", value: "4% of revenue" },
      { input: "Tax rate", value: "25% of EBIT" },
      { input: "Capex", value: "6% of revenue" },
      { input: "Increase in working capital", value: "10% of the year's increase in revenue" },
      { input: "WACC", value: "11%" },
      { input: "Terminal growth rate (after FY29)", value: "5%" },
      { input: "Net debt", value: "2,000" },
      { input: "Shares outstanding", value: "50 crore" },
    ],
  },
  tags: ["finance", "valuation", "dcf", "model"],
  cells: [
    { row: 0, col: 0, label: "Revenue FY27", unit: "₹ cr", formula: "5,000 × 1.12", explanation: "One year of 12% growth.", value: () => DCF.revenue0 * (1 + DCF.growth) },
    { row: 0, col: 1, label: "Revenue FY28", unit: "₹ cr", formula: "FY27 revenue × 1.12", explanation: "Growth compounds on the previous year.", value: (c) => c["Revenue FY27"] * (1 + DCF.growth) },
    { row: 0, col: 2, label: "Revenue FY29", unit: "₹ cr", formula: "FY28 revenue × 1.12", explanation: "Third year of compounding.", value: (c) => c["Revenue FY28"] * (1 + DCF.growth) },
    {
      row: 1, col: 0, label: "FCF FY27", unit: "₹ cr",
      formula: "(EBITDA 1,120 − D&A 224) × 0.75 + D&A 224 − capex 336 − ΔWC 60",
      explanation: "Working capital grows with revenue, so it absorbs cash: 10% of the ₹600 crore increase.",
      value: (c) => fcf(c["Revenue FY27"], DCF.revenue0),
    },
    { row: 1, col: 1, label: "FCF FY28", unit: "₹ cr", formula: "Same build on FY28 revenue; ΔWC is 10% of (FY28 − FY27 revenue)", explanation: "Each line scales with revenue except working capital, which scales with the change.", value: (c) => fcf(c["Revenue FY28"], c["Revenue FY27"]) },
    { row: 1, col: 2, label: "FCF FY29", unit: "₹ cr", formula: "Same build on FY29 revenue; ΔWC is 10% of (FY29 − FY28 revenue)", explanation: "This year's cash flow also seeds the terminal value.", value: (c) => fcf(c["Revenue FY29"], c["Revenue FY28"]) },
    { row: 2, col: 0, label: "PV of FCF FY27", unit: "₹ cr", formula: "FCF FY27 / 1.11", explanation: "Discounted one year at the WACC.", value: (c) => c["FCF FY27"] / (1 + DCF.wacc) },
    { row: 2, col: 1, label: "PV of FCF FY28", unit: "₹ cr", formula: "FCF FY28 / 1.11²", explanation: "Two years of discounting.", value: (c) => c["FCF FY28"] / (1 + DCF.wacc) ** 2 },
    { row: 2, col: 2, label: "PV of FCF FY29", unit: "₹ cr", formula: "FCF FY29 / 1.11³", explanation: "Three years of discounting.", value: (c) => c["FCF FY29"] / (1 + DCF.wacc) ** 3 },
    {
      row: 3, col: 0, label: "Terminal value (at FY29)", unit: "₹ cr",
      formula: "FCF FY29 × 1.05 / (0.11 − 0.05)",
      explanation: "Gordon growth uses the NEXT year's cash flow, so FY29 is grown by 5% first. Forgetting the × 1.05 is the most common error.",
      value: (c) => (c["FCF FY29"] * (1 + DCF.g)) / (DCF.wacc - DCF.g),
    },
    { row: 3, col: 1, label: "PV of terminal value", unit: "₹ cr", formula: "Terminal value / 1.11³", explanation: "The terminal value sits at the end of FY29, so it is discounted three years, like FY29's cash flow.", value: (c) => c["Terminal value (at FY29)"] / (1 + DCF.wacc) ** 3 },
    {
      row: 3, col: 2, label: "Enterprise value", unit: "₹ cr",
      formula: "Sum of the three PVs + PV of terminal value",
      explanation: "Note how much of the value comes from the terminal value — the reason terminal growth and WACC deserve the most scrutiny.",
      value: (c) => c["PV of FCF FY27"] + c["PV of FCF FY28"] + c["PV of FCF FY29"] + c["PV of terminal value"],
    },
    { row: 4, col: 0, label: "Equity value", unit: "₹ cr", formula: "Enterprise value − net debt 2,000", explanation: "Debt holders are paid before shareholders.", value: (c) => c["Enterprise value"] - DCF.netDebt },
    { row: 4, col: 1, label: "Value per share", unit: "₹", formula: "Equity value (₹ crore) / 50 crore shares", explanation: "Crore over crore gives rupees per share.", value: (c) => c["Equity value"] / DCF.shares },
  ],
};

// ---- Trading comps ------------------------------------------------------------

const PEERS = [
  { name: "Peer A", mcap: 60000, netDebt: -2000, ebitda: 3000, pat: 2000 },
  { name: "Peer B", mcap: 24000, netDebt: 1000, ebitda: 1250, pat: 780 },
  { name: "Peer C", mcap: 9000, netDebt: 600, ebitda: 520, pat: 300 },
  { name: "Peer D", mcap: 15000, netDebt: -500, ebitda: 900, pat: 610 },
];
const TARGET = { ebitda: 700, pat: 420, netDebt: 400, shares: 10 };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const peerCells: ModelCellSeed[] = PEERS.flatMap((p, i) => [
  {
    row: 0,
    col: i,
    label: `EV/EBITDA ${p.name}`,
    unit: "x",
    formula: `(${p.mcap.toLocaleString("en-IN")} ${p.netDebt < 0 ? "−" : "+"} ${Math.abs(p.netDebt).toLocaleString("en-IN")}) / ${p.ebitda.toLocaleString("en-IN")}`,
    explanation:
      p.netDebt < 0
        ? "Net cash is negative net debt, so it reduces enterprise value."
        : "Enterprise value = market cap + net debt.",
    value: () => (p.mcap + p.netDebt) / p.ebitda,
  },
  {
    row: 1,
    col: i,
    label: `P/E ${p.name}`,
    unit: "x",
    formula: `${p.mcap.toLocaleString("en-IN")} / ${p.pat.toLocaleString("en-IN")}`,
    explanation: "Equity value over profit after tax — no adjustment for debt, because P/E is an equity multiple.",
    value: () => p.mcap / p.pat,
  },
]);

const compsCase: ModelCaseSeed = {
  slug: "model-trading-comps-paints",
  title: "Build the Model: Trading Comps for a Paints Company",
  difficulty: "medium",
  minutes: 35,
  scenario:
    "**Rangrez Paints** (a hypothetical unlisted company) is considering a listing, and the banker wants a first view of value from four listed peers. Compute each peer's EV/EBITDA and P/E, take the median of each, and apply them to Rangrez.\n\nAll figures are ₹ crore except per-share values. A negative net debt means the company holds net cash.",
  instructions:
    "Fill every cell. Each is checked against a 2% band.\n\nEnterprise value = market cap + net debt. The median of four numbers is the average of the middle two once sorted.\n\nApply the median EV/EBITDA to Rangrez's EBITDA to get enterprise value, then subtract net debt for equity. Apply the median P/E directly to Rangrez's profit for a second equity view.",
  supporting: {
    notes: "₹ crore. Trailing twelve months.",
    peers: PEERS.map((p) => ({
      company: p.name,
      market_cap: p.mcap.toLocaleString("en-IN"),
      net_debt: p.netDebt.toLocaleString("en-IN"),
      ebitda: p.ebitda.toLocaleString("en-IN"),
      profit_after_tax: p.pat.toLocaleString("en-IN"),
    })),
    rangrez_paints: {
      ebitda: "700",
      profit_after_tax: "420",
      net_debt: "400",
      shares_outstanding: "10 crore",
    },
  },
  tags: ["finance", "valuation", "comps", "model"],
  cells: [
    ...peerCells,
    {
      row: 2, col: 0, label: "Median EV/EBITDA", unit: "x",
      formula: "Average of the middle two peer EV/EBITDA multiples",
      explanation: "The median resists one expensive or cheap peer skewing the answer, which the mean does not.",
      value: (c) => median(PEERS.map((p) => c[`EV/EBITDA ${p.name}`])),
    },
    {
      row: 2, col: 1, label: "Median P/E", unit: "x",
      formula: "Average of the middle two peer P/E multiples",
      explanation: "Same logic, on the equity multiple.",
      value: (c) => median(PEERS.map((p) => c[`P/E ${p.name}`])),
    },
    { row: 3, col: 0, label: "Implied EV (EV/EBITDA)", unit: "₹ cr", formula: "Median EV/EBITDA × 700", explanation: "An enterprise multiple produces an enterprise value.", value: (c) => c["Median EV/EBITDA"] * TARGET.ebitda },
    { row: 3, col: 1, label: "Implied equity (EV/EBITDA)", unit: "₹ cr", formula: "Implied EV − net debt 400", explanation: "Move from enterprise to equity before dividing by shares.", value: (c) => c["Implied EV (EV/EBITDA)"] - TARGET.netDebt },
    { row: 3, col: 2, label: "Value per share (EV/EBITDA)", unit: "₹", formula: "Implied equity / 10 crore shares", explanation: "Crore over crore gives rupees per share.", value: (c) => c["Implied equity (EV/EBITDA)"] / TARGET.shares },
    { row: 4, col: 0, label: "Implied equity (P/E)", unit: "₹ cr", formula: "Median P/E × 420", explanation: "P/E applies to profit and gives equity value directly — no net debt adjustment.", value: (c) => c["Median P/E"] * TARGET.pat },
    {
      row: 4, col: 1, label: "Value per share (P/E)", unit: "₹", formula: "Implied equity (P/E) / 10 crore shares",
      explanation: "Compare with the EV/EBITDA answer. A gap between the two says the peers carry different leverage or tax profiles from Rangrez, and a banker would present a range, not one number.",
      value: (c) => c["Implied equity (P/E)"] / TARGET.shares,
    },
  ],
};

export const MODEL_CASES: ModelCaseSeed[] = [dcfCase, compsCase];
