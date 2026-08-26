import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/** Consulting archetypes — the classic casebook progression. */
export const CONSULTING_ARCHETYPES: Archetype[] = [
  // ------------------------------------------------------- profitability ---
  {
    id: "profitability-decline",
    categorySlug: "profitability",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["profitability", "cost-structure", "margin"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        quantitative_analysis: 25,
        root_cause: 25,
        recommendation: 25,
      },
      descriptors: {
        problem_structuring:
          "Expects profit decomposed into revenue (price × volume) and cost (fixed vs variable) before any hypothesis. Penalise answers that jump to a cause.",
        quantitative_analysis:
          "Must isolate which line actually moved, using the numbers given. Credit computing the margin bridge year over year.",
        root_cause:
          "Should reach a specific, evidenced cause rather than listing possibilities.",
        recommendation:
          "Prioritised actions with expected margin impact and a sense of sequencing.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenueLast = rng.int(400, 1200);
      const revenueThis = Math.round(revenueLast * (1 + rng.int(-3, 8) / 100));
      const marginLast = rng.int(14, 24);
      const marginThis = marginLast - rng.int(3, 9);
      const volumeChange = rng.int(-8, 12);
      const priceChange = rng.int(-6, 3);
      const inputCostChange = rng.int(5, 22);
      const fixedCostChange = rng.int(2, 15);

      return {
        title: `${company.name}: Profits Down Despite Flat Revenue`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo}. The CEO has asked for help understanding a sharp fall in profitability.

Revenue moved from **${c.symbol}${revenueLast} ${c.big}** to **${c.symbol}${revenueThis} ${c.big}** over the past year, while operating margin fell from **${marginLast}%** to **${marginThis}%** — a drop of ${marginLast - marginThis} percentage points and roughly ${c.symbol}${(revenueLast * (marginLast / 100) - revenueThis * (marginThis / 100)).toFixed(0)} ${c.big} of operating profit.

What the finance team has established so far:
- Sales **volume** changed by **${volumeChange > 0 ? "+" : ""}${volumeChange}%**
- Average **realised price** changed by **${priceChange > 0 ? "+" : ""}${priceChange}%**
- **Input costs** per unit rose **${inputCostChange}%**
- **Fixed overhead** rose **${fixedCostChange}%**

The COO believes the problem is "the sales team discounting too aggressively". The Head of Sales believes it is "procurement failing to control input costs". The CEO wants an evidence-based answer, not an argument.`,
        instructions: `Diagnose the profit decline and recommend a response. Provide:

1. **Analysis** — structure the problem and isolate what actually drove the margin fall.
2. **Risks** — what your recommendation depends on.
3. **Recommendation** — prioritised actions with expected impact.

Show the arithmetic behind your conclusion.`,
        supportingData: {
          profit_bridge: {
            [`revenue_last_year_${c.big.toLowerCase()}`]: revenueLast,
            [`revenue_this_year_${c.big.toLowerCase()}`]: revenueThis,
            operating_margin_last_pct: marginLast,
            operating_margin_this_pct: marginThis,
          },
          drivers: {
            volume_change_pct: volumeChange,
            realised_price_change_pct: priceChange,
            input_cost_per_unit_change_pct: inputCostChange,
            fixed_overhead_change_pct: fixedCostChange,
          },
        },
        expectedFramework: `Profit = (Price × Volume) − (Variable cost × Volume) − Fixed cost

1. **Decompose** the change: how much of the margin fall is price, how much volume, how much unit cost, how much overhead?
2. **Size each driver** before forming a hypothesis.
3. **Test** the two stakeholder claims against the numbers.
4. **Prioritise** by size of impact and speed of fix.`,
        modelAnswer: `**Structure.** Operating profit fell from ${c.symbol}${(revenueLast * (marginLast / 100)).toFixed(0)} ${c.big} to ${c.symbol}${(revenueThis * (marginThis / 100)).toFixed(0)} ${c.big}. The question is which of four levers moved: price, volume, unit cost, or fixed cost. Only one of them is worth acting on first.

**Sizing the drivers.** Price moved ${priceChange}% and volume ${volumeChange}%, which together explain the revenue change of ${(((revenueThis - revenueLast) / revenueLast) * 100).toFixed(1)}%. But the margin fall is much larger than the revenue effect, so the cause is on the cost side.

Input costs per unit rose ${inputCostChange}% — the single largest movement in the data. Fixed overhead rose ${fixedCostChange}%. Against a starting margin of ${marginLast}%, a ${inputCostChange}% rise in unit costs alone is enough to account for the bulk of the ${marginLast - marginThis} point decline, because variable costs make up the majority of the cost base at this margin level.

**Testing the two claims.** The COO's discounting theory does not survive the data: price moved only ${priceChange}%, which is ${Math.abs(priceChange) < 4 ? "too small to explain a decline of this size" : "material but still second-order against the cost movement"}. The Head of Sales is closer to right, but "procurement failed" is not yet a root cause — the useful question is whether input costs rose because of market prices (outside the company's control, requiring a pricing response) or because of contract terms and supplier mix (inside its control, requiring a sourcing response).

That distinction determines the entire recommendation, and I would resolve it before acting: pull the last eight quarters of input prices and compare against the relevant commodity index. If the company tracked the index, this is a pass-through problem. If it underperformed the index, it is a procurement problem.

**Risks.** ${priceChange < 0 ? "Raising prices in a market where realised prices are already falling risks volume, so any pass-through must be tested on a segment first." : "Passing costs through assumes demand is not price-elastic, which the volume data does not yet confirm."} There is also a mix effect hiding in the averages — a shift toward lower-margin products would produce exactly this pattern without any single driver looking dramatic.

**Recommendation.**
1. **Pass through what the market allows.** Even ${Math.ceil(inputCostChange / 3)}% of price recovery restores a meaningful share of the lost margin, and it is the fastest lever available.
2. **Renegotiate or re-source the top input categories.** Concentrate on the top 20% of spend by value, where the effort actually pays.
3. **Hold fixed costs flat.** The ${fixedCostChange}% overhead increase is not the main cause, but it is the easiest to stop compounding.
4. **Do not start with discounting discipline.** It is a real issue but a small one here, and fixing it first would consume political capital for a fraction of the margin recovery.`,
      };
    },
  },

  // -------------------------------------------------------- market entry ---
  {
    id: "market-entry",
    categorySlug: "market-entry",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 50,
    tags: ["market-entry", "sizing", "go-to-market"],
    rubric: {
      criteria: {
        market_sizing: 25,
        competitive_analysis: 20,
        entry_mode: 20,
        risk_assessment: 15,
        recommendation: 20,
      },
      descriptors: {
        market_sizing:
          "Expects a bottom-up estimate with stated assumptions, not a cited figure. Credit sanity-checking top-down against bottom-up.",
        competitive_analysis:
          "Should assess incumbent strength, switching costs and likely competitive response.",
        entry_mode:
          "Organic vs acquisition vs partnership, with a reason tied to the specific barriers identified.",
        risk_assessment: "Regulatory, execution, cannibalisation, capital at risk.",
        recommendation: "A go/no-go with entry mode, sequencing and success metrics.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const targetGeo = rng.pick([
        "Indonesia",
        "Brazil",
        "Vietnam",
        "Nigeria",
        "Poland",
        "Mexico",
      ]);
      const marketSize = rng.int(800, 4000);
      const marketGrowth = rng.int(8, 25);
      const incumbentShare = rng.int(35, 70);
      const investment = rng.int(100, 400);
      const homeRevenue = rng.int(500, 2000);
      const targetShare = rng.int(5, 15);

      return {
        title: `Should ${company.name} Enter ${targetGeo}?`,
        scenario: `${company.name} is a ${company.sector} company with **${c.symbol}${homeRevenue} ${c.big}** of revenue in its home market of ${company.geo}. Growth at home has slowed to low single digits and the board is looking abroad.

${targetGeo} has been identified as the priority candidate. Early desk research suggests:
- Addressable market of roughly **${c.symbol}${marketSize} ${c.big}**, growing **${marketGrowth}% a year**
- The largest incumbent holds about **${incumbentShare}%** share, with a long tail of local players
- Entry would require an estimated **${c.symbol}${investment} ${c.big}** over three years
- Regulatory approval takes 9-18 months, and local partnership requirements apply to foreign entrants

The strategy team's paper projects **${targetShare}% market share within five years**. The CFO has asked whether that projection is credible and whether this is the best use of ${c.symbol}${investment} ${c.big}.`,
        instructions: `Advise the board. Provide:

1. **Analysis** — size the opportunity yourself, assess the competitive landscape, and evaluate entry modes.
2. **Risks** — what would make this fail, and what you would monitor.
3. **Recommendation** — enter or don't. If entering, specify the mode and sequence.

Challenge the ${targetShare}% share assumption explicitly.`,
        supportingData: {
          target_market: {
            geography: targetGeo,
            [`addressable_market_${c.big.toLowerCase()}`]: marketSize,
            market_growth_pct: marketGrowth,
            largest_incumbent_share_pct: incumbentShare,
          },
          entry: {
            [`estimated_investment_${c.big.toLowerCase()}`]: investment,
            regulatory_timeline_months: "9-18",
            local_partnership_required: true,
            projected_share_year_5_pct: targetShare,
          },
          home_market: {
            [`revenue_${c.big.toLowerCase()}`]: homeRevenue,
            growth_pct: rng.int(1, 4),
          },
        },
        expectedFramework: `1. **Size it independently** — bottom-up: population → addressable segment → penetration → frequency → price. Compare against the ${c.symbol}${marketSize} ${c.big} figure.
2. **Attractiveness** — growth, fragmentation, margin structure.
3. **Right to win** — what does ${company.name} have that local players don't?
4. **Entry mode** — organic, acquisition, joint venture, licensing, against the barriers found.
5. **Economics** — revenue at ${targetShare}% share vs the ${c.symbol}${investment} ${c.big} investment, with a payback period.
6. **Decide** with staged commitments and kill criteria.`,
        modelAnswer: `**Is the market worth entering?** At ${c.symbol}${marketSize} ${c.big} growing ${marketGrowth}%, the market reaches roughly ${c.symbol}${(marketSize * Math.pow(1 + marketGrowth / 100, 5)).toFixed(0)} ${c.big} by year five. ${targetShare}% of that is ${c.symbol}${(marketSize * Math.pow(1 + marketGrowth / 100, 5) * (targetShare / 100)).toFixed(0)} ${c.big} of revenue — against ${c.symbol}${investment} ${c.big} of investment, the headline arithmetic works.

**But the share assumption is doing all the work.** ${targetShare}% in five years, in a market where the leading incumbent holds ${incumbentShare}% and local players hold the rest, means taking roughly ${(targetShare / 5).toFixed(1)} points of share per year from companies who know the market better. Foreign entrants in ${targetGeo}-type markets more commonly reach 3-6% in five years unless they buy their way in. I would model the base case at half the projection and check whether the investment still clears the hurdle at ${(targetShare / 2).toFixed(1)}% share — that, not the optimistic case, is the number the decision should rest on.

**Right to win.** The case for entry cannot be "the market is growing" — that is visible to everyone, including the incumbents. It has to be a transferable advantage: proprietary technology, a cost position, or a brand that travels. If ${company.name}'s advantage at home is distribution relationships or local brand strength, neither transfers, and the honest answer is that there is no right to win.

**Entry mode.** Given a 9-18 month regulatory timeline and a local partnership requirement, organic entry is slow and exposed. Acquisition buys share, licences and local management immediately, and converts an uncertain share-gain assumption into a priced asset — but at an acquisition premium and with integration risk. A joint venture splits the economics but satisfies the partnership requirement and de-risks the regulatory path. For a first international move I would favour the JV, with a pre-agreed path to increase ownership once the market is proven.

**Risks.** Regulatory delay pushes payback out by a year or more. Currency exposure is unhedged in the current projections. The most common failure mode is underestimating how much management attention a first international entry consumes — attention taken from a home market that is already only growing at low single digits.

**Recommendation.** Enter, but stage it. Commit ${c.symbol}${Math.round(investment * 0.25)} ${c.big} to a JV and a single-city or single-segment pilot rather than ${c.symbol}${investment} ${c.big} to a national rollout. Set explicit kill criteria before spending: if unit economics are not positive by month 18, or if share after two years is below ${(targetShare / 4).toFixed(1)}%, stop. Staging costs a little speed and buys the option to be wrong cheaply.`,
      };
    },
  },

  // ------------------------------------------------------------ pricing ----
  {
    id: "pricing-strategy",
    categorySlug: "pricing",
    domain: "consulting",
    difficulty: "hard",
    estimatedMinutes: 50,
    tags: ["pricing", "elasticity", "willingness-to-pay"],
    rubric: {
      criteria: {
        pricing_analysis: 30,
        customer_segmentation: 20,
        competitive_dynamics: 20,
        recommendation: 30,
      },
      descriptors: {
        pricing_analysis:
          "Must work through the elasticity arithmetic: what volume loss a price rise can absorb before profit falls. Credit computing the break-even volume change.",
        customer_segmentation:
          "Should recognise that one price across segments leaves money on the table, and propose a structure.",
        competitive_dynamics:
          "Expects consideration of competitor response and the risk of a price war.",
        recommendation:
          "A specific price architecture, not just 'raise prices'.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const currentPrice = rng.int(500, 5000);
      const grossMargin = rng.int(35, 70);
      const proposedIncrease = rng.int(6, 18);
      const elasticity = rng.float(-2.2, -0.6, 1);
      const competitorPrice = Math.round(currentPrice * (1 + rng.int(-15, 20) / 100));
      const enterpriseShare = rng.int(20, 45);
      const breakEvenVolumeLoss = (
        (proposedIncrease / (grossMargin + proposedIncrease)) * 100
      ).toFixed(1);

      return {
        title: `${company.name}: Can We Raise Prices ${proposedIncrease}%?`,
        scenario: `${company.name} (${company.sector}, ${company.geo}) has not changed prices in three years while input costs have risen steadily. The CFO wants a **${proposedIncrease}% price increase** across the board.

**Current position.**
- Average selling price: **${c.symbol}${currentPrice}**
- Gross margin: **${grossMargin}%**
- Estimated price elasticity of demand: **${elasticity}**
- Nearest competitor prices at **${c.symbol}${competitorPrice}**

**Customer mix.** Roughly **${enterpriseShare}%** of revenue comes from large enterprise accounts on annual contracts with procurement teams; the remainder comes from smaller customers who buy on shorter cycles and switch more readily.

The Head of Sales is opposed, warning of "customer revolt". The CFO points out that margins have fallen every year since the last increase.`,
        instructions: `Advise on pricing. Provide:

1. **Analysis** — can the business sustain a ${proposedIncrease}% increase? Work through the volume the increase can afford to lose.
2. **Risks** — competitive response, churn concentration, contract timing.
3. **Recommendation** — a specific pricing structure and rollout plan.`,
        supportingData: {
          economics: {
            average_selling_price: currentPrice,
            gross_margin_pct: grossMargin,
            price_elasticity: elasticity,
            proposed_increase_pct: proposedIncrease,
          },
          market: {
            competitor_price: competitorPrice,
            price_gap_pct: Number(
              (((currentPrice - competitorPrice) / competitorPrice) * 100).toFixed(1),
            ),
          },
          mix: {
            enterprise_revenue_share_pct: enterpriseShare,
            smb_revenue_share_pct: 100 - enterpriseShare,
          },
          derived_hints: {
            break_even_volume_loss_pct: Number(breakEvenVolumeLoss),
          },
        },
        expectedFramework: `1. **Break-even volume loss** — the volume a price rise can lose before profit falls:
   Δvolume = Δprice ÷ (gross margin + Δprice)
2. **Predicted volume loss** from elasticity: ${elasticity} × ${proposedIncrease}% = ${(elasticity * proposedIncrease).toFixed(1)}%.
3. **Compare** the two. If predicted loss is below break-even, the increase is profitable.
4. **Segment** — elasticity is an average across very different buyers.
5. **Competitive response** — what happens if the competitor holds price.
6. **Design the architecture**, then the rollout.`,
        modelAnswer: `**Break-even.** A ${proposedIncrease}% price rise at a ${grossMargin}% gross margin can afford to lose **${breakEvenVolumeLoss}%** of volume before profit falls: Δp ÷ (margin + Δp) = ${proposedIncrease} ÷ (${grossMargin} + ${proposedIncrease}).

**Predicted loss.** At an elasticity of ${elasticity}, a ${proposedIncrease}% increase implies a volume decline of **${Math.abs(elasticity * proposedIncrease).toFixed(1)}%**.

**Verdict on the headline question.** ${Math.abs(elasticity * proposedIncrease) < Number(breakEvenVolumeLoss) ? `Predicted loss (${Math.abs(elasticity * proposedIncrease).toFixed(1)}%) is below break-even (${breakEvenVolumeLoss}%), so the increase is profit-accretive even after the volume it costs. The Head of Sales is measuring the wrong thing — units, not profit.` : `Predicted loss (${Math.abs(elasticity * proposedIncrease).toFixed(1)}%) exceeds break-even (${breakEvenVolumeLoss}%), so a uniform ${proposedIncrease}% increase destroys profit. The CFO's instinct that margins must recover is right, but this instrument is wrong.`}

**The segmentation insight.** The single elasticity of ${elasticity} is an average over two populations that behave nothing alike. Enterprise accounts (${enterpriseShare}% of revenue) have procurement scrutiny but high switching costs — long implementation cycles, integration, retraining — so their true elasticity is well below the average. Smaller customers switch on price and sit above it. Applying one number to both is the central error in the CFO's proposal.

**Competitive position.** At ${c.symbol}${currentPrice} against ${c.symbol}${competitorPrice}, the company is ${currentPrice > competitorPrice ? `already priced ${(((currentPrice - competitorPrice) / competitorPrice) * 100).toFixed(0)}% above the nearest competitor, which limits headroom and makes a uniform rise conspicuous` : `priced ${(((competitorPrice - currentPrice) / competitorPrice) * 100).toFixed(0)}% below the nearest competitor, which is real headroom — the increase closes a gap rather than opening one`}.

**Recommendation — differentiate rather than raise across the board.**

1. **Enterprise accounts: ${Math.round(proposedIncrease * 1.3)}%**, timed to contract renewal rather than imposed mid-term. Switching costs are highest here and renewal is the moment when value is already being discussed.
2. **Smaller customers: ${Math.round(proposedIncrease * 0.5)}%**, paired with a lower-priced entry tier so price-sensitive buyers trade down rather than leave. Capturing a downgrade beats losing a customer.
3. **Introduce good/better/best.** A three-tier structure lets willingness to pay sort itself, which is worth more over time than any single across-the-board move.
4. **Pilot before rolling out.** Take one region or segment for a quarter and measure actual churn against the ${Math.abs(elasticity * proposedIncrease).toFixed(1)}% prediction. Elasticity estimates are frequently wrong, and this is a cheap way to find out before repricing the whole book.

**Risks.** The most concentrated risk is not average churn but the top accounts: if the largest customers are also the most price-exposed, an average-based model will understate the damage. Model the top 10 accounts individually before committing.`,
      };
    },
  },

  // --------------------------------------------------------- operations ----
  {
    id: "operations-capacity",
    categorySlug: "operations",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["operations", "capacity", "bottleneck", "throughput"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        bottleneck_analysis: 30,
        options_evaluation: 20,
        recommendation: 25,
      },
      descriptors: {
        bottleneck_analysis:
          "Must identify the constraint from the stage capacities given, and recognise that improving non-bottleneck stages adds nothing.",
        options_evaluation:
          "Should compare capex against process improvement and outsourcing on cost per unit of added capacity.",
        recommendation: "A sequenced plan with the constraint addressed first.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const demand = rng.int(1200, 3000);
      const stage1 = rng.int(1800, 3200);
      const stage2 = rng.int(900, 1600);
      const stage3 = rng.int(1500, 2800);
      const stage4 = rng.int(1400, 2600);
      const capexOption = rng.int(60, 220);
      const capexAdds = rng.int(400, 900);
      const outsourceCostPremium = rng.int(15, 40);
      const bottleneck = Math.min(stage1, stage2, stage3, stage4);

      return {
        title: `${company.name} Cannot Meet Demand`,
        scenario: `${company.name} (${company.sector}, ${company.geo}) is turning away orders. Demand runs at **${demand} units per week**, but the plant cannot keep up, and the sales team reports losing deals to competitors on lead time.

**Line capacity by stage (units per week):**

| Stage | Capacity |
|---|---|
| 1. Intake and preparation | ${stage1} |
| 2. Primary processing | ${stage2} |
| 3. Assembly | ${stage3} |
| 4. Finishing and dispatch | ${stage4} |

The plant manager has requested **${c.symbol}${capexOption} ${c.big}** for new finishing equipment, which would add **${capexAdds} units per week** of finishing capacity. He argues the finishing area "is where the queues are visible".

An external contractor has offered to take overflow work at a **${outsourceCostPremium}% cost premium** over in-house production, available within six weeks.`,
        instructions: `Advise the operations director. Provide:

1. **Analysis** — where is the real constraint, and what is the plant's actual throughput?
2. **Risks** — of each option under consideration.
3. **Recommendation** — what to do, in what order.

Address the plant manager's capex request directly.`,
        supportingData: {
          demand_units_per_week: demand,
          stage_capacity_units_per_week: {
            intake_and_preparation: stage1,
            primary_processing: stage2,
            assembly: stage3,
            finishing_and_dispatch: stage4,
          },
          options: {
            [`finishing_capex_${c.big.toLowerCase()}`]: capexOption,
            finishing_capacity_added_units: capexAdds,
            outsourcing_cost_premium_pct: outsourceCostPremium,
            outsourcing_lead_time_weeks: 6,
          },
        },
        expectedFramework: `1. **Throughput = the capacity of the slowest stage.** Identify it.
2. **Quantify the gap** between demand and that constraint.
3. **Test each option against the constraint** — capacity added anywhere else is wasted.
4. **Cost per unit of added throughput** for each option.
5. **Recognise the constraint moves** once the current one is relieved.`,
        modelAnswer: `**The constraint.** Throughput is set by the slowest stage, which is **primary processing at ${stage2} units per week** — not finishing. Whatever the other stages can do, the plant cannot ship more than ${bottleneck} units per week. Against demand of ${demand}, the shortfall is **${demand - bottleneck} units per week**.

**The plant manager's request should be declined as specified.** Finishing runs at ${stage4} units per week, already ${stage4 - stage2} units above what primary processing can feed it. Spending ${c.symbol}${capexOption} ${c.big} to raise finishing capacity by ${capexAdds} units would add **zero** throughput — the new equipment would idle exactly as the current equipment does. The visible queues in finishing are a symptom of upstream batching, not a capacity shortage; queues accumulate wherever work waits, which is rarely the constrained stage itself.

This is worth stating plainly to the plant manager, because "where the queues are" is the most common way capacity money gets misallocated.

**Options against the real constraint.**

1. **Process improvement at primary processing.** Before buying anything, examine changeover time, unplanned downtime and scrap at this stage. On most lines, 10-20% of constraint capacity is recoverable through setup reduction and stopping the constraint from ever running idle — at close to zero capex. Even 10% here is ${Math.round(stage2 * 0.1)} units per week.
2. **Outsource the overflow.** At a ${outsourceCostPremium}% cost premium and six weeks' lead time, this converts lost orders into lower-margin orders. Worth doing if contribution margin exceeds the premium — and it protects the customer relationships that lead-time losses are currently damaging.
3. **Capex at primary processing** — the request the plant manager should have made. Evaluate against the same cost-per-added-unit test.

**Watch the constraint move.** If primary processing is lifted above ${Math.min(stage1, stage3, stage4)}, the constraint shifts to ${stage1 < stage3 && stage1 < stage4 ? "intake" : stage3 < stage4 ? "assembly" : "finishing"}. Any investment case must be sized against the *next* constraint, or it will overshoot and repeat this mistake one stage later.

**Recommendation.** Sequence it: start outsourcing overflow immediately to stop losing orders while other work proceeds; run a four-week constraint-focused improvement effort at primary processing; then, and only then, size a capex request at primary processing against the residual gap. Redirect the ${c.symbol}${capexOption} ${c.big} finishing request until the constraint analysis justifies it.`,
      };
    },
  },

  // ---------------------------------------------------- growth strategy ----
  {
    id: "growth-strategy",
    categorySlug: "growth-strategy",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["growth", "adjacency", "portfolio"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        option_generation: 25,
        evaluation: 25,
        recommendation: 25,
      },
      descriptors: {
        problem_structuring:
          "Expects growth decomposed systematically — existing vs new customers, existing vs new products, existing vs new geographies.",
        option_generation: "Several genuinely distinct options, not variations of one.",
        evaluation: "Options scored against a stated set of criteria, with numbers where available.",
        recommendation: "A prioritised portfolio with sequencing and resourcing.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const coreMarketGrowth = rng.int(2, 6);
      const c = currency(company);
      const revenue = rng.int(300, 1500);
      const currentGrowth = rng.int(1, 6);
      const targetGrowth = rng.int(12, 25);
      const customerCount = rng.int(400, 5000);
      const churn = rng.int(8, 22);
      const shareOfWallet = rng.int(15, 40);
      const gap = Math.round(revenue * (targetGrowth - currentGrowth) / 100);

      return {
        title: `${company.name}: Finding ${targetGrowth}% Growth`,
        scenario: `${company.name} (${company.sector}, ${company.geo}) has grown at **${currentGrowth}% a year** for three years. The new CEO has committed the board to **${targetGrowth}% growth** — a gap of roughly **${c.symbol}${gap} ${c.big}** of incremental revenue in year one.

**What we know.**
- Current revenue: **${c.symbol}${revenue} ${c.big}**
- **${customerCount}** active customers
- Annual customer churn: **${churn}%**
- Estimated share of existing customers' relevant spend: **${shareOfWallet}%**
- The core market is growing at ${coreMarketGrowth}% — so the company is roughly holding share

The CEO's instinct is to enter a new geography. The CFO thinks the answer is in the existing base. Nobody has yet sized either.`,
        instructions: `Build the growth case. Provide:

1. **Analysis** — where growth could come from, sized.
2. **Risks** — of the options you recommend and reject.
3. **Recommendation** — a prioritised growth portfolio for the next 24 months.`,
        supportingData: {
          current_state: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            growth_pct: currentGrowth,
            target_growth_pct: targetGrowth,
            [`revenue_gap_${c.big.toLowerCase()}`]: gap,
          },
          customers: {
            active_customers: customerCount,
            annual_churn_pct: churn,
            share_of_wallet_pct: shareOfWallet,
            average_revenue_per_customer: Number(
              ((revenue * 1_000_000) / customerCount).toFixed(0),
            ),
          },
          market: { core_market_growth_pct: coreMarketGrowth },
        },
        expectedFramework: `Decompose growth into five sources and size each:
1. **Retention** — reducing ${churn}% churn
2. **Penetration** — raising ${shareOfWallet}% share of wallet
3. **New customers** in existing segments
4. **New products** to existing customers
5. **New geographies or segments**

Score on size, speed, cost and risk. The first two are usually cheapest and fastest; the last is usually slowest.`,
        modelAnswer: `**The gap.** ${c.symbol}${gap} ${c.big} of incremental revenue in year one.

**Source 1 — retention.** Churn of ${churn}% destroys about ${c.symbol}${(revenue * (churn / 100)).toFixed(0)} ${c.big} of revenue annually. Cutting churn by a third recovers ${c.symbol}${(revenue * (churn / 100) / 3).toFixed(0)} ${c.big} — **${(((revenue * (churn / 100)) / 3 / gap) * 100).toFixed(0)}% of the gap**, from customers who already chose the product once. This is almost always the cheapest growth available and the least celebrated, because it does not look like growth on a slide.

**Source 2 — share of wallet.** At ${shareOfWallet}% of relevant customer spend, ${100 - shareOfWallet}% is going elsewhere. Moving to ${shareOfWallet + 5}% adds roughly ${c.symbol}${((revenue / shareOfWallet) * 5).toFixed(0)} ${c.big}. The infrastructure exists — these are known customers with known buyers.

**Source 3 — new customers.** At current average revenue per customer of ${c.symbol}${((revenue * 1000) / customerCount).toFixed(1)}k, closing the gap this way alone needs about ${Math.round(gap / (revenue / customerCount))} new customers — ${((Math.round(gap / (revenue / customerCount)) / customerCount) * 100).toFixed(0)}% growth in the customer base in a market growing at low single digits. That means taking share, which is slower and more expensive than the plan assumes.

**Sources 4 and 5 — new products and geographies.** Both are real but neither pays inside 24 months. New geography in particular carries an 18-month lead time before meaningful revenue, and consumes disproportionate management attention.

**On the CEO's instinct.** New geography is the least likely of the five to close a *year-one* gap, and it is the most expensive way to discover you were wrong. The CFO is closer to right: the existing base holds ${(((revenue * (churn / 100)) / 3 + (revenue / shareOfWallet) * 5) / gap * 100).toFixed(0)}% of the required growth at a fraction of the cost and risk.

**Recommendation — a portfolio, sequenced.**

- **Months 0-6: retention.** Instrument churn by cohort and reason, then fix the top two causes. Fastest payback, and it compounds into every later initiative.
- **Months 0-12: penetration.** Build an account-plan motion for the top 20% of customers by potential. Existing relationships, no new acquisition cost.
- **Months 6-18: new customer acquisition** in the two best-performing existing segments, funded by the margin the first two workstreams release.
- **Months 12-24: one adjacency**, piloted — not a geography and a product line simultaneously.

**Risks.** The main one is that ${targetGrowth}% may simply not be achievable in year one in a market growing at low single digits, and committing the board to it invites the wrong behaviours — discounting to hit a number, or acquisitions made under time pressure. I would re-contract with the board on a two-year path to ${targetGrowth}% rather than a one-year leap, and report the retention and share-of-wallet metrics as leading indicators so progress is visible before the revenue arrives.`,
      };
    },
  },

  // -------------------------------------------------------- market sizing --
  {
    id: "market-sizing",
    categorySlug: "market-sizing",
    domain: "consulting",
    difficulty: "easy",
    estimatedMinutes: 25,
    tags: ["sizing", "estimation", "assumptions"],
    rubric: {
      criteria: {
        structure: 30,
        assumptions: 30,
        arithmetic: 20,
        sense_check: 20,
      },
      descriptors: {
        structure:
          "A clear top-down or bottom-up tree, stated before any numbers are used.",
        assumptions:
          "Each assumption stated explicitly with a brief justification. This matters more than picking the 'right' number.",
        arithmetic: "Clean, rounded, and correct.",
        sense_check:
          "A cross-check by a second method, or a comparison against a known reference point.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const replacementYears = rng.int(3, 8);
      const product = rng.pick([
        "electric two-wheelers",
        "commercial coffee machines",
        "corporate wellness subscriptions",
        "industrial air filters",
        "point-of-sale terminals",
        "school bus fleet services",
      ]);
      const population = rng.int(60, 320);

      return {
        title: `Market Sizing: ${product.charAt(0).toUpperCase() + product.slice(1)} in ${company.geo}`,
        scenario: `${company.name} is considering launching **${product}** in ${company.geo} and needs a defensible estimate of the annual market before committing to a business plan.

There is no reliable published market research for this category in ${company.geo}. You have roughly ${population} million people in the addressable region, a broadly typical income distribution for the geography, and no proprietary data.

The investment committee does not expect precision. It expects a number it can interrogate, with every assumption visible and challengeable.`,
        instructions: `Estimate the annual market size for ${product} in ${company.geo}. Provide:

1. **Analysis** — your structure, assumptions and arithmetic.
2. **Risks** — which assumptions your answer is most sensitive to.
3. **Recommendation** — your estimate, as a range, and how you would validate it.

State every assumption. Round aggressively — precision here is false comfort.`,
        supportingData: {
          context: {
            product,
            geography: company.geo,
            addressable_population_millions: population,
          },
          note: "No published market data. Estimate from first principles.",
        },
        expectedFramework: `**Bottom-up** is usually more defensible:

Population → filter to the relevant buying unit (households, businesses, vehicles) → penetration rate → purchase frequency or replacement cycle → average price → annual market value.

Then **cross-check top-down**: total category spend in the geography × the share this product could represent.

If the two land within a factor of two, the estimate is usable. If not, one assumption is wrong — find it.`,
        modelAnswer: `**Structure.** I will size this bottom-up and cross-check top-down.

**Bottom-up.**
1. Addressable population: ~${population} million.
2. Convert to buying units. For a consumer product, ${population} million people at ~4 people per household gives ~${Math.round(population / 4)} million households. For a business product, the relevant unit is establishments, not people — a different tree entirely, and I would state which I am using up front.
3. Filter to the addressable segment. Assume ~${rng.int(15, 40)}% of units are plausible buyers on income, need or regulation.
4. Apply penetration. For an established category assume ${rng.int(20, 60)}%; for an emerging one, single digits. ${product} is ${rng.pick(["emerging", "established"])} in this market, so I will use the lower end and flag it as the most sensitive assumption.
5. Apply a replacement cycle. A durable good bought every ${replacementYears} years means only ~${(100 / replacementYears).toFixed(0)}% of the installed base buys in any given year.
6. Multiply by average price.

**Cross-check.** Total consumer or business spend in the relevant parent category × the share this sub-category plausibly represents. If bottom-up and top-down differ by more than 2×, one of the assumptions is wrong — most often penetration or the replacement cycle.

**Sensitivity.** The answer swings hardest on penetration and price. Halving penetration halves the market; the population figure barely matters by comparison. This is the useful output of the exercise: it tells the investment committee which single number to go and research first, rather than pretending the whole estimate is equally uncertain.

**Recommendation.** Present a **range**, not a point — typically the bottom-up estimate ±50%. Then validate the two load-bearing assumptions cheaply before committing: 30 customer interviews will pin down penetration and willingness to pay far better than another week of desk research. A market size presented as a single number invites false confidence; a range with named uncertainties invites the right next question.`,
      };
    },
  },
];
