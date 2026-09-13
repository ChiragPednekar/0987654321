/**
 * The business simulation's market model.
 *
 * ---------------------------------------------------------------------------
 * Deterministic, and not an AI
 * ---------------------------------------------------------------------------
 * The obvious way to build this would be to describe the situation to a model
 * and ask what happens. That would be wrong on three counts.
 *
 * A simulation teaches by having a causal structure the student can infer.
 * Cutting price must always move share in the same direction by the same
 * amount, or there is nothing to learn — only a story. A model asked the same
 * question twice will not answer the same way, so the student cannot test a
 * hypothesis, which is the entire exercise.
 *
 * It would also cost a model call per round per player, on a feature whose
 * whole appeal is that a student can run it ten times in an evening. And a
 * model doing arithmetic over a P&L is the least reliable thing it does.
 *
 * So the market is a closed-form model in this file: pure, synchronous, and
 * unit-tested. The AI appears once, at the end, to read the sequence of
 * decisions and say what the student's pattern reveals — which is a judgement
 * about a person, and the thing models are actually good at.
 *
 * Pure and free of `server-only` so the client can project a round before it
 * is committed. The server is still the only place a round is scored.
 */

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------
// Chosen so that a sensible opening — hold price, maintain brand and quality,
// grow capacity with demand — is modestly profitable, and so that each lever
// has a visible effect without any single one dominating.

export const SIM = {
  rounds: 8,
  /** Units in round 1. */
  marketSize: 200_000,
  marketGrowth: 0.08,
  /** Price at which the reference product is judged neither cheap nor dear. */
  referencePrice: 1_200,
  /** Unit cost at the starting cumulative volume, before any learning. */
  baseUnitCost: 700,
  unitCostFloor: 420,
  /** 90% learning curve: every doubling of cumulative volume takes 10% out of unit cost. */
  learningExponent: -0.152,
  /** Annual capacity costs this much to build, and is usable from the next round. */
  capacityCostPerUnit: 1_200,
  /** Fixed cost per unit of capacity per round, whether or not it is used. */
  capacityUpkeepPerUnit: 180,
  overheadPerRound: 7_000_000,
  interestPerRound: 0.03,
  /** Borrowing beyond this multiple of starting equity ends the run. */
  debtCeiling: 150_000_000,
  startingCash: 30_000_000,
  startingCapacity: 70_000,
  startingQuality: 50,
  startingBrand: 50,
  startingCumulativeVolume: 60_000,
} as const;

export interface Segment {
  key: "value" | "premium";
  label: string;
  /** Share of the total market. */
  weight: number;
  priceSensitivity: number;
  qualityWeight: number;
  brandWeight: number;
}

export const SEGMENTS: Segment[] = [
  {
    key: "value",
    label: "Value buyers",
    weight: 0.6,
    priceSensitivity: 3.5,
    qualityWeight: 0.5,
    brandWeight: 0.6,
  },
  {
    key: "premium",
    label: "Premium buyers",
    weight: 0.4,
    priceSensitivity: 1.8,
    qualityWeight: 1.8,
    brandWeight: 1.0,
  },
];

export interface Decisions {
  price: number;
  marketing: number;
  rnd: number;
  capacityInvestment: number;
}

export interface FirmState {
  name: string;
  cash: number;
  debt: number;
  capacity: number;
  /** Capacity bought last round, usable from this one. */
  capacityInBuild: number;
  quality: number;
  brand: number;
  cumulativeVolume: number;
  equity: number;
}

export interface FirmResult {
  name: string;
  price: number;
  demand: number;
  unitsSold: number;
  lostSales: number;
  revenue: number;
  unitCost: number;
  cogs: number;
  marketing: number;
  rnd: number;
  capacityUpkeep: number;
  overhead: number;
  interest: number;
  profit: number;
  share: number;
  quality: number;
  brand: number;
  cash: number;
  debt: number;
  capacity: number;
}

export interface RoundOutcome {
  round: number;
  marketSize: number;
  firms: FirmResult[];
  /** True when the player's debt broke the ceiling. */
  bankrupt: boolean;
}

/** Unit cost after the learning curve, floored. */
export function unitCost(cumulativeVolume: number): number {
  const ratio = Math.max(1, cumulativeVolume) / SIM.startingCumulativeVolume;
  const cost = SIM.baseUnitCost * Math.pow(ratio, SIM.learningExponent);
  return Math.max(SIM.unitCostFloor, Math.round(cost));
}

/**
 * How attractive one firm's offer is to one segment.
 *
 * Multiplicative rather than additive, so the levers interact the way they do
 * in a real market: quality is worth little to a value buyer at any price, and
 * a premium buyer will not be bought with a discount alone.
 */
export function attractiveness(
  segment: Segment,
  price: number,
  quality: number,
  brand: number,
): number {
  const priceTerm = Math.pow(SIM.referencePrice / Math.max(1, price), segment.priceSensitivity);
  const qualityTerm = Math.pow(Math.max(1, quality) / 50, segment.qualityWeight);
  const brandTerm = Math.pow(Math.max(1, brand) / 50, segment.brandWeight);
  return priceTerm * qualityTerm * brandTerm;
}

export function nextQuality(quality: number, rnd: number): number {
  // Decays without investment, so standing still is a decision with a cost.
  return Math.max(5, Math.round((quality * 0.94 + 10 * Math.sqrt(rnd / 10_000_000)) * 10) / 10);
}

export function nextBrand(brand: number, marketing: number): number {
  // Decays faster than quality: awareness is rented, capability is owned.
  return Math.max(5, Math.round((brand * 0.85 + 12 * Math.sqrt(marketing / 10_000_000)) * 10) / 10);
}

export function newFirm(name: string): FirmState {
  return {
    name,
    cash: SIM.startingCash,
    debt: 0,
    capacity: SIM.startingCapacity,
    capacityInBuild: 0,
    quality: SIM.startingQuality,
    brand: SIM.startingBrand,
    cumulativeVolume: SIM.startingCumulativeVolume,
    equity: SIM.startingCash,
  };
}

/**
 * The two computer-run firms.
 *
 * Deliberately simple and legible rather than clever. A student should be able
 * to work out what each rival is doing from its results — one is chasing
 * volume on price, the other is defending a premium — because a market whose
 * competitors are inscrutable teaches nothing about competing.
 */
export function rivalDecisions(
  rival: FirmState,
  round: number,
  playerPrice: number,
): Decisions {
  if (rival.name === "Meridian") {
    // Volume player: undercuts, spends on reach, invests little in the product.
    return {
      price: Math.max(780, Math.round(Math.min(1_050, playerPrice * 0.92))),
      marketing: 6_000_000,
      rnd: 1_500_000,
      capacityInvestment: round <= 5 ? 14_000_000 : 6_000_000,
    };
  }
  // Premium player: holds price, keeps investing in the product.
  return {
    price: 1_480,
    marketing: 8_000_000,
    rnd: 7_000_000,
    capacityInvestment: round <= 4 ? 10_000_000 : 5_000_000,
  };
}

/**
 * Advances every firm one round.
 *
 * Order matters and is the order a real quarter runs in: capacity commissioned
 * at the start is available now, demand is settled against the market, then
 * the P&L is struck, then the balance sheet moves.
 */
export function simulateRound(
  round: number,
  states: FirmState[],
  decisions: Decisions[],
): { outcome: RoundOutcome; next: FirmState[] } {
  const marketSize = Math.round(
    SIM.marketSize * Math.pow(1 + SIM.marketGrowth, round - 1),
  );

  // Capacity ordered last round comes online now.
  const opening = states.map((s) => ({
    ...s,
    capacity: s.capacity + s.capacityInBuild,
    capacityInBuild: 0,
  }));

  // Brand and quality move before the market sees them: this round's spend
  // buys this round's position, which is what makes the lever feel responsive.
  const positioned = opening.map((s, i) => ({
    ...s,
    quality: nextQuality(s.quality, decisions[i].rnd),
    brand: nextBrand(s.brand, decisions[i].marketing),
  }));

  // Demand, segment by segment.
  const demand = positioned.map(() => 0);
  for (const segment of SEGMENTS) {
    const scores = positioned.map((s, i) =>
      attractiveness(segment, decisions[i].price, s.quality, s.brand),
    );
    const total = scores.reduce((a, b) => a + b, 0) || 1;
    const segmentUnits = marketSize * segment.weight;
    scores.forEach((score, i) => {
      demand[i] += segmentUnits * (score / total);
    });
  }

  const results: FirmResult[] = [];
  const next: FirmState[] = [];

  positioned.forEach((s, i) => {
    const d = decisions[i];
    const wanted = Math.round(demand[i]);
    // Capacity is a hard ceiling, and unmet demand is simply lost — it does
    // not queue. That is what makes under-investing in capacity expensive in a
    // way a spreadsheet of margins never shows.
    const sold = Math.min(wanted, s.capacity);
    const lost = wanted - sold;

    const cost = unitCost(s.cumulativeVolume);
    const revenue = sold * d.price;
    const cogs = sold * cost;
    const upkeep = Math.round(s.capacity * SIM.capacityUpkeepPerUnit);
    const interest = Math.round(s.debt * SIM.interestPerRound);

    const profit = Math.round(
      revenue - cogs - d.marketing - d.rnd - upkeep - SIM.overheadPerRound - interest,
    );

    let cash = s.cash + profit - d.capacityInvestment;
    let debt = s.debt;
    // Overdraft rather than failure: a negative balance is financed, and the
    // interest shows up next round. The run only ends at the ceiling.
    if (cash < 0) {
      debt += -cash;
      cash = 0;
    } else if (debt > 0) {
      const repaid = Math.min(debt, cash);
      debt -= repaid;
      cash -= repaid;
    }

    results.push({
      name: s.name,
      price: d.price,
      demand: wanted,
      unitsSold: sold,
      lostSales: lost,
      revenue,
      unitCost: cost,
      cogs,
      marketing: d.marketing,
      rnd: d.rnd,
      capacityUpkeep: upkeep,
      overhead: SIM.overheadPerRound,
      interest,
      profit,
      share: 0,
      quality: s.quality,
      brand: s.brand,
      cash,
      debt,
      capacity: s.capacity,
    });

    next.push({
      ...s,
      cash,
      debt,
      cumulativeVolume: s.cumulativeVolume + sold,
      capacityInBuild: Math.floor(d.capacityInvestment / SIM.capacityCostPerUnit),
      equity: cash - debt + s.capacity * SIM.capacityCostPerUnit * 0.5,
    });
  });

  // Share of units actually sold, not of demand — a firm that could not supply
  // its demand did not have that share.
  const totalSold = results.reduce((a, r) => a + r.unitsSold, 0) || 1;
  for (const r of results) {
    r.share = Math.round((r.unitsSold / totalSold) * 1000) / 10;
  }

  return {
    outcome: {
      round,
      marketSize,
      firms: results,
      bankrupt: next[0].debt > SIM.debtCeiling,
    },
    next,
  };
}

/** The number the run is judged on: what the business is worth at the end. */
export function finalScore(player: FirmState, cumulativeProfit: number): number {
  return Math.round(player.equity + cumulativeProfit * 0.5);
}
