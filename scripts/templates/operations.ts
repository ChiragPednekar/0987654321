import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Operations archetypes. Physical and process problems — capacity, network
 * design, cost-to-serve — where the answer is usually a number and a
 * constraint, not a strategy.
 */
export const OPERATIONS_ARCHETYPES: Archetype[] = [
  // ------------------------------------------------------ make vs buy ---
  {
    id: "make-vs-buy",
    categorySlug: "capacity-planning",
    domain: "operations",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["make-vs-buy", "capacity", "fixed-cost", "breakeven"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        quantitative_analysis: 30,
        risk_assessment: 25,
        recommendation: 20,
      },
      descriptors: {
        problem_structuring:
          "Expects fixed and variable costs separated, and the decision framed around a breakeven volume. Penalise answers comparing unit costs at one volume only.",
        quantitative_analysis:
          "Must compute the breakeven volume where in-house beats outsourcing, using the numbers given.",
        risk_assessment:
          "Should treat volume uncertainty and the irreversibility of the capex as the real risk, not supplier reliability alone.",
        recommendation:
          "A decision with the volume threshold that would flip it.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const volume = rng.int(80, 400);
      const buyPrice = rng.int(180, 620);
      const capex = rng.int(30, 140);
      const makeVariable = Math.round(buyPrice * (1 - rng.int(18, 38) / 100));
      const fixedOpex = rng.int(4, 20);
      const life = rng.int(5, 10);
      const demandSwing = rng.int(20, 45);

      const annualFixed = Number((capex / life + fixedOpex).toFixed(1));
      const breakeven = Math.round(
        (annualFixed * c.multiplier) / (buyPrice - makeVariable) / 1000,
      );

      return {
        title: `${company.name}: Build the Line or Keep Buying?`,
        scenario: `${company.name} is a ${company.stage}-stage ${company.sector} business in ${company.geo}. It currently buys a key component from a third-party supplier and is considering manufacturing it in-house.

Current position:
- Annual volume: **${volume}k units**
- Supplier price: **${c.symbol}${buyPrice}** per unit, delivered

The in-house proposal:
- Capital cost: **${c.symbol}${capex} ${c.big}**, useful life **${life} years**
- Variable cost in-house: **${c.symbol}${makeVariable}** per unit
- Additional fixed operating cost: **${c.symbol}${fixedOpex} ${c.big}** per year

Complications:
- Demand for the end product could move **±${demandSwing}%** over the next three years
- The supplier has offered a price reduction if a three-year commitment is signed
- In-house production would take about 14 months to reach full yield

The COO is convinced building is obviously cheaper because the unit cost is lower.`,
        instructions: `Advise the COO. Your answer should provide:

1. **Analysis** — the economics of both options, computed, including the volume at which they break even.
2. **Risks** — what makes the in-house case fail, and what you would monitor.
3. **Recommendation** — a specific decision, and the volume threshold that would reverse it.

State any assumptions you make.`,
        supportingData: {
          current: {
            annual_volume_k: volume,
            supplier_price_per_unit: buyPrice,
          },
          in_house: {
            capex: capex,
            asset_life_years: life,
            variable_cost_per_unit: makeVariable,
            annual_fixed_opex: fixedOpex,
            ramp_months: 14,
          },
          uncertainty: {
            demand_swing_pct: demandSwing,
          },
          derived_hints: {
            annualised_fixed_cost: annualFixed,
            contribution_per_unit: buyPrice - makeVariable,
            breakeven_volume_k: breakeven,
          },
        },
        expectedFramework:
          "Fixed vs variable split; breakeven volume; demand risk against irreversible capex; option value of the supplier deal",
        modelAnswer: `A strong answer works through, in order:

1. **Annualise the fixed cost.** ${c.symbol}${capex} ${c.big} over ${life} years is ${c.symbol}${(capex / life).toFixed(1)} ${c.big} a year of depreciation, plus ${c.symbol}${fixedOpex} ${c.big} of fixed opex — about **${c.symbol}${annualFixed} ${c.big} a year** before a single unit is made.

2. **Contribution per unit.** Building saves ${c.symbol}${buyPrice} − ${c.symbol}${makeVariable} = **${c.symbol}${buyPrice - makeVariable}** per unit.

3. **Breakeven volume.** Annual fixed ÷ saving per unit ≈ **${breakeven}k units a year**. Current volume is ${volume}k, so the decision hinges entirely on whether ${volume}k comfortably exceeds ${breakeven}k — and by how much, given demand could move ±${demandSwing}%.

4. **The COO's error.** A lower unit cost is not a lower total cost. At volumes below breakeven the fixed base makes in-house *more* expensive per unit, which is the opposite of the intuition driving the proposal. Say this plainly.

5. **Asymmetry of risk.** Capex is irreversible and takes 14 months to reach yield; the supplier contract is not. If demand falls ${demandSwing}%, volume drops to ${Math.round(volume * (1 - demandSwing / 100))}k — check whether that is still above breakeven. If it is not, the downside case strands the asset while the outsourced case simply buys less.

6. **Recommendation.** Build only if volume net of the downside case clears breakeven with margin; otherwise take the supplier's committed price, which preserves flexibility. State the volume threshold at which you would revisit, and monitor order book against it.

The weakest answers compare ${c.symbol}${makeVariable} to ${c.symbol}${buyPrice} and stop. The strongest ones compute the breakeven and then stress it against the downside demand case.`,
      };
    },
  },

  // ------------------------------------------------ network / footprint ---
  {
    id: "network-design",
    categorySlug: "supply-chain",
    domain: "operations",
    difficulty: "hard",
    estimatedMinutes: 50,
    tags: ["supply-chain", "network", "cost-to-serve", "logistics"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        quantitative_analysis: 30,
        service_tradeoff: 25,
        recommendation: 20,
      },
      descriptors: {
        problem_structuring:
          "Expects total cost-to-serve built up from warehousing, line-haul and last-mile, not a single logistics number.",
        quantitative_analysis:
          "Must compare the network options on total annual cost using the figures given.",
        service_tradeoff:
          "Should treat delivery time as a revenue variable, not only a cost one. Penalise pure cost minimisation.",
        recommendation:
          "A specific network with the service level it delivers and what it costs.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const orders = rng.int(2, 12);
      const currentDcs = rng.int(1, 2);
      const proposedDcs = currentDcs + rng.int(1, 3);
      const dcFixed = rng.int(6, 18);
      const lineHaulNow = rng.int(30, 70);
      const lastMileNow = rng.int(60, 140);
      const lastMileAfter = Math.round(lastMileNow * (1 - rng.int(15, 35) / 100));
      const slaNow = rng.int(3, 6);
      const slaAfter = Math.max(1, slaNow - rng.int(1, 3));
      const revenueLift = rng.float(1.5, 5, 1);
      const revenue = rng.int(300, 1200);

      const addedFixed = (proposedDcs - currentDcs) * dcFixed;
      const lastMileSaving = Number(
        ((orders * 1_000_000 * (lastMileNow - lastMileAfter)) / c.multiplier).toFixed(1),
      );

      return {
        title: `${company.name}: How Many Distribution Centres?`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo} shipping about **${orders}m orders a year** on **${c.symbol}${revenue} ${c.big}** of revenue.

It runs **${currentDcs}** distribution centre${currentDcs > 1 ? "s" : ""} today. The supply chain team has proposed moving to **${proposedDcs}**.

Current economics per order:
- Line-haul: **${c.symbol}${lineHaulNow}**
- Last-mile: **${c.symbol}${lastMileNow}**
- Average delivery time: **${slaNow} days**

Under the proposed network:
- Each additional DC costs **${c.symbol}${dcFixed} ${c.big}** a year to run
- Last-mile falls to about **${c.symbol}${lastMileAfter}** per order, because stock sits closer to customers
- Average delivery time falls to **${slaAfter} days**
- Marketing estimates faster delivery is worth roughly **${revenueLift}%** of revenue in additional sales

The CFO is resisting on the grounds that fixed costs go up.`,
        instructions: `Advise on the network. Your answer should provide:

1. **Analysis** — total cost-to-serve under both networks, computed.
2. **Risks** — what the case depends on and what you would monitor.
3. **Recommendation** — a specific number of DCs and why.

State any assumptions you make.`,
        supportingData: {
          volume: {
            orders_m_per_year: orders,
            revenue: revenue,
          },
          current_network: {
            distribution_centres: currentDcs,
            line_haul_per_order: lineHaulNow,
            last_mile_per_order: lastMileNow,
            avg_delivery_days: slaNow,
          },
          proposed_network: {
            distribution_centres: proposedDcs,
            dc_fixed_cost_each: dcFixed,
            last_mile_per_order: lastMileAfter,
            avg_delivery_days: slaAfter,
            estimated_revenue_lift_pct: revenueLift,
          },
          derived_hints: {
            added_fixed_cost: addedFixed,
            last_mile_annual_saving: lastMileSaving,
            revenue_lift_value: Number((revenue * (revenueLift / 100)).toFixed(1)),
          },
        },
        expectedFramework:
          "Cost-to-serve build-up; fixed vs variable trade; service level as revenue; marginal DC analysis",
        modelAnswer: `A strong answer works through, in order:

1. **Build cost-to-serve, do not quote logistics as one line.** Per order today: ${c.symbol}${lineHaulNow} line-haul + ${c.symbol}${lastMileNow} last-mile = ${c.symbol}${lineHaulNow + lastMileNow}. Across ${orders}m orders that is roughly ${c.symbol}${(((lineHaulNow + lastMileNow) * orders * 1_000_000) / c.multiplier).toFixed(1)} ${c.big} a year.

2. **The trade is fixed against variable.** Adding ${proposedDcs - currentDcs} DC${proposedDcs - currentDcs > 1 ? "s" : ""} costs **${c.symbol}${addedFixed} ${c.big}** a year in new fixed cost. Last-mile falls ${c.symbol}${lastMileNow - lastMileAfter} per order, worth about **${c.symbol}${lastMileSaving} ${c.big}** a year at current volume. Compare those two numbers directly — that comparison is the case.

3. **Service is revenue, not just cost.** Delivery falls from ${slaNow} to ${slaAfter} days, which marketing values at ${revenueLift}% of revenue ≈ ${c.symbol}${(revenue * (revenueLift / 100)).toFixed(1)} ${c.big}. Note this is an estimate and should be treated as the softest number in the case; test the decision with and without it.

4. **The CFO is half right.** Fixed costs do rise, and they rise whether or not volume does. The question is volume sensitivity: if orders fall, the saving shrinks while the DC cost does not. Compute the order volume at which the network stops paying.

5. **Marginal, not average.** Do not evaluate ${proposedDcs} DCs as one block. The second DC almost always pays; the fourth often does not. Evaluate each additional site on its own marginal saving.

6. **Recommendation.** Take the number of DCs where marginal saving plus defensible revenue lift still exceeds marginal fixed cost — frequently fewer than proposed. Commit to the first additional site, measure the actual last-mile and delivery-time improvement, and gate the rest on that evidence.

The weakest answers total everything and give one verdict. The strongest ones evaluate each additional DC marginally and separate the hard logistics saving from the soft revenue estimate.`,
      };
    },
  },

  // ------------------------------------------------- process throughput ---
  {
    id: "throughput-bottleneck",
    categorySlug: "ops-excellence",
    domain: "operations",
    difficulty: "easy",
    estimatedMinutes: 35,
    tags: ["throughput", "bottleneck", "utilisation", "process"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        quantitative_analysis: 30,
        root_cause: 25,
        recommendation: 20,
      },
      descriptors: {
        problem_structuring:
          "Expects the process broken into stages with a capacity each, and the bottleneck identified explicitly.",
        quantitative_analysis:
          "Must compute stage capacities and system throughput from the numbers given.",
        root_cause:
          "Should recognise that investing anywhere except the bottleneck does not raise throughput.",
        recommendation:
          "Targeted action at the constraint, with the expected new throughput.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const demand = rng.int(900, 2400);
      const stages = [
        { name: "Intake", rate: rng.int(1400, 2600) },
        { name: "Processing", rate: rng.int(700, 1100) },
        { name: "Quality check", rate: rng.int(1100, 1900) },
        { name: "Dispatch", rate: rng.int(1300, 2400) },
      ];
      const bottleneck = stages.reduce((a, b) => (a.rate < b.rate ? a : b));
      const upgradeCost = rng.int(3, 14);
      const contribution = rng.int(200, 900);

      const rows = stages
        .map((s) => `| ${s.name} | ${s.rate.toLocaleString()} units/day |`)
        .join("\n");

      return {
        title: `${company.name}: Orders Are Piling Up`,
        scenario: `${company.name} is a ${company.sector} operation in ${company.geo}. Demand is **${demand.toLocaleString()} units per day** and rising, but the site is not shipping it. Work-in-progress is accumulating and the plant manager is asking for capital.

The line has four stages, each with its own maximum rate:

| Stage | Capacity |
|---|---|
${rows}

Other facts:
- The plant manager has requested **${c.symbol}${upgradeCost} ${c.big}** to upgrade the **Dispatch** stage, because that is where the visible backlog sits
- Each additional unit shipped contributes **${c.symbol}${contribution}**
- Overtime is available at any stage, at a premium

The site director wants to know whether to approve the request.`,
        instructions: `Advise the site director. Your answer should provide:

1. **Analysis** — what the site's actual throughput is and where the constraint sits, computed.
2. **Risks** — what your answer depends on.
3. **Recommendation** — where to spend, and the throughput it should buy.

State any assumptions you make.`,
        supportingData: {
          demand_units_per_day: demand,
          stage_capacity_units_per_day: Object.fromEntries(
            stages.map((s) => [s.name.toLowerCase().replace(/\s+/g, "_"), s.rate]),
          ),
          proposal: {
            stage: "Dispatch",
            cost: upgradeCost,
          },
          economics: {
            contribution_per_unit: contribution,
          },
          derived_hints: {
            system_throughput: bottleneck.rate,
            bottleneck_stage: bottleneck.name,
            unmet_demand_per_day: Math.max(0, demand - bottleneck.rate),
          },
        },
        expectedFramework:
          "Stage capacities; theory of constraints; value of relieving the bottleneck; re-check the next constraint",
        modelAnswer: `A strong answer works through, in order:

1. **System throughput equals the slowest stage.** Capacities are ${stages.map((s) => `${s.name} ${s.rate.toLocaleString()}`).join(", ")}. The constraint is **${bottleneck.name}** at ${bottleneck.rate.toLocaleString()} units/day, so the site can ship ${bottleneck.rate.toLocaleString()} a day regardless of what the other stages could do.

2. **Unmet demand.** Demand is ${demand.toLocaleString()}/day against throughput of ${bottleneck.rate.toLocaleString()}, leaving **${Math.max(0, demand - bottleneck.rate).toLocaleString()} units/day** unserved — worth roughly ${c.symbol}${(((Math.max(0, demand - bottleneck.rate) * contribution) / c.multiplier) * 300).toFixed(1)} ${c.big} a year in lost contribution at 300 operating days.

3. **The plant manager is looking at the wrong stage.** Backlog accumulates *in front of* a constraint, so the visible pile at Dispatch is a symptom of ${bottleneck.name} upstream, not a Dispatch problem. Spending ${c.symbol}${upgradeCost} ${c.big} on Dispatch buys **zero** additional throughput — Dispatch already runs at ${stages[3].rate.toLocaleString()}/day and is starved, not saturated. This is the trap in the case.

4. **Value of relieving the real constraint.** Every unit of capacity added at ${bottleneck.name} is worth ${c.symbol}${contribution} of contribution until either demand or the next stage binds.

5. **Check what binds next.** Raising ${bottleneck.name} above ${stages.filter((s) => s.name !== bottleneck.name).reduce((a, b) => (a.rate < b.rate ? a : b)).rate.toLocaleString()} makes ${stages.filter((s) => s.name !== bottleneck.name).reduce((a, b) => (a.rate < b.rate ? a : b)).name} the new constraint. Do not buy more relief than the next stage can absorb.

6. **Recommendation.** Reject the Dispatch request. Apply overtime at ${bottleneck.name} immediately as the reversible move, and direct capital there — sized to the next constraint, not to demand.

The weakest answers approve the request because that is where the backlog is visible. The strongest ones identify the constraint arithmetically and explain why the backlog appears where it does.`,
      };
    },
  },
];
