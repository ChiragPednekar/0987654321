/**
 * Shared plumbing for case generation.
 *
 * Cases are composed from archetypes (the analytical shape of the problem)
 * crossed with company profiles and seeded numbers. The RNG is deterministic,
 * so `npm run seed` produces the same 300 cases every time — re-running it
 * updates rows in place rather than creating duplicates.
 */

import type { Difficulty, Domain } from "../../src/lib/types/database";

// ------------------------------------------------------------------ rng ----

/** Mulberry32 — small, fast, deterministic. */
export function createRng(seed: number) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    /** Float in [min, max], rounded to `digits`. */
    float: (min: number, max: number, digits = 1) =>
      Number((next() * (max - min) + min).toFixed(digits)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    /** `count` distinct items, or all of them if the pool is smaller. */
    sample: <T>(items: readonly T[], count: number): T[] => {
      const pool = [...items];
      const out: T[] = [];
      while (out.length < count && pool.length > 0) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      }
      return out;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

// ------------------------------------------------------------ companies ----

export interface Company {
  name: string;
  sector: string;
  geo: string;
  /** Rough stage, used to keep the numbers plausible. */
  stage: "startup" | "growth" | "mature";
}

export const COMPANIES: Company[] = [
  { name: "Vantage Analytics", sector: "B2B SaaS", geo: "India", stage: "growth" },
  { name: "Kirana Connect", sector: "retail tech", geo: "India", stage: "growth" },
  { name: "Meridian Foods", sector: "packaged foods", geo: "India", stage: "mature" },
  { name: "Bluepeak Logistics", sector: "logistics", geo: "Southeast Asia", stage: "mature" },
  { name: "Nimbus Health", sector: "digital health", geo: "US", stage: "growth" },
  { name: "Corveta Motors", sector: "automotive", geo: "Europe", stage: "mature" },
  { name: "Halcyon Bank", sector: "retail banking", geo: "UK", stage: "mature" },
  { name: "Tessellate", sector: "developer tools", geo: "US", stage: "startup" },
  { name: "Saffron Retail", sector: "apparel retail", geo: "India", stage: "mature" },
  { name: "Northwind Energy", sector: "renewables", geo: "Europe", stage: "growth" },
  { name: "Pallas Pharma", sector: "specialty pharma", geo: "US", stage: "mature" },
  { name: "Otter Payments", sector: "fintech", geo: "Southeast Asia", stage: "growth" },
  { name: "Granite Materials", sector: "building materials", geo: "India", stage: "mature" },
  { name: "Lumen Learning", sector: "edtech", geo: "India", stage: "growth" },
  { name: "Wavelength Media", sector: "streaming", geo: "US", stage: "growth" },
  { name: "Ferro Industries", sector: "industrial components", geo: "Europe", stage: "mature" },
  { name: "Basil & Co", sector: "quick service restaurants", geo: "India", stage: "growth" },
  { name: "Quantile Capital", sector: "asset management", geo: "UK", stage: "mature" },
  { name: "Solstice Travel", sector: "online travel", geo: "Southeast Asia", stage: "growth" },
  { name: "Verity Insurance", sector: "insurance", geo: "US", stage: "mature" },
  { name: "Amber Grid", sector: "utilities", geo: "Europe", stage: "mature" },
  { name: "Pinecrest Grocers", sector: "grocery", geo: "US", stage: "mature" },
  { name: "Cobalt Robotics", sector: "industrial robotics", geo: "Japan", stage: "growth" },
  { name: "Marlow Chemicals", sector: "specialty chemicals", geo: "India", stage: "mature" },
  { name: "Driftwood Hotels", sector: "hospitality", geo: "Southeast Asia", stage: "mature" },
];

/** Currency unit matching the company's geography. */
/**
 * `multiplier` is how many base units one `big` unit is worth — needed
 * whenever a case mixes a headline figure ("₹40 Cr of spend") with a
 * per-unit one ("cost per customer"), which the marketing cases do.
 */
export function currency(company: Company): {
  symbol: string;
  big: string;
  multiplier: number;
} {
  switch (company.geo) {
    case "India":
      return { symbol: "₹", big: "Cr", multiplier: 10_000_000 };
    case "Europe":
      return { symbol: "€", big: "M", multiplier: 1_000_000 };
    case "UK":
      return { symbol: "£", big: "M", multiplier: 1_000_000 };
    case "Japan":
      return { symbol: "¥", big: "B", multiplier: 1_000_000_000 };
    default:
      return { symbol: "$", big: "M", multiplier: 1_000_000 };
  }
}

// ------------------------------------------------------------ archetypes ----

export interface BuiltCase {
  title: string;
  scenario: string;
  instructions: string;
  supportingData: Record<string, unknown>;
  expectedFramework: string;
  modelAnswer: string;
}

export interface Archetype {
  /** Stable id — combined with the variant index to form the slug. */
  id: string;
  categorySlug: string;
  domain: Domain;
  difficulty: Difficulty;
  estimatedMinutes: number;
  tags: string[];
  rubric: {
    criteria: Record<string, number>;
    descriptors: Record<string, string>;
    passScore: number;
  };
  build: (company: Company, rng: Rng) => BuiltCase;
}

export const COMPANY_TRACKS = [
  "McKinsey",
  "BCG",
  "Bain",
  "Goldman Sachs",
  "Morgan Stanley",
  "Google",
  "Amazon",
  "Stripe",
  "Flipkart",
  "Razorpay",
] as const;

/**
 * Expands archetypes across company profiles until `target` cases exist.
 * Each (archetype, company) pair gets its own seed, so numbers differ between
 * variants but never between runs.
 */
export function expand(
  archetypes: Archetype[],
  target: number,
  seedBase: number,
): Array<BuiltCase & { archetype: Archetype; slug: string; companyTrack: string }> {
  const out: Array<
    BuiltCase & { archetype: Archetype; slug: string; companyTrack: string }
  > = [];

  let round = 0;
  while (out.length < target) {
    for (const archetype of archetypes) {
      if (out.length >= target) break;

      const companyIndex = (round * 7 + archetypes.indexOf(archetype) * 3) %
        COMPANIES.length;
      const company = COMPANIES[companyIndex];
      const rng = createRng(seedBase + out.length * 1013 + round * 31);
      const built = archetype.build(company, rng);

      out.push({
        ...built,
        archetype,
        slug: `${archetype.id}-${round + 1}`,
        companyTrack: rng.pick(COMPANY_TRACKS),
      });
    }
    round += 1;

    // Safety valve: an empty archetype list would spin forever.
    if (round > 200) break;
  }

  return out;
}
