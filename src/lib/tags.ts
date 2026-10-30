/**
 * How case tags read on screen.
 *
 * Tags are stored the way authors and seed scripts wrote them: lowercase,
 * some kebab-case ("market-entry", "willingness-to-pay"), some spaced
 * ("cash conversion cycle"), with acronyms flattened ("wacc", "m&a"). Shown
 * raw, one row mixes three casings. Every tag on screen goes through
 * `tagLabel`, so the stored value can stay a stable filter key while the
 * label is always sentence case with its acronyms restored.
 */

/** Words that are acronyms or have a fixed spelling, by their stored form. */
const FIXED_WORDS: Record<string, string> = {
  "m&a": "M&A",
  "p&l": "P&L",
  arpu: "ARPU",
  b2b: "B2B",
  b2c: "B2C",
  cac: "CAC",
  capex: "Capex",
  cagr: "CAGR",
  d2c: "D2C",
  dcf: "DCF",
  dso: "DSO",
  ebitda: "EBITDA",
  esg: "ESG",
  fmcg: "FMCG",
  gtm: "GTM",
  hr: "HR",
  irr: "IRR",
  kpi: "KPI",
  kpis: "KPIs",
  ltv: "LTV",
  mbb: "MBB",
  npv: "NPV",
  opex: "Opex",
  roi: "ROI",
  saas: "SaaS",
  sku: "SKU",
  skus: "SKUs",
  sql: "SQL",
  wacc: "WACC",
};

/** "market-entry" → "Market entry", "wacc" → "WACC", "mbb-style" → "MBB style". */
export function tagLabel(tag: string): string {
  const words = tag
    .trim()
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => FIXED_WORDS[word.toLowerCase()] ?? word.toLowerCase());
  if (words.length === 0) return "";
  const [first, ...rest] = words;
  const head = FIXED_WORDS[first.toLowerCase()] ? first : first[0]!.toUpperCase() + first.slice(1);
  return [head, ...rest].join(" ");
}

/**
 * The tags to show for a case: labelled, with duplicates that only differed
 * in spelling ("market-entry" and "market entry") shown once, in stored order.
 */
export function caseTagLabels(tags: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const tag of tags ?? []) {
    const label = tagLabel(tag);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}
