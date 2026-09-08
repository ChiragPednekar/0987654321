import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Additional strategy archetypes: vertical integration, portfolio
 * rationalisation, and competitive response. Each forces a commitment under
 * uncertainty rather than a description of the industry.
 */
export const STRATEGY_EXTENDED: Archetype[] = [
  {
    id: "vertical-integration",
    categorySlug: "corporate-strategy",
    domain: "strategy",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["vertical integration", "make or buy", "value chain", "moat"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 25,
        risk_assessment: 20,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must compare the margin captured against the capital and fixed cost absorbed, and compute the volume at which owning beats buying.",
        market_analysis:
          "Looks for why the margin sits upstream at all — scarcity, scale, or switching cost — and whether integrating actually captures it.",
        risk_assessment:
          "Should cover loss of flexibility, becoming a captive customer of your own plant, and competing with the suppliers you still need.",
        recommendation:
          "Must commit to integrate, partner or continue buying, with the volume threshold that decides it.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const annualPurchase = rng.int(80, 400);
      const supplierMarginPct = rng.int(12, 35);
      const plantCapex = rng.int(150, 700);
      const plantFixedAnnual = rng.int(20, 90);
      const utilisationNeededPct = rng.int(60, 85);
      const suppliers = rng.int(1, 4);

      return {
        title: `${company.name}: Buy the Supplier or Keep Buying From Them?`,
        scenario: `${company.name} operates in ${company.sector} across ${company.geo}. It buys a critical input worth **${c.symbol}${annualPurchase} ${c.big} a year** from ${suppliers === 1 ? "a single supplier" : `${suppliers} suppliers`}, who earn an estimated **${supplierMarginPct}% margin** on it.

The strategy team argues the company should build its own plant: **${c.symbol}${plantCapex} ${c.big}** of capital and **${c.symbol}${plantFixedAnnual} ${c.big} a year** of fixed cost, running economically only above about **${utilisationNeededPct}%** utilisation.

The CEO's case is that the supplier margin is "our money". The COO points out the company has never run a plant of this kind, and that demand for the end product has swung by more than 20% in each of the last three years.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — the margin at stake versus the cost of capturing it, and the break-even volume.
2. **Risks** — operational, strategic and demand-related.
3. **Recommendation** — integrate, partner, or keep buying, with the condition that changes it.

State any assumptions you make.`,
        supportingData: {
          current: {
            [`annual_purchase_${c.big.toLowerCase()}`]: annualPurchase,
            supplier_count: suppliers,
            estimated_supplier_margin_pct: supplierMarginPct,
            [`margin_pool_${c.big.toLowerCase()}`]: Number(
              ((annualPurchase * supplierMarginPct) / 100).toFixed(1),
            ),
          },
          build_option: {
            [`capex_${c.big.toLowerCase()}`]: plantCapex,
            [`annual_fixed_cost_${c.big.toLowerCase()}`]: plantFixedAnnual,
            economic_utilisation_threshold_pct: utilisationNeededPct,
          },
          context: { end_demand_volatility_pct: 20, prior_manufacturing_experience: "none" },
        },
        expectedFramework:
          "Size the margin pool, subtract the fixed cost of owning it, then test against demand volatility and the utilisation threshold.",
        modelAnswer: `The margin pool is ${c.symbol}${((annualPurchase * supplierMarginPct) / 100).toFixed(1)} ${c.big} a year. Owning it costs ${c.symbol}${plantFixedAnnual} ${c.big} of fixed cost annually plus the return required on ${c.symbol}${plantCapex} ${c.big} of capital — at a 12% cost of capital that is another ${c.symbol}${(plantCapex * 0.12).toFixed(1)} ${c.big}. Total ${c.symbol}${(plantFixedAnnual + plantCapex * 0.12).toFixed(1)} ${c.big} against a ${c.symbol}${((annualPurchase * supplierMarginPct) / 100).toFixed(1)} ${c.big} prize.

"Their margin is our money" is the error. That margin is the price of someone else carrying the fixed cost and the volume risk. Buying the asset means buying the risk with it.

The demand volatility is decisive. Swings of 20% against a plant needing ${utilisationNeededPct}% utilisation to be economic means the plant is underwater in bad years, and in those years the company is also a captive customer with no ability to shop the price down. Buying preserves that option; owning sells it.

Recommend continuing to buy, and spending a fraction of the ${c.symbol}${plantCapex} ${c.big} on ${suppliers === 1 ? "qualifying a second supplier, which captures much of the pricing benefit without any of the fixed cost" : "a longer-term contract in exchange for a price step-down"}. Revisit if demand volatility falls below 10% for two consecutive years.`,
      };
    },
  },


  {
    id: "regulatory-shock",
    categorySlug: "corporate-strategy",
    domain: "strategy",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["regulation", "scenario planning", "policy", "resilience"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 25,
        risk_assessment: 25,
        recommendation: 10,
      },
      descriptors: {
        financial_analysis:
          "Must quantify the exposure under each scenario rather than describing it — revenue at risk, margin impact, and the cost of each mitigation.",
        market_analysis:
          "Looks for whether the rule changes the industry structure or only the company's costs, and whether competitors are equally exposed.",
        risk_assessment:
          "Should build discrete scenarios with rough probabilities instead of a single forecast, and identify which moves are robust across all of them.",
        recommendation:
          "Must commit to the no-regrets actions now and name the trigger for the contingent ones.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(200, 900);
      const exposedPct = rng.int(25, 70);
      const complianceCost = rng.int(10, 70);
      const marginPct = rng.int(10, 24);
      const monthsToEffect = rng.int(9, 30);
      const probStrictPct = rng.int(20, 55);

      return {
        title: `${company.name}: A Rule Change Is Coming and Nobody Knows How Hard`,
        scenario: `${company.name} operates in ${company.sector} across ${company.geo}, turning over **${c.symbol}${revenue} ${c.big}** at a **${marginPct}%** operating margin.

A regulator has published draft rules affecting the segment that produces about **${exposedPct}%** of revenue. The final text is expected in **${monthsToEffect} months**.

Two readings are circulating. Under the strict reading, compliance costs roughly **${c.symbol}${complianceCost} ${c.big} a year** and one product line becomes unsellable in its current form. Under the lenient reading, the cost is largely disclosure and process, perhaps a fifth of that. Trade counsel puts the strict outcome at roughly **${probStrictPct}%**.

The board wants to know what to do now, before the text is final.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — exposure under each scenario, quantified against revenue and margin.
2. **Risks** — including what competitors do, and what waiting costs.
3. **Recommendation** — the actions to take now regardless, and the trigger for the rest.

State any assumptions you make.`,
        supportingData: {
          exposure: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            exposed_revenue_pct: exposedPct,
            [`exposed_revenue_${c.big.toLowerCase()}`]: Number(
              ((revenue * exposedPct) / 100).toFixed(1),
            ),
            operating_margin_pct: marginPct,
          },
          scenarios: {
            strict: {
              probability_pct: probStrictPct,
              [`annual_compliance_cost_${c.big.toLowerCase()}`]: complianceCost,
              product_line_impact: "one line unsellable as configured",
            },
            lenient: {
              probability_pct: 100 - probStrictPct,
              [`annual_compliance_cost_${c.big.toLowerCase()}`]: Number(
                (complianceCost / 5).toFixed(1),
              ),
            },
          },
          timing: { months_until_final_text: monthsToEffect },
        },
        expectedFramework:
          "Build two discrete scenarios, quantify exposure in each, separate no-regrets moves from contingent ones, and price the option value of waiting.",
        modelAnswer: `Exposed revenue is ${c.symbol}${((revenue * exposedPct) / 100).toFixed(1)} ${c.big}. Under the strict reading, ${c.symbol}${complianceCost} ${c.big} of annual cost against ${c.symbol}${((revenue * marginPct) / 100).toFixed(1)} ${c.big} of operating profit removes roughly ${Math.round((complianceCost / ((revenue * marginPct) / 100)) * 100)}% of group profit before the lost product line. Expected cost across both scenarios is about ${c.symbol}${((probStrictPct / 100) * complianceCost + (1 - probStrictPct / 100) * (complianceCost / 5)).toFixed(1)} ${c.big} — a number worth computing and then ignoring, because you will face one outcome, not the average.

Split the response by regret. Reformulating the at-risk product line, improving data capture, and engaging the consultation are worth doing in **both** worlds: they cost little and pay off either way. Rebuilding the compliance function, exiting the segment, or repricing the book are strict-scenario moves that destroy value if the lenient reading lands.

Waiting has an option value but a deadline: at ${monthsToEffect} months, anything with a lead time longer than that must start now or not at all. That lead time, not the probability, is what should drive the decision.

Recommend committing to the no-regrets set immediately, and pre-agreeing the strict-scenario plan with a named trigger — publication of the final text — so it executes rather than being re-debated.`,
      };
    },
  },
];
