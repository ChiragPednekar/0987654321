/**
 * MBB-style cases: the format consulting firms actually interview in.
 *
 * The rest of the library asks for a written memo. These are built the way a
 * case interview runs:
 *
 *   - INTERVIEWER-LED (McKinsey's problem-solving interview): the interviewer
 *     asks a fixed sequence of questions — structure, read an exhibit, do the
 *     maths, brainstorm, synthesise — and the candidate answers each in turn.
 *   - CANDIDATE-LED (BCG, Bain, Kearney, Accenture, Deloitte): the candidate
 *     drives, choosing which exhibit to use and when, and must close with a
 *     recommendation unprompted.
 *
 * Level changes the case, not just its label:
 *   easy   — structure, one clean calculation, a recommendation (~25 min)
 *   medium — adds an exhibit to read and a calculation that tests an assumption
 *   hard   — adds a second exhibit with a trap, multi-step maths, a brainstorm
 *            and a synthesis with risks and next steps (~55 min)
 *
 * Every number in a model answer is computed here from the same inputs as the
 * exhibit, so the answer key can never disagree with the data. Deterministic:
 * the same seed gives the same case, so re-seeding updates rows in place.
 */

import { COMPANIES, createRng, currency, type Company, type Rng } from "../lib/generator";
import type { Difficulty } from "../../src/lib/types/database";

export type Level = Difficulty;

export interface MbbFirm {
  /** As stored in cases.company_track and shown in the filters. */
  track: string;
  slug: string;
  led: "interviewer" | "candidate";
  /** One line on what this firm's interviewers listen for. */
  emphasis: string;
}

export const MBB_FIRMS: MbbFirm[] = [
  { track: "McKinsey", slug: "mckinsey", led: "interviewer", emphasis: "a hypothesis-driven structure, accurate maths said out loud, and a synthesis that leads with the answer" },
  { track: "BCG", slug: "bcg", led: "candidate", emphasis: "driving the case yourself, creative but defensible ideas, and comfort with charts under time pressure" },
  { track: "Bain", slug: "bain", led: "candidate", emphasis: "getting to a practical answer quickly and stating the \"so what\" of every number" },
  { track: "Kearney", slug: "kearney", led: "candidate", emphasis: "operational rigour: costs, capacity and how the plan would actually be delivered" },
  { track: "Accenture", slug: "accenture", led: "candidate", emphasis: "a clear structure and a recommendation that can be implemented, with the steps to get there" },
  { track: "Deloitte", slug: "deloitte", led: "candidate", emphasis: "a balanced view of value and risk, and a recommendation a client could act on" },
];

export interface MbbCase {
  slug: string;
  title: string;
  domain: "consulting";
  difficulty: Level;
  categorySlug: string;
  companyTrack: string;
  estimatedMinutes: number;
  scenario: string;
  instructions: string;
  supportingData: Record<string, unknown>;
  expectedFramework: string;
  modelAnswer: string;
  tags: string[];
  rubric: { criteria: Record<string, number>; descriptors: Record<string, string>; passScore: number };
}

// ------------------------------------------------------------- helpers ----

/** "1,234" / "12.5" — Indian grouping for rupee cases, plain otherwise. */
function num(value: number, company: Company, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  return rounded.toLocaleString(company.geo === "India" ? "en-IN" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(value: number, company: Company, digits = 0): string {
  const c = currency(company);
  return `${c.symbol}${num(value, company, digits)} ${c.big}`;
}

function pct(value: number, digits = 0): string {
  return `${Number(value.toFixed(digits))}%`;
}

/** "Services'" / "Otter Payments'" / "Core range's". */
function poss(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

/** "in the US", "in India". */
function inGeo(company: Company): string {
  return ["US", "UK"].includes(company.geo) ? `in the ${company.geo}` : `in ${company.geo}`;
}

function titleCase(phrase: string): string {
  return phrase.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

/**
 * Which client companies suit which case. A bank has no plant to fill, and a
 * carmaker does not sell ₹200 purchases seven times a year.
 */
const MAKERS = ["Meridian Foods", "Corveta Motors", "Pallas Pharma", "Granite Materials", "Ferro Industries", "Cobalt Robotics", "Marlow Chemicals"];
const CONSUMER = ["Meridian Foods", "Saffron Retail", "Basil & Co", "Pinecrest Grocers", "Wavelength Media", "Lumen Learning", "Kirana Connect", "Otter Payments", "Solstice Travel"];
const PRODUCT_SELLERS = [...MAKERS, "Saffron Retail", "Basil & Co", "Pinecrest Grocers"];
const companiesNamed = (names: string[]) => COMPANIES.filter((c) => names.includes(c.name));

const MINUTES: Record<Level, number> = { easy: 25, medium: 40, hard: 55 };

interface Question {
  ask: string;
  answer: string;
}

interface Built {
  title: string;
  categorySlug: string;
  tags: string[];
  situation: string;
  exhibits: Record<string, unknown>;
  questions: Question[];
  framework: string;
  /** Archetype-specific guidance for the rubric descriptors. */
  marking: { structure: string; maths: string; exhibit: string; creativity: string; synthesis: string };
}

type ArchetypeBuilder = (company: Company, rng: Rng, level: Level) => Built;

// ------------------------------------------------------- profitability ----

const profitability: ArchetypeBuilder = (company, rng, level) => {
  const segs = level === "hard" ? ["Core business", "Premium line", "Services"] : ["Core business", "Premium line"];
  const problem = rng.int(0, segs.length - 1);
  const rows = segs.map((name, i) => {
    const revenueLast = rng.int(120, 520);
    const costLast = Math.round(revenueLast * rng.float(0.7, 0.82, 2));
    const revenueThis = Math.round(revenueLast * (1 + rng.int(-2, 4) / 100));
    const costGrowth = i === problem ? rng.int(14, 24) : rng.int(0, 3);
    const costThis = Math.round(costLast * (1 + costGrowth / 100));
    return { segment: name, revenue_last: revenueLast, revenue_this: revenueThis, cost_last: costLast, cost_this: costThis };
  });
  const profitLast = rows.reduce((s, r) => s + r.revenue_last - r.cost_last, 0);
  const profitThis = rows.reduce((s, r) => s + r.revenue_this - r.cost_this, 0);
  const drop = profitLast - profitThis;
  const p = rows[problem];
  const pDrop = p.revenue_last - p.cost_last - (p.revenue_this - p.cost_this);
  const pShare = (pDrop / drop) * 100;
  const marginLast = (profitLast / rows.reduce((s, r) => s + r.revenue_last, 0)) * 100;
  const marginThis = (profitThis / rows.reduce((s, r) => s + r.revenue_this, 0)) * 100;

  // What P's profit would be had its cost grown only in line with its revenue.
  const pCostInLine = Math.round(p.cost_last * (p.revenue_this / p.revenue_last));
  const recovered = p.cost_this - pCostInLine;

  // Hard: the cost lines inside the problem segment — one of them is the cause.
  const lines = ["Materials", "Labour", "Logistics"];
  // Never the biggest line, so "cut the biggest cost" is the wrong answer.
  const culprit = rng.int(1, 2);
  const shares = [0.55, 0.3, 0.15];
  const costLines = lines.map((line, i) => {
    const last = Math.round(p.cost_last * shares[i]);
    return { line, last, this: last };
  });
  // Put almost all of the segment's cost growth into the culprit line.
  const growth = p.cost_this - costLines.reduce((s, l) => s + l.last, 0);
  costLines.forEach((l, i) => {
    l.this = i === culprit ? l.last + growth - 2 * (costLines.length - 1) : l.last + 2;
  });
  const culpritLine = costLines[culprit];
  const LEVERS: Record<string, string> = {
    Labour: `Rate: wage and contractor rates against the market, overtime premiums. Hours: shift patterns, overtime and idle time, absenteeism. Productivity: training, layout, automation of the most manual steps. Sourcing: which work could be outsourced or moved.`,
    Logistics: `Rate: re-tender freight contracts, index fuel surcharges. Volume: consolidate loads, raise truck fill, cut expedited shipments. Network: routes, warehouse locations, mode shift. Customer terms: minimum order sizes, delivery-frequency charges.`,
  };
  const RISKS: Record<string, string> = {
    Labour: "Risk: if the rise is a market-wide wage increase, savings will be partial — benchmark rates and overtime hours within two weeks.",
    Logistics: "Risk: if the rise is a fuel-price change across the market, savings will be partial — get fresh freight quotes within two weeks.",
  };
  const culpritRise = ((culpritLine.this - culpritLine.last) / culpritLine.last) * 100;

  const exhibits: Record<string, unknown> = {
    "Exhibit 1 — segment P&L": rows.map((r) => ({
      segment: r.segment,
      [`revenue last year (${currency(company).big})`]: r.revenue_last,
      [`revenue this year (${currency(company).big})`]: r.revenue_this,
      [`cost last year (${currency(company).big})`]: r.cost_last,
      [`cost this year (${currency(company).big})`]: r.cost_this,
    })),
  };
  if (level === "hard") {
    exhibits[`Exhibit 2 — ${p.segment} cost lines`] = costLines.map((l) => ({
      line: l.line,
      [`last year (${currency(company).big})`]: l.last,
      [`this year (${currency(company).big})`]: l.this,
    }));
  }

  const questions: Question[] = [
    {
      ask: "How would you structure the problem? Lay out the issue tree you would use to find why profit fell.",
      answer: `Profit = revenue − cost, split by segment, then revenue into price × volume and cost into variable and fixed lines. With revenue roughly flat (overall operating margin went from ${pct(marginLast, 1)} to ${pct(marginThis, 1)}), the first hypothesis is the cost side — and the question is which segment's.`,
    },
  ];
  if (level !== "easy") {
    questions.push({
      ask: "Look at Exhibit 1. What do you see, and where would you focus?",
      answer: `Revenue barely moved in any segment, but ${poss(p.segment)} cost rose from ${money(p.cost_last, company)} to ${money(p.cost_this, company)} — about ${pct(((p.cost_this - p.cost_last) / p.cost_last) * 100)} — while its revenue moved only ${pct(((p.revenue_this - p.revenue_last) / p.revenue_last) * 100, 1)}. The other segment${segs.length > 2 ? "s are" : " is"} close to flat. Focus on ${p.segment}.`,
    });
  }
  questions.push({
    ask: level === "easy"
      ? "Using Exhibit 1, how much did operating profit fall, and how much of the fall came from one segment?"
      : `Quantify it: how much did total operating profit fall, what share came from ${p.segment}, and what would profit have been had ${poss(p.segment)} cost grown only in line with its revenue?`,
    answer: `Operating profit fell from ${money(profitLast, company)} to ${money(profitThis, company)}, a fall of ${money(drop, company)}. ${p.segment} accounts for ${money(pDrop, company)} of it — ${pct(pShare)}.${level === "easy" ? "" : ` Had its cost grown in line with its revenue it would have been ${money(pCostInLine, company)}, not ${money(p.cost_this, company)} — ${money(recovered, company)} more profit, ${recovered >= drop ? "more than the whole fall" : `${pct((recovered / drop) * 100)} of the fall`}.`}`,
  });
  if (level === "hard") {
    questions.push({
      ask: `Exhibit 2 breaks down ${poss(p.segment)} cost. Which line is the cause, and what is it worth to fix?`,
      answer: `${culpritLine.line} went from ${money(culpritLine.last, company)} to ${money(culpritLine.this, company)}, up ${pct(culpritRise)}; the other lines rose by ${money(2, company)} each — noise. ${culpritLine.line} is the cause, and bringing it back to last year's level is worth about ${money(culpritLine.this - culpritLine.last, company)} a year. The trap is to cut the biggest line (${lines[0]}) because it is biggest, rather than the one that moved.`,
    });
    questions.push({
      ask: `Brainstorm: what could the client do about ${culpritLine.line.toLowerCase()} cost in ${p.segment}?`,
      answer: `Group the ideas. ${LEVERS[culpritLine.line]} A strong answer is MECE and says which it would test first.`,
    });
  }
  questions.push({
    ask: level === "hard"
      ? "The CEO walks in. Give your recommendation, the main risk, and the next steps."
      : "What do you recommend to the CEO?",
    answer: `Recommendation: the decline is a ${p.segment} cost problem, not a revenue problem — it explains ${pct(pShare)} of the ${money(drop, company)} fall.${level === "hard" ? ` Attack ${culpritLine.line.toLowerCase()} cost first (worth ~${money(culpritLine.this - culpritLine.last, company)} a year). ${RISKS[culpritLine.line]} Next step: set a ${p.segment} margin target and review it monthly.` : ` Target ${poss(p.segment)} cost base and bring its cost growth back in line with revenue, which recovers about ${money(recovered, company)}.`}`,
  });

  return {
    title: `${company.name}: Why Did Profit Fall ${pct((drop / profitLast) * 100)}?`,
    categorySlug: "profitability",
    tags: ["profitability", "mbb-style", "exhibit-analysis"],
    situation: `${company.name} is a ${company.sector} company ${inGeo(company)}. Revenue was roughly flat last year, but operating profit fell from ${money(profitLast, company)} to ${money(profitThis, company)}. The CEO wants to know why, and what to do about it.`,
    exhibits,
    questions,
    framework: `1. **Profit tree** — revenue (price × volume) and cost (variable, fixed), by segment.\n2. **Locate the change** — compare each segment year on year; find the one that moved.\n3. **Quantify** — profit fall, the segment's share of it, the value of fixing it.${level === "hard" ? "\n4. **Root cause** — drill into that segment's cost lines; the line that moved, not the biggest line.\n5. **Levers** — MECE ideas, prioritised." : ""}\n${level === "hard" ? "6" : "4"}. **Synthesis** — answer first, then evidence, risk and next steps.`,
    marking: {
      structure: "Profit split into revenue (price × volume) and cost (variable/fixed) by segment, with a hypothesis before the data. Penalise jumping to a cause.",
      maths: `Correct profit fall (${money(drop, company)}) and ${poss(p.segment)} share (${pct(pShare)}).${level !== "easy" ? ` Credit the in-line cost counterfactual (${money(recovered, company)}).` : ""}`,
      exhibit: `Spots that revenue is flat and ${poss(p.segment)} cost is what moved.${level === "hard" ? ` In Exhibit 2, identifies ${culpritLine.line} as the line that moved — not the largest line.` : ""}`,
      creativity: "Ideas grouped MECE (price, volume, process, pass-through), with a view on which to test first.",
      synthesis: "Leads with the answer, backs it with the numbers, names the main risk and concrete next steps.",
    },
  };
};

// -------------------------------------------------------- market entry ----

const marketEntry: ArchetypeBuilder = (company, rng, level) => {
  const country = rng.pick(["Indonesia", "Vietnam", "Mexico", "Brazil", "Nigeria", "Poland", "the Philippines", "Egypt"]);
  const population = rng.int(40, 220); // millions
  const targetPct = rng.int(8, 20);
  const frequency = rng.int(2, 8); // purchases per customer per year
  const c = currency(company);
  // Spend per purchase in the client's currency, kept to a plausible ticket.
  const priceRange: Record<string, [number, number]> = { "₹": [80, 600], "¥": [500, 3000] };
  const [lo, hi] = priceRange[c.symbol] ?? [4, 25];
  const price = rng.int(lo, hi);
  // Market value in "big" units: population(M) × share × frequency × price.
  const customersM = (population * targetPct) / 100;
  const marketBig = (customersM * 1_000_000 * frequency * price) / c.multiplier;
  const share = rng.int(4, 10);
  const marginPct = rng.int(15, 30);
  const revenue = (marketBig * share) / 100;
  const annualProfit = (revenue * marginPct) / 100;
  const investment = Math.max(1, Math.round(annualProfit * rng.float(2.5, 6, 1)));
  const payback = investment / annualProfit;
  const leaderShare = rng.int(35, 60);

  const exhibits: Record<string, unknown> = {
    "Exhibit 1 — market facts": {
      [`population of ${country} (millions)`]: population,
      "share in the target segment": pct(targetPct),
      "purchases per customer per year": frequency,
      [`average spend per purchase (${c.symbol})`]: price,
      "expected share by year 3": pct(share),
      "operating margin at scale": pct(marginPct),
      [`entry investment (${c.big})`]: investment,
    },
  };
  const competitors = [
    { player: "Market leader", share: pct(leaderShare), note: "national distribution, strong brand" },
    { player: "Second player", share: pct(Math.round((100 - leaderShare) * 0.45)), note: "price-led" },
    { player: "Long tail of local firms", share: pct(100 - leaderShare - Math.round((100 - leaderShare) * 0.45)), note: "regional" },
  ];
  if (level !== "easy") exhibits["Exhibit 2 — competitors"] = competitors;
  const modes = [
    { mode: "Build organically", [`cost (${c.big})`]: investment, "time to scale": "3 years", "share by year 3": pct(share) },
    { mode: "Acquire a local firm", [`cost (${c.big})`]: Math.round(investment * 1.8), "time to scale": "1 year", "share by year 3": pct(share + 3) },
    { mode: "Joint venture", [`cost (${c.big})`]: Math.round(investment * 0.6), "time to scale": "2 years", "share by year 3": pct(Math.max(2, Math.round(share * 0.6))) },
  ];
  if (level === "hard") exhibits["Exhibit 3 — entry modes"] = modes;

  // Hard: profit at each mode's share, payback per mode.
  const modeRows = modes.map((m) => {
    const s = Number(String(m["share by year 3"]).replace("%", ""));
    const prof = (marketBig * s * marginPct) / 10_000;
    const cost = Number(m[`cost (${c.big})`]);
    return { mode: m.mode, prof, cost, payback: cost / prof };
  });
  const best = [...modeRows].sort((a, b) => a.payback - b.payback)[0];
  const halfSharePayback = investment / (annualProfit / 2);

  const questions: Question[] = [
    {
      ask: `${company.name} is considering entering ${country}. How would you structure whether it should?`,
      answer: "Four questions: (1) is the market attractive — size, growth, profitability; (2) can we win — competitors, our right to win; (3) how should we enter — build, buy or partner; (4) is it worth it — investment, payback, risk. The decision rests on (4), so the structure should lead there.",
    },
    {
      ask: "Use Exhibit 1 to size the market, then work out the annual profit at the expected share and the payback on the investment.",
      answer: `Customers: ${num(population, company)}M × ${pct(targetPct)} = ${num(customersM, company, 1)}M. Market = ${num(customersM, company, 1)}M × ${frequency} purchases × ${c.symbol}${price} = about ${money(marketBig, company)} a year. At ${pct(share)} share, revenue is ${money(revenue, company, 1)}, and at a ${pct(marginPct)} margin annual profit is ${money(annualProfit, company, 1)}. Payback on ${money(investment, company)} is ${num(payback, company, 1)} years.`,
    },
  ];
  if (level !== "easy") {
    questions.push({
      ask: `Exhibit 2 shows the competitors. Is ${pct(share)} share by year 3 realistic? What happens to payback if the client gets half of it?`,
      answer: `The leader holds ${pct(leaderShare)} with national distribution, so ${pct(share)} for a newcomer in three years is ambitious. At half the share, annual profit halves to ${money(annualProfit / 2, company, 1)} and payback stretches to ${num(halfSharePayback, company, 1)} years — the decision should be tested on that number, not the plan's.`,
    });
  }
  if (level === "hard") {
    questions.push({
      ask: "Exhibit 3 compares entry modes. Which gives the fastest payback, and is that the one you would pick?",
      answer: `Payback by mode: ${modeRows.map((m) => `${m.mode.toLowerCase()} ${num(m.payback, company, 1)} years`).join("; ")}. Fastest is "${best.mode}". But payback is not the only test: acquiring buys share and speed at a much higher cost and integration risk; a joint venture is cheapest but caps the upside and control. The trap is choosing on payback alone without asking which mode the client can actually execute.`,
    });
    questions.push({
      ask: `What are the biggest risks of entering ${country}, and how would you reduce them?`,
      answer: "Group them: market (demand lower than sized, price war from the leader), operational (distribution, local talent, supply chain), regulatory (licences, foreign-ownership rules, currency), and execution (management bandwidth at home). Reduce with a staged entry: pilot one region, set kill criteria on share and margin at 12 months, and keep the larger commitment conditional.",
    });
  }
  questions.push({
    ask: level === "hard" ? "Give the CEO your recommendation in 60 seconds: decision, mode, risk and next steps." : "Should the client enter? Give your recommendation.",
    answer: level === "easy"
      ? `${payback <= 4 ? "Enter" : "Do not enter yet"}: the market is about ${money(marketBig, company)} and the plan pays back in ${num(payback, company, 1)} years${payback <= 4 ? ", inside a typical 3-4 year hurdle" : ", longer than a typical 3-4 year hurdle"}. Next, test the share assumption against the competitors before committing.`
      : `${halfSharePayback <= 5 ? "Enter, but stage it" : "Do not commit the full investment now"}: in a market worth about ${money(marketBig, company)}, the plan pays back in ${num(payback, company, 1)} years, but at a realistic half share it is ${num(halfSharePayback, company, 1)} years.${level === "hard" ? ` Choose "${best.mode}" if the client can execute it, pilot first, and set kill criteria on share and margin at 12 months.` : " Pilot one region and decide on the full investment once real share data is in."}`,
  });

  return {
    title: `Should ${company.name} Enter ${country}?`,
    categorySlug: "market-entry",
    tags: ["market-entry", "market-sizing", "mbb-style"],
    situation: `${company.name}, a ${company.sector} company based ${inGeo(company)}, is looking at ${country} as its next market. Growth at home has slowed and the board wants to know whether ${country} is worth the investment.`,
    exhibits,
    questions,
    framework: `1. **Attractiveness** — size the market bottom-up from Exhibit 1.\n2. **Economics** — revenue at the expected share, profit at the margin, payback on the investment.${level !== "easy" ? "\n3. **Ability to win** — test the share assumption against the competitors; recompute at a realistic share." : ""}${level === "hard" ? "\n4. **Entry mode** — payback by mode, then execution risk and control.\n5. **Risks** — market, operational, regulatory, execution; staged entry." : ""}\n${level === "easy" ? "3" : level === "medium" ? "4" : "6"}. **Recommendation** — go/no-go with conditions.`,
    marking: {
      structure: "Attractiveness, ability to win, entry mode, economics — leading to a decision rather than a list.",
      maths: `Market ≈ ${money(marketBig, company)}, annual profit ≈ ${money(annualProfit, company, 1)}, payback ≈ ${num(payback, company, 1)} years.${level !== "easy" ? ` At half share, payback ≈ ${num(halfSharePayback, company, 1)} years.` : ""}`,
      exhibit: level === "easy" ? "Uses Exhibit 1's figures correctly, with the units right." : `Challenges the ${pct(share)} share against a ${pct(leaderShare)} leader.${level === "hard" ? ` Compares modes on payback (fastest: "${best.mode}") and on execution risk.` : ""}`,
      creativity: "Risks grouped (market, operational, regulatory, execution) with a mitigation for each — staged entry, kill criteria.",
      synthesis: "A clear go/no-go, the number it rests on, conditions and next steps.",
    },
  };
};

// -------------------------------------------------------------- growth ----

const growth: ArchetypeBuilder = (company, rng, level) => {
  const pool = [
    { option: "Launch a premium range", m: [28, 38] },
    { option: "Enter a new region at home", m: [14, 22] },
    { option: "Sell online direct to customers", m: [18, 30] },
    { option: "Add a services offering", m: [30, 45] },
  ];
  const count = level === "easy" ? 2 : 3;
  const picked = rng.sample(pool, count);
  const options = picked.map((o) => {
    const revenue = rng.int(40, 220);
    const margin = rng.int(o.m[0], o.m[1]);
    const investment = rng.int(60, 300);
    return { option: o.option, revenue, margin, investment };
  });
  const cannibal = level === "hard" ? rng.int(25, 45) : 0;
  const cannibalIdx = 0; // the first option eats into existing sales in "hard"
  const rows = options.map((o, i) => {
    const grossProfit = (o.revenue * o.margin) / 100;
    const profit = i === cannibalIdx && cannibal ? grossProfit * (1 - cannibal / 100) : grossProfit;
    return { ...o, profit, payback: o.investment / profit, grossProfit };
  });
  const byProfit = [...rows].sort((a, b) => b.profit - a.profit)[0];
  const byPayback = [...rows].sort((a, b) => a.payback - b.payback)[0];
  const big = currency(company).big;

  const exhibits: Record<string, unknown> = {
    "Exhibit 1 — growth options (year-3 run rate)": options.map((o) => ({
      option: o.option,
      [`new revenue (${big})`]: o.revenue,
      "operating margin": pct(o.margin),
      [`investment (${big})`]: o.investment,
    })),
  };
  if (level === "hard") {
    exhibits["Exhibit 2 — customer research note"] = {
      finding: `${pct(cannibal)} of the customers expected for "${options[cannibalIdx].option}" say they would otherwise have bought from the existing business.`,
    };
  }

  const questions: Question[] = [
    {
      ask: `${company.name} wants to grow profit over the next three years. How would you think about where growth could come from?`,
      answer: "Organic vs inorganic; within organic — more of the same customers (frequency, share of wallet), new customers (segments, regions, channels) and new offerings (products, services). Then assess each option on profit added, investment, time and risk.",
    },
    {
      ask: `Exhibit 1 lists ${count} options. Work out the profit and payback of each.`,
      answer: rows.map((r) => `${r.option}: ${money(r.revenue, company)} × ${pct(r.margin)} = ${money(r.grossProfit, company, 1)} profit; payback ${money(r.investment, company)} ÷ ${money(r.grossProfit, company, 1)} = ${num(r.investment / r.grossProfit, company, 1)} years.`).join(" "),
    },
  ];
  if (level === "hard") {
    questions.push({
      ask: `Exhibit 2 is a research note on the first option. Does it change your view?`,
      answer: `Yes. ${pct(cannibal)} cannibalisation means only ${pct(100 - cannibal)} of that option's profit is new: ${money(rows[cannibalIdx].profit, company, 1)}, and payback becomes ${num(rows[cannibalIdx].payback, company, 1)} years. The trap is ranking options on gross new revenue without asking how much of it is the client's own sales moving.`,
    });
    questions.push({
      ask: "Brainstorm: what else should the client consider before choosing?",
      answer: "Capability fit (does the client know how to run it?), time to profit, risk of execution, strategic fit (does it build or dilute the brand?), reversibility, and whether options can be sequenced — a cheap fast option funding a larger one.",
    });
  }
  if (level !== "easy") {
    questions.push({
      ask: "Which option adds the most profit, and which pays back fastest? Are they the same?",
      answer: `Most profit: "${byProfit.option}" (${money(byProfit.profit, company, 1)} a year). Fastest payback: "${byPayback.option}" (${num(byPayback.payback, company, 1)} years).${byProfit.option === byPayback.option ? " They agree, which makes the choice easier." : " They differ: the choice depends on whether the client is constrained by capital (favour payback) or by management focus (favour the biggest prize)."}`,
    });
  }
  questions.push({
    ask: level === "hard" ? "Your recommendation to the CEO, with risks and next steps." : "What do you recommend?",
    answer: `Back "${byProfit.option}"${byProfit.option === byPayback.option ? "" : `, and consider "${byPayback.option}" as a fast first step`}: it adds about ${money(byProfit.profit, company, 1)} of profit a year for ${money(byProfit.investment, company)} invested.${level === "hard" ? " Risks: cannibalisation larger than surveyed, execution capability. Next steps: pilot, measure incremental (not gross) sales, then scale." : ""}`,
  });

  return {
    title: `${company.name}: Which Growth Option Should It Back?`,
    categorySlug: "growth-strategy",
    tags: ["growth-strategy", "prioritisation", "mbb-style"],
    situation: `${company.name} is a ${company.sector} company ${inGeo(company)}. The board has set a target to grow operating profit significantly over three years and has shortlisted ${count} options. They can fund one now.`,
    exhibits,
    questions,
    framework: `1. **Growth tree** — existing customers, new customers, new offerings; organic vs inorganic.\n2. **Economics per option** — profit = revenue × margin; payback = investment ÷ profit.${level === "hard" ? "\n3. **Incrementality** — net out cannibalisation before ranking." : ""}\n${level === "hard" ? "4" : "3"}. **Compare** — biggest prize vs fastest payback; capability and risk.\n${level === "hard" ? "5" : "4"}. **Recommend** — one option, why, and how to de-risk it.`,
    marking: {
      structure: "A MECE growth tree (existing customers, new customers, new offerings) and criteria to compare options on.",
      maths: `Correct profit and payback per option; most profit: "${byProfit.option}".${level === "hard" ? ` Nets out ${pct(cannibal)} cannibalisation on the first option.` : ""}`,
      exhibit: level === "hard" ? "Uses Exhibit 2 to adjust the first option rather than ranking on gross revenue." : "Reads Exhibit 1 correctly and compares like with like.",
      creativity: "Raises capability fit, time to profit, reversibility and sequencing, not just the numbers.",
      synthesis: "Recommends one option with the number behind it and a way to de-risk it.",
    },
  };
};

// --------------------------------------------------------- acquisition ----

const acquisition: ArchetypeBuilder = (company, rng, level) => {
  const big = currency(company).big;
  const target = rng.pick(["a regional competitor", "a smaller rival", "a specialist challenger", "a family-owned peer"]);
  const targetRevenue = rng.int(150, 600);
  const ebitdaMargin = rng.int(12, 24);
  const ebitda = (targetRevenue * ebitdaMargin) / 100;
  const sectorMultiple = rng.int(7, 11);
  const askingMultiple = sectorMultiple + rng.int(2, 5);
  const standalone = ebitda * sectorMultiple;
  const asking = ebitda * askingMultiple;
  const premium = asking - standalone;
  const costSynergy = Math.max(1, Math.round(ebitda * rng.float(0.1, 0.35, 2)));
  const integrationCost = Math.max(1, Math.round(costSynergy * rng.float(1, 2, 1)));
  const grossSynergyValue = costSynergy * sectorMultiple;
  const synergyValue = grossSynergyValue - integrationCost;
  const walkAway = standalone + synergyValue;
  const headroom = walkAway - asking;
  const neededSaving = premium / sectorMultiple;
  const revenueSynergy = rng.int(20, 80);
  const revenueSynergyMargin = rng.int(15, 30);
  const revenueSynergyProb = rng.int(30, 60);
  const revenueSynergyProfit = (revenueSynergy * revenueSynergyMargin) / 100;
  const expectedRevenueSynergy = (revenueSynergyProfit * revenueSynergyProb) / 100;
  const expectedRevenueSynergyValue = expectedRevenueSynergy * sectorMultiple;

  const exhibits: Record<string, unknown> = {
    "Exhibit 1 — the target": {
      [`revenue (${big})`]: targetRevenue,
      "EBITDA margin": pct(ebitdaMargin),
      "comparable companies trade at": `${sectorMultiple}× EBITDA`,
      "seller's asking price": `${askingMultiple}× EBITDA`,
    },
  };
  const synergies: Record<string, unknown> = {
    [`cost synergies per year at run rate (${big})`]: costSynergy,
    [`one-off integration cost (${big})`]: integrationCost,
  };
  if (level === "hard") synergies[`revenue synergies per year (${big})`] = revenueSynergy;
  if (level !== "easy") exhibits["Exhibit 2 — synergy estimates"] = synergies;
  if (level === "hard") {
    exhibits["Exhibit 3 — banker's note"] = {
      note: `Revenue synergies assume cross-selling at a ${pct(revenueSynergyMargin)} margin. Similar deals in the sector delivered them about ${pct(revenueSynergyProb)} of the time.`,
    };
  }

  const questions: Question[] = [
    {
      ask: `${company.name} is considering buying ${target}. How would you evaluate the deal?`,
      answer: "Strategic rationale (why buy, why this target), standalone value (what it is worth on its own), synergies (cost and revenue, net of integration cost), price (what we would pay vs what it is worth to us) and risks (integration, people, culture, overpaying). The deal works only if standalone value plus the synergies we keep is more than the price.",
    },
    {
      ask: "Using Exhibit 1, what is the target worth on its own, what is the seller asking, and what premium is that?",
      answer: `EBITDA = ${money(targetRevenue, company)} × ${pct(ebitdaMargin)} = ${money(ebitda, company, 1)}. At the sector's ${sectorMultiple}×, standalone value is ${money(standalone, company, 1)}. At ${askingMultiple}× the seller is asking ${money(asking, company, 1)} — a premium of ${money(premium, company, 1)}, or ${pct((premium / standalone) * 100)} over standalone value.`,
    },
  ];
  if (level !== "easy") {
    questions.push({
      ask: "Exhibit 2 gives the synergy estimates. What are they worth, net of integration cost, and what is the most the client should pay?",
      answer: `Cost synergies of ${money(costSynergy, company)} a year at ${sectorMultiple}× are worth ${money(grossSynergyValue, company, 1)}; less the ${money(integrationCost, company)} integration cost, ${money(synergyValue, company, 1)}. Walk-away price = standalone value + net synergies = ${money(standalone, company, 1)} + ${money(synergyValue, company, 1)} = ${money(walkAway, company, 1)} (${num(walkAway / ebitda, company, 1)}× EBITDA). ${headroom >= 0 ? `The asking price is ${money(headroom, company, 1)} below that, so the deal creates value even at the asking price — but the seller's premium takes ${pct((premium / synergyValue) * 100)} of the synergies.` : `The asking price is ${money(-headroom, company, 1)} above it: at that price the client would hand the seller more than all of the synergies are worth.`}`,
    });
  }
  if (level === "hard") {
    questions.push({
      ask: "The bankers also list revenue synergies. Read Exhibit 3. How much weight would you give them?",
      answer: `${money(revenueSynergy, company)} of extra revenue at ${pct(revenueSynergyMargin)} margin is ${money(revenueSynergyProfit, company, 1)} of profit a year, but delivered only ${pct(revenueSynergyProb)} of the time — an expected ${money(expectedRevenueSynergy, company, 1)} a year, about ${money(expectedRevenueSynergyValue, company, 1)} capitalised. Don't pay for it: price the deal on cost synergies, which the client controls, and treat revenue synergies as upside.${headroom < 0 && headroom + expectedRevenueSynergyValue >= 0 ? " Here the deal only clears the asking price if you count them — a sign to push the price down, not to stretch." : ""} The trap is adding the bankers' full revenue figure to the price.`,
    });
    questions.push({
      ask: "What could go wrong after the deal closes?",
      answer: "Integration (systems, overlapping teams, slower than planned), people (key staff and customers leaving), culture clash, synergies taking longer or costing more, and distraction from the core business. Mitigate with a 100-day integration plan, retention packages for key people, and a named owner and target for each synergy.",
    });
  }
  questions.push({
    ask: level === "hard" ? "Give your recommendation: buy or not, at what price, and the conditions." : "What do you recommend?",
    answer: level === "easy"
      ? `Only proceed if synergies the client controls can cover the ${money(premium, company, 1)} premium. At ${sectorMultiple}×, that means at least ${money(neededSaving, company, 1)} a year of savings. Next step: size the cost synergies in diligence before making an offer.`
      : headroom >= 0
        ? `Buy, but negotiate: open near standalone value (${money(standalone, company, 1)}) and walk away above ${money(walkAway, company, 1)}. Every ${big === "Cr" ? "crore" : "million"} below the walk-away is synergy the client keeps.${level === "hard" ? " Price on cost synergies only, treat revenue synergies as upside, and make retention of key staff a condition of signing." : ""}`
        : `Do not buy at the asking price. Offer up to ${money(walkAway, company, 1)} (${num(walkAway / ebitda, company, 1)}× EBITDA) and walk away if the seller holds at ${money(asking, company, 1)}.${level === "hard" ? " Do not close the gap with revenue synergies; if a deal is struck, make retention of key staff a condition of signing." : ""}`,
  });

  return {
    title: `Should ${company.name} Buy a ${titleCase(target.replace(/^a /, ""))}?`,
    categorySlug: "growth-strategy",
    tags: ["mergers-acquisitions", "valuation", "mbb-style"],
    situation: `${company.name} is a ${company.sector} company ${inGeo(company)}. Its CEO has been approached about acquiring ${target} and wants a view on whether to go ahead and what to pay.`,
    exhibits,
    questions,
    framework: `1. **Rationale** — why buy, why this target.\n2. **Standalone value and premium** — EBITDA × sector multiple vs the asking price.${level !== "easy" ? "\n3. **Synergies** — capitalised cost synergies net of integration cost; the walk-away price." : ""}${level === "hard" ? "\n4. **Synergy quality** — weight revenue synergies by probability; don't pay for them.\n5. **Risks** — integration, people, culture." : ""}\n${level === "easy" ? "3" : level === "medium" ? "4" : "6"}. **Recommendation** — buy or not, the price range, the conditions.`,
    marking: {
      structure: "Rationale, standalone value, synergies, price vs value, risks — ending in a price decision.",
      maths: `EBITDA ${money(ebitda, company, 1)}; standalone ${money(standalone, company, 1)}; asking ${money(asking, company, 1)}; premium ${money(premium, company, 1)}.${level !== "easy" ? ` Net synergy value ${money(synergyValue, company, 1)}; walk-away ${money(walkAway, company, 1)}.` : ` Savings needed to justify the premium: ${money(neededSaving, company, 1)} a year.`}${level === "hard" ? ` Expected revenue synergy ${money(expectedRevenueSynergy, company, 1)} a year.` : ""}`,
      exhibit: level === "hard" ? "Discounts revenue synergies using Exhibit 3 rather than paying for them in full." : "Separates standalone value from the asking price, and states units.",
      creativity: "Post-deal risks grouped (integration, people, culture, synergy delivery) with a mitigation for each.",
      synthesis: "Buy or not, at what price, and the conditions — not just 'it depends'.",
    },
  };
};

// ------------------------------------------------------------- pricing ----

const pricing: ArchetypeBuilder = (company, rng, level) => {
  const c = currency(company);
  const unit = c.symbol;
  const priceRange: Record<string, [number, number]> = { "₹": [200, 2000], "¥": [1000, 9000] };
  const [lo, hi] = priceRange[unit] ?? [20, 180];
  const price = rng.int(lo, hi);
  const variableCost = Math.round(price * rng.float(0.45, 0.7, 2));
  const volumeK = rng.int(200, 900); // thousand units a year
  const increase = rng.pick([5, 8, 10, 12, 15]);
  const contribution = (vK: number, p: number) => ((p - variableCost) * vK * 1000) / c.multiplier;
  const newPrice = price * (1 + increase / 100);
  const marginPct = ((price - variableCost) / price) * 100;
  const margin1 = Number(marginPct.toFixed(1));
  const breakevenLoss = (increase / (marginPct + increase)) * 100;
  const before = contribution(volumeK, price);

  // Two segments, built either side of break-even so the segment view matters:
  // loyal customers lose well under it, switchers well over it. The overall
  // elasticity in the hard case is their weighted average, so the exhibits agree.
  const loyalShare = rng.int(40, 65);
  const loyalE = Math.min(-0.1, -Number(((breakevenLoss * rng.float(0.2, 0.5, 2)) / increase).toFixed(1)));
  const switcherE = -Number(((breakevenLoss * rng.float(1.4, 2.2, 2)) / increase).toFixed(1));
  const seg = (share: number, e: number) => {
    const v = (volumeK * share) / 100;
    return { before: contribution(v, price), after: contribution(v * (1 + (e * increase) / 100), newPrice), loss: -e * increase };
  };
  const loyal = seg(loyalShare, loyalE);
  const switchers = seg(100 - loyalShare, switcherE);
  const targeted = loyal.after + switchers.before;

  const elasticity = level === "hard"
    ? Number(((loyalShare * loyalE + (100 - loyalShare) * switcherE) / 100).toFixed(2))
    : rng.float(-1.6, -0.6, 1);
  const volumeLoss = -elasticity * increase;
  const newVolume = volumeK * (1 - volumeLoss / 100);
  const after = level === "hard" ? loyal.after + switchers.after : contribution(newVolume, newPrice);
  const big = c.big;

  const exhibits: Record<string, unknown> = {
    "Exhibit 1 — current economics": {
      [`price per unit (${unit})`]: price,
      [`variable cost per unit (${unit})`]: variableCost,
      "volume (thousand units a year)": volumeK,
      "proposed price increase": pct(increase),
    },
  };
  if (level !== "easy") exhibits["Exhibit 2 — demand sensitivity"] = { "estimated price elasticity (all customers)": elasticity };
  if (level === "hard") {
    exhibits["Exhibit 3 — customer segments"] = [
      { segment: "Loyal (long-term contracts)", "share of volume": pct(loyalShare), elasticity: loyalE },
      { segment: "Price-sensitive switchers", "share of volume": pct(100 - loyalShare), elasticity: switcherE },
    ];
  }

  const questions: Question[] = [
    {
      ask: `${company.name} is considering a ${pct(increase)} price increase. How would you decide whether to do it?`,
      answer: "Profit impact = margin gained on the units kept − margin lost on the units that leave. So: current unit economics, how sensitive demand is (and for whom), competitor response, and brand or contract constraints. Then test whether the expected volume loss is below the break-even loss.",
    },
  ];
  if (level === "easy") {
    questions.push({
      ask: `If volume falls ${pct(volumeLoss, 1)} after the increase, what happens to annual contribution?`,
      answer: `Before: (${unit}${num(price, company)} − ${unit}${num(variableCost, company)}) × ${num(volumeK, company)}k units = ${money(before, company, 1)}. After: price ${unit}${num(newPrice, company, 1)}, volume ${num(newVolume, company, 1)}k → ${money(after, company, 1)}. Contribution ${after >= before ? "rises" : "falls"} by ${money(Math.abs(after - before), company, 1)}.`,
    });
  } else {
    questions.push({
      ask: "What is the most volume the client could lose and still be no worse off? Then use Exhibit 2 to estimate what will actually happen.",
      answer: `Contribution margin is ${margin1}%. Break-even volume loss = increase ÷ (margin + increase) = ${increase} ÷ (${margin1} + ${increase}) = ${pct(breakevenLoss, 1)}. With elasticity ${elasticity}, expected loss is ${pct(volumeLoss, 1)} — ${volumeLoss < breakevenLoss ? "below" : "above"} break-even, so contribution ${after >= before ? "rises" : "falls"} from ${money(before, company, 1)} to ${money(after, company, 1)}.`,
    });
  }
  if (level === "hard") {
    questions.push({
      ask: "Exhibit 3 splits customers into two segments. Would you raise price for everyone?",
      answer: `No. Loyal customers (elasticity ${loyalE}) would cut volume by ${pct(loyal.loss, 1)}, well under the ${pct(breakevenLoss, 1)} break-even; switchers (${switcherE}) would cut by ${pct(switchers.loss, 1)}, well over it. Raising price for loyal customers only gives ${money(targeted, company, 1)} of contribution, against ${money(after, company, 1)} for a blanket increase and ${money(before, company, 1)} today. The trap is deciding on the average elasticity, which hides two very different groups.`,
    });
  }
  if (level !== "easy") {
    questions.push({
      ask: "How might competitors and customers respond, and how would you protect the increase?",
      answer: "Competitors may hold price to win switchers, or follow if they face the same cost pressure; customers may trade down or renegotiate contracts. Protect it with value framing (what the price buys), timing it with contract renewals, a better-value tier for switchers, and a watch on churn and win/loss rates in the first quarter.",
    });
  }
  questions.push({
    ask: level === "hard" ? "Your recommendation, with the risk and what you would monitor." : "What do you recommend?",
    answer: level === "hard"
      ? `Raise price for loyal, contracted customers and hold it for switchers: contribution goes from ${money(before, company, 1)} to about ${money(targeted, company, 1)}, ${money(targeted - after, company, 1)} more than a blanket increase. Risk: loyal customers may be less loyal than surveyed — monitor renewal rates monthly and roll back if their volume loss passes the ${pct(breakevenLoss, 1)} break-even.`
      : `${after >= before ? "Go ahead" : "Hold off"}: contribution ${after >= before ? "rises" : "falls"} from ${money(before, company, 1)} to ${money(after, company, 1)}.${level === "medium" ? ` The answer rests on volume loss staying ${after >= before ? "under" : "over"} ${pct(breakevenLoss, 1)} — test it in one region first.` : " Next, check how sensitive customers really are before rolling it out everywhere."}`,
  });

  return {
    title: `${company.name}: Should Prices Go Up ${pct(increase)}?`,
    categorySlug: "pricing",
    tags: ["pricing", "elasticity", "mbb-style"],
    situation: `${company.name} is a ${company.sector} company ${inGeo(company)}. Costs have risen and the commercial director proposes a ${pct(increase)} price increase across the board. The CEO wants to know whether it will raise profit.`,
    exhibits,
    questions,
    framework: `1. **Unit economics** — price, variable cost, contribution margin.\n2. **Break-even** — the volume the client can afford to lose.${level !== "easy" ? "\n3. **Expected response** — elasticity → expected volume loss vs break-even." : ""}${level === "hard" ? "\n4. **Segments** — raise price where demand is inelastic; hold it where it is not." : ""}${level !== "easy" ? `\n${level === "hard" ? "5" : "4"}. **Competitive response** — how to protect the increase.` : ""}\n${level === "easy" ? "3" : level === "medium" ? "5" : "6"}. **Recommend** — go, no-go or targeted, with what to monitor.`,
    marking: {
      structure: "Profit impact as margin gained on retained units vs margin lost on lost units, with demand sensitivity and competitor response.",
      maths: `Contribution ${money(before, company, 1)} → ${money(after, company, 1)}.${level !== "easy" ? ` Break-even volume loss ${pct(breakevenLoss, 1)}; expected ${pct(volumeLoss, 1)}.` : ""}${level === "hard" ? ` Targeted increase ≈ ${money(targeted, company, 1)}.` : ""} Units in ${big}.`,
      exhibit: level === "hard" ? "Uses the two segments' elasticities instead of the average." : "Reads price, cost and volume correctly and keeps units straight.",
      creativity: "Anticipates competitor and customer responses and ways to protect the increase.",
      synthesis: "A clear go/no-go/targeted decision, the number behind it, and what to monitor.",
    },
  };
};

// ---------------------------------------------------------- operations ----

const operations: ArchetypeBuilder = (company, rng, level) => {
  const big = currency(company).big;
  const capacityK = rng.int(400, 1200); // thousand units a year
  const utilisation = rng.int(78, 92);
  const demandK = Math.round((capacityK * utilisation) / 100);
  const growthPct = rng.int(6, 14);
  // The first year in which demand is above capacity.
  let years = 0;
  let d = demandK;
  while (d <= capacityK && years < 20) {
    d *= 1 + growthPct / 100;
    years += 1;
  }
  const demand5 = demandK * (1 + growthPct / 100) ** 5;
  const shortfall = Math.max(0, demand5 - capacityK);

  const base = rng.int(8, 30);
  const shiftPct = rng.int(15, 25);
  const linePct = rng.int(30, 50);
  const shiftAnnual = Math.max(1, Math.round(base * rng.float(0.6, 1.2, 2)));
  const outsourceAnnual = Math.max(1, Math.round(base * rng.float(0.9, 1.6, 2)));
  const lineCapex = Math.max(1, Math.round(base * rng.float(3, 6, 1)));
  const productivity = 0.85;
  const shiftCap = (capacityK * shiftPct * (level === "hard" ? productivity : 1)) / 100;
  const lineCap = (capacityK * linePct) / 100;

  const options = [
    { name: "a third shift", cost: shiftAnnual * 5, covers: shiftCap >= shortfall },
    { name: "a new line", cost: lineCapex, covers: lineCap >= shortfall },
    { name: "outsourcing the overflow", cost: outsourceAnnual * 5, covers: true },
  ];
  const best = [...options].filter((o) => o.covers).sort((a, b) => a.cost - b.cost)[0];
  const cheapest = [...options].sort((a, b) => a.cost - b.cost)[0];
  const lineTooLate = years <= 1;

  const exhibits: Record<string, unknown> = {
    "Exhibit 1 — plant capacity and demand": {
      "capacity (thousand units a year)": capacityK,
      "current utilisation": pct(utilisation),
      "demand growth per year": pct(growthPct),
    },
  };
  if (level !== "easy") {
    exhibits["Exhibit 2 — options to add capacity"] = [
      { option: "Add a third shift", "extra capacity": pct(shiftPct), "time to bring online": "3 months", [`upfront cost (${big})`]: 0, [`extra running cost per year (${big})`]: shiftAnnual },
      { option: "Build a new line", "extra capacity": pct(linePct), "time to bring online": "18 months", [`upfront cost (${big})`]: lineCapex, [`extra running cost per year (${big})`]: 0 },
      { option: "Outsource the overflow", "extra capacity": "as needed", "time to bring online": "1 month", [`upfront cost (${big})`]: 0, [`extra running cost per year (${big})`]: outsourceAnnual },
    ];
  }
  if (level === "hard") {
    exhibits["Exhibit 3 — plant manager's note"] = {
      note: "A third shift runs at about 85% of day-shift productivity, and quality complaints rose the last time we tried one.",
    };
  }

  const questions: Question[] = [
    {
      ask: `${poss(company.name)} main plant is filling up. How would you structure the problem?`,
      answer: "When do we run out (capacity vs demand over time), how much extra capacity we need, what the options are (more output from what we have, new capacity, buying in), what each costs over the horizon, and the risks (quality, flexibility, demand uncertainty).",
    },
    {
      ask: "Using Exhibit 1, when does demand exceed capacity, and how short is the plant by year 5?",
      answer: `Demand today is ${pct(utilisation)} of ${num(capacityK, company)}k = ${num(demandK, company)}k units. Growing ${pct(growthPct)} a year, it passes ${num(capacityK, company)}k in year ${years}. By year 5 it is ${num(demand5, company)}k — ${shortfall > 0 ? `${num(shortfall, company)}k units (${pct((shortfall / capacityK) * 100)} of capacity) short` : "still within capacity"}. That is the gap any option must close, and the date it must be ready by.`,
    },
  ];
  if (level !== "easy") {
    questions.push({
      ask: "Exhibit 2 shows three options. What does each cost over five years, and does each close the year-5 gap?",
      answer: `Third shift: ${money(shiftAnnual, company)} × 5 = ${money(shiftAnnual * 5, company)}, adds ${num((capacityK * shiftPct) / 100, company)}k units — ${(capacityK * shiftPct) / 100 >= shortfall ? "enough" : "not enough"}. New line: ${money(lineCapex, company)} upfront, adds ${num(lineCap, company)}k — ${lineCap >= shortfall ? "enough, but it takes 18 months" : "not enough, and it takes 18 months"}. Outsourcing: ${money(outsourceAnnual, company)} × 5 = ${money(outsourceAnnual * 5, company)}, as much as needed. Cheapest on cost alone: ${cheapest.name}.`,
    });
  }
  if (level === "hard") {
    questions.push({
      ask: "Read Exhibit 3. Does it change your answer?",
      answer: `At 85% productivity the shift adds about ${num(shiftCap, company)}k units, not ${num((capacityK * shiftPct) / 100, company)}k — ${shiftCap >= shortfall ? "still enough for the gap, but each good unit costs more, before any quality cost" : `short of the ${num(shortfall, company)}k gap, so it buys time but does not solve the problem`}. The trap is comparing options on cost alone without checking that each one covers the need.`,
    });
    questions.push({
      ask: "What else could increase output before spending on new capacity?",
      answer: "Debottleneck the constraint step, cut changeover and downtime (raise OEE), reduce scrap and rework, shift the mix toward higher-margin products, and smooth demand with pricing or lead times. These are usually cheaper and faster than new capacity.",
    });
  }
  const bestLine = best.name === "a new line";
  questions.push({
    ask: level === "hard" ? "Your recommendation to the COO: what, when, and the risks." : "What do you recommend?",
    answer: level === "easy"
      ? `The plant runs out of capacity in year ${years} and is ${num(shortfall, company)}k units short by year 5. Decide on extra capacity now — new capacity takes time to bring online.`
      : `${level === "hard" ? "Debottleneck first, then go with " : "Go with "}${best.name} — the cheapest option that closes the year-5 gap (${money(best.cost, company)} over five years).${bestLine && lineTooLate ? " The line takes 18 months and the plant runs out sooner, so outsource the overflow as a bridge." : bestLine ? ` Start now so it is running before year ${years}.` : ""}${level === "hard" ? " Risks: demand growing slower than forecast (stage the investment), and quality if a shift is used." : ""}`,
  });

  return {
    title: `${company.name}: Running Out of Capacity`,
    categorySlug: "operations",
    tags: ["operations", "capacity", "mbb-style"],
    situation: `${company.name} is a ${company.sector} company ${inGeo(company)}. Its main plant is running at ${pct(utilisation)} of capacity and demand keeps growing. The COO needs a plan before customers start waiting.`,
    exhibits,
    questions,
    framework: `1. **Deadline and gap** — when demand passes capacity, and the shortfall by year 5.${level !== "easy" ? "\n2. **Options** — five-year cost of each, and whether it closes the gap in time." : ""}${level === "hard" ? "\n3. **Reality check** — real productivity and quality.\n4. **Cheaper first** — debottlenecking, OEE, mix." : ""}\n${level === "easy" ? "2" : level === "medium" ? "3" : "5"}. **Plan** — what, by when, and how to de-risk it.`,
    marking: {
      structure: "Deadline, gap, options, five-year cost, risks — leading to a timed plan.",
      maths: `Capacity runs out in year ${years}; year-5 shortfall ${num(shortfall, company)}k units.${level !== "easy" ? ` Five-year costs: shift ${money(shiftAnnual * 5, company)}, line ${money(lineCapex, company)}, outsourcing ${money(outsourceAnnual * 5, company)}.` : ""}`,
      exhibit: level === "hard" ? "Uses Exhibit 3 to cut the shift's real capacity, and checks each option against the gap." : "Reads utilisation and growth correctly and keeps units straight.",
      creativity: "Cheaper ways to raise output before new capacity: debottlenecking, OEE, scrap, mix, demand smoothing.",
      synthesis: "A plan with timing tied to the deadline and how to de-risk it.",
    },
  };
};

/** Each case type, with the client companies it suits. */
const ARCHETYPES: Array<{ build: ArchetypeBuilder; companies: Company[] }> = [
  { build: profitability, companies: COMPANIES },
  { build: marketEntry, companies: companiesNamed(CONSUMER) },
  { build: growth, companies: COMPANIES },
  { build: acquisition, companies: COMPANIES },
  { build: pricing, companies: companiesNamed(PRODUCT_SELLERS) },
  { build: operations, companies: companiesNamed(MAKERS) },
];

// --------------------------------------------------------------- render ----

function rubricFor(level: Level, marking: Built["marking"]) {
  const weights: Record<Level, Record<string, number>> = {
    easy: { structure: 30, quantitative_analysis: 35, synthesis: 35 },
    medium: { structure: 25, exhibit_analysis: 20, quantitative_analysis: 25, synthesis: 30 },
    hard: { structure: 20, exhibit_analysis: 20, quantitative_analysis: 25, creativity: 10, synthesis: 25 },
  };
  const descriptor: Record<string, string> = {
    structure: marking.structure,
    exhibit_analysis: marking.exhibit,
    quantitative_analysis: `${marking.maths} Show the working; a right answer with no working earns partial credit.`,
    creativity: marking.creativity,
    synthesis: marking.synthesis,
  };
  const criteria = weights[level];
  return {
    criteria,
    descriptors: Object.fromEntries(Object.keys(criteria).map((k) => [k, descriptor[k]])),
    passScore: 60,
  };
}

function render(firm: MbbFirm, level: Level, built: Built): Omit<MbbCase, "slug" | "companyTrack"> {
  const interviewerLed = firm.led === "interviewer";
  const format = interviewerLed
    ? `**Format: interviewer-led**, the way ${firm.track}'s problem-solving interview runs. The interviewer asks the questions below one at a time. Answer each under its number, show your maths, and lead each answer with the conclusion.`
    : `**Format: candidate-led**, the way ${firm.track} runs its case interviews. You drive the case: set out your structure, decide which exhibit you need and when, and close with a recommendation without being asked. The points below are what your answer must cover.`;
  const scenario = `${built.situation}\n\n${format}\n\n${firm.track} interviewers listen for ${firm.emphasis}.`;
  const instructions = interviewerLed
    ? built.questions.map((q, i) => `**Question ${i + 1}.** ${q.ask}`).join("\n\n")
    : `Drive the case. Your answer should cover:\n\n${built.questions.map((q, i) => `${i + 1}. ${q.ask}`).join("\n")}`;
  const modelAnswer = built.questions.map((q, i) => `**${i + 1}. ${q.ask}**\n\n${q.answer}`).join("\n\n");
  return {
    title: built.title,
    domain: "consulting",
    difficulty: level,
    categorySlug: built.categorySlug,
    estimatedMinutes: MINUTES[level],
    scenario,
    instructions,
    supportingData: built.exhibits,
    expectedFramework: built.framework,
    modelAnswer,
    tags: [...built.tags, interviewerLed ? "interviewer-led" : "candidate-led", firm.slug],
    rubric: rubricFor(level, built.marking),
  };
}

/** How many cases each firm gets at each level. */
export const CASES_PER_FIRM_LEVEL = 3;
const LEVELS: Level[] = ["easy", "medium", "hard"];

/**
 * The whole MBB-style set: every firm × every level × CASES_PER_FIRM_LEVEL,
 * rotating case types and client companies so no firm sees the same pairing
 * twice at a level.
 */
export function buildMbbCases(): MbbCase[] {
  const out: MbbCase[] = [];
  const turns = new Map<(typeof ARCHETYPES)[number], number>();
  MBB_FIRMS.forEach((firm, fi) => {
    LEVELS.forEach((level, li) => {
      for (let k = 0; k < CASES_PER_FIRM_LEVEL; k++) {
        // Three consecutive case types per firm and level, shifted by two each
        // level: every firm meets all six types, and every level has all six.
        const archetype = ARCHETYPES[(fi * 3 + li * 2 + k) % ARCHETYPES.length];
        // Walk each type's company list in turn, so the same client does not
        // keep coming back for the same kind of case.
        const turn = turns.get(archetype) ?? 0;
        turns.set(archetype, turn + 1);
        const company = archetype.companies[(turn + ARCHETYPES.indexOf(archetype) * 4) % archetype.companies.length];
        const rng = createRng(70_000 + fi * 997 + li * 101 + k * 13);
        const built = archetype.build(company, rng, level);
        out.push({
          ...render(firm, level, built),
          slug: `mbb-${firm.slug}-${level}-${k + 1}`,
          companyTrack: firm.track,
        });
      }
    });
  });
  return out;
}
