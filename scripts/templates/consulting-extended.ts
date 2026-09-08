import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Additional consulting archetypes: commercial due diligence, cost
 * transformation, post-merger synergy realisation, and a turnaround under
 * covenant pressure. These are the engagement shapes a first-year consultant
 * meets that the original six did not cover.
 */
export const CONSULTING_EXTENDED: Archetype[] = [
  {
    id: "commercial-dd",
    categorySlug: "due-diligence",
    domain: "consulting",
    difficulty: "hard",
    estimatedMinutes: 50,
    tags: ["due diligence", "m&a", "market growth", "customer concentration"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 25,
        risk_assessment: 20,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must test whether the growth is the market's or the company's — decomposing into market growth and share change — and check the multiple against what the growth supports.",
        market_analysis:
          "Looks for whether the addressable market is real and whether the growth rate in the model is sustainable rather than a recent spike.",
        risk_assessment:
          "Should identify customer concentration, contract renewal risk, and whether historical growth came from a source that will not repeat.",
        recommendation:
          "Must reach a proceed / proceed-at-a-lower-price / walk position, with the diligence question that would settle it.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(120, 600);
      const targetGrowth = rng.int(18, 45);
      const marketGrowth = rng.int(4, 20);
      const ebitdaPct = rng.int(12, 30);
      const multiple = rng.int(8, 18);
      const topCustomerPct = rng.int(18, 45);
      const top5Pct = Math.min(88, topCustomerPct + rng.int(15, 35));
      const contractYears = rng.int(1, 3);

      return {
        title: `${company.name}: Is This Target Growing, or Just Floating?`,
        scenario: `A private equity client is considering acquiring a ${company.sector} business in ${company.geo} at **${multiple}x EBITDA**.

The target turns over **${c.symbol}${revenue} ${c.big}**, growing at **${targetGrowth}% a year**, at a **${ebitdaPct}% EBITDA margin**. The underlying market is growing at about **${marketGrowth}%**.

Its largest customer is **${topCustomerPct}%** of revenue; the top five are **${top5Pct}%**. The average remaining contract term is **${contractYears} year${contractYears === 1 ? "" : "s"}**.

The vendor's model assumes growth continues at the current rate for five years. Your client has four weeks and wants to know whether to proceed.`,
        instructions: `Advise the deal team. Your answer should provide:

1. **Analysis** — decompose the growth. How much is market, how much is share gain, and what does the multiple assume?
2. **Risks** — what could make this a bad deal at any price.
3. **Recommendation** — proceed, reprice, or walk, and the one diligence question you would answer first.

State any assumptions you make.`,
        supportingData: {
          target: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            revenue_growth_pct: targetGrowth,
            ebitda_margin_pct: ebitdaPct,
            [`ebitda_${c.big.toLowerCase()}`]: Number(((revenue * ebitdaPct) / 100).toFixed(1)),
          },
          market: { market_growth_pct: marketGrowth },
          concentration: {
            largest_customer_pct: topCustomerPct,
            top_5_customers_pct: top5Pct,
            average_remaining_contract_years: contractYears,
          },
          deal: {
            ev_ebitda_multiple: multiple,
            [`implied_ev_${c.big.toLowerCase()}`]: Number(
              (((revenue * ebitdaPct) / 100) * multiple).toFixed(1),
            ),
          },
        },
        expectedFramework:
          "Growth = market growth + share change. Test whether share gain is repeatable, then stress the multiple against concentration and contract cover.",
        modelAnswer: `Growth decomposes into ${marketGrowth} points of market and ${targetGrowth - marketGrowth} points of share gain. The vendor's model assumes ${targetGrowth}% continues for five years, which requires taking share at ${targetGrowth - marketGrowth} points a year indefinitely — in a market growing at ${marketGrowth}%, that implies a share trajectory worth plotting explicitly, because it usually becomes implausible by year three.

At ${multiple}x on ${c.symbol}${((revenue * ebitdaPct) / 100).toFixed(1)} ${c.big} of EBITDA, the enterprise value is ${c.symbol}${(((revenue * ebitdaPct) / 100) * multiple).toFixed(1)} ${c.big}. That multiple is paying for the growth, not the current earnings — so if growth reverts to market, the entry price is materially too high.

Concentration is the risk that makes it bad at any price. One customer at ${topCustomerPct}% with only ${contractYears} year${contractYears === 1 ? "" : "s"} of average contract cover means a single non-renewal removes ${topCustomerPct}% of revenue and rather more of the EBITDA, inside the hold period.

Recommend proceeding only on a repriced basis, and answering one question first: why did the top customers choose this vendor, asked of the customers rather than the vendor. If the answer is price or a single relationship, walk. If it is switching cost or integration, the share gain may be real and the multiple arguable.`,
      };
    },
  },

  {
    id: "cost-transformation",
    categorySlug: "cost-reduction",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["cost", "restructuring", "zero-based", "margin"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must size the addressable cost base by category and apply realistic reduction rates, arriving at a total rather than a percentage aspiration.",
        market_analysis:
          "Looks for whether costs are genuinely out of line with peers, or whether the business simply serves a more expensive segment.",
        risk_assessment:
          "Should distinguish cuts that reduce capacity to serve from cuts that remove waste, and identify what breaks at the stated target.",
        recommendation:
          "Must propose a phased programme with amounts by category and a realistic timeline.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(400, 1500);
      const targetPct = rng.int(8, 20);
      const cogsPct = rng.int(52, 70);
      const peoplePct = rng.int(12, 24);
      const marketingPct = rng.int(4, 11);
      const techPct = rng.int(3, 9);
      const otherPct = Math.max(2, 100 - cogsPct - peoplePct - marketingPct - techPct - rng.int(4, 12));
      const peerMarginGap = rng.int(3, 11);

      return {
        title: `${company.name} Needs ${targetPct}% Out of the Cost Base`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo} turning over **${c.symbol}${revenue} ${c.big}**. Its operating margin sits **${peerMarginGap} points below** the peer median, and the board has mandated a **${targetPct}%** reduction in the cost base within eighteen months.

The cost base breaks down roughly as: cost of goods **${cogsPct}%** of revenue, people **${peoplePct}%**, marketing **${marketingPct}%**, technology **${techPct}%**, other overhead **${otherPct}%**.

The last two cost programmes each announced double-digit savings and neither showed up in the margin. Headcount has grown 40% in three years while revenue grew 25%.`,
        instructions: `Advise the CEO. Your answer should provide:

1. **Analysis** — where the money actually is, and what a realistic reduction looks like by category.
2. **Risks** — which cuts damage the business and which do not.
3. **Recommendation** — a phased programme with amounts and a sequence.

State any assumptions you make.`,
        supportingData: {
          [`revenue_${c.big.toLowerCase()}`]: revenue,
          cost_base_pct_of_revenue: {
            cogs: cogsPct,
            people: peoplePct,
            marketing: marketingPct,
            technology: techPct,
            other_overhead: otherPct,
          },
          context: {
            margin_gap_to_peers_pts: peerMarginGap,
            headcount_growth_3y_pct: 40,
            revenue_growth_3y_pct: 25,
            prior_programmes: 2,
            prior_programmes_visible_in_margin: false,
          },
          target: { cost_reduction_pct: targetPct },
        },
        expectedFramework:
          "Size each category in currency, apply category-specific realistic reduction rates, separate structural from discretionary, and phase by speed and reversibility.",
        modelAnswer: `In money: COGS is ${c.symbol}${((revenue * cogsPct) / 100).toFixed(0)} ${c.big}, people ${c.symbol}${((revenue * peoplePct) / 100).toFixed(0)} ${c.big}, marketing ${c.symbol}${((revenue * marketingPct) / 100).toFixed(0)} ${c.big}, technology ${c.symbol}${((revenue * techPct) / 100).toFixed(0)} ${c.big}. A ${targetPct}% reduction on the total cost base is roughly ${c.symbol}${((revenue * (cogsPct + peoplePct + marketingPct + techPct + otherPct)) / 100 * (targetPct / 100)).toFixed(0)} ${c.big}.

The arithmetic forces the conclusion: COGS is too large to leave alone. A programme that spares it and takes ${targetPct}% from overhead alone would need to cut overhead by more than half, which is not survivable.

The productivity gap is the real diagnosis. Headcount up 40% against revenue up 25% means each new person added less than the last — so this is not a cost problem to be solved once, it is a hiring-discipline problem that will regenerate. That is why two prior programmes vanished: they cut the level without changing the slope.

Phase it. Immediate and reversible first — discretionary spend, contractor rates, vendor renegotiation, roughly ${c.symbol}${((revenue * (marketingPct + techPct)) / 100 * 0.15).toFixed(0)} ${c.big}. Then structural: procurement redesign in COGS, which is slower but where the volume is. Take organisational cost last and once, with a hiring gate attached, because a second round destroys more value in attrition than it saves.`,
      };
    },
  },

  {
    id: "synergy-realisation",
    categorySlug: "post-merger",
    domain: "consulting",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["m&a", "integration", "synergies", "pmi"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 25,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must separate cost synergies from revenue synergies and apply different confidence to each, netting off the cost to achieve.",
        market_analysis:
          "Looks for whether the revenue synergies assume customers behave in ways they have not agreed to.",
        risk_assessment:
          "Should identify dis-synergies — attrition, customer overlap loss, distraction — which are routinely omitted from the deal model.",
        recommendation:
          "Must give a defensible synergy number and a sequencing plan with owners.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const combinedRevenue = rng.int(500, 2000);
      const costSynergy = rng.int(30, 140);
      const revenueSynergy = rng.int(40, 200);
      const costToAchieve = rng.int(25, 110);
      const overlapPct = rng.int(8, 30);
      const years = rng.int(2, 4);

      return {
        title: `${company.name}: The Synergy Case, Twelve Months In`,
        scenario: `${company.name} completed a merger in ${company.sector} a year ago, creating a **${c.symbol}${combinedRevenue} ${c.big}** business in ${company.geo}.

The deal model promised **${c.symbol}${costSynergy} ${c.big}** of annual cost synergies and **${c.symbol}${revenueSynergy} ${c.big}** of revenue synergies by year ${years}, against **${c.symbol}${costToAchieve} ${c.big}** of one-off integration cost.

Twelve months in, about 40% of the cost synergies have landed. None of the revenue synergies have. Customer overlap between the two businesses turned out to be **${overlapPct}%**, higher than diligence assumed. Voluntary attrition in the acquired sales team is running at twice the normal rate.

The CEO has to give the board a revised number.`,
        instructions: `Advise the CEO. Your answer should provide:

1. **Analysis** — a defensible revised synergy figure, split by type and netted of cost to achieve.
2. **Risks** — the dis-synergies the original model left out.
3. **Recommendation** — what to commit to publicly, and the sequence to get there.

State any assumptions you make.`,
        supportingData: {
          deal_model: {
            [`annual_cost_synergy_${c.big.toLowerCase()}`]: costSynergy,
            [`annual_revenue_synergy_${c.big.toLowerCase()}`]: revenueSynergy,
            [`one_off_cost_to_achieve_${c.big.toLowerCase()}`]: costToAchieve,
            target_year: years,
          },
          actual_12m: {
            cost_synergy_realised_pct: 40,
            revenue_synergy_realised_pct: 0,
            customer_overlap_pct: overlapPct,
            acquired_sales_attrition: "2x normal",
          },
          [`combined_revenue_${c.big.toLowerCase()}`]: combinedRevenue,
        },
        expectedFramework:
          "Cost synergies are controllable and land; revenue synergies depend on customers and usually do not. Net off cost to achieve and dis-synergies before committing.",
        modelAnswer: `Cost synergies are within management's control, and 40% in year one is roughly on track — assume most of the ${c.symbol}${costSynergy} ${c.big} lands, discounted to about ${c.symbol}${(costSynergy * 0.85).toFixed(0)} ${c.big}.

Revenue synergies require customers to buy something they have not agreed to buy. Zero realised in twelve months is the norm, not an anomaly. Applying a 30-40% confidence factor gives roughly ${c.symbol}${(revenueSynergy * 0.35).toFixed(0)} ${c.big} — and the ${overlapPct}% customer overlap works directly against it, because overlapping customers consolidate spend rather than adding to it.

The omission that matters is dis-synergy. Sales attrition at twice normal in the acquired business means lost relationships and lost pipeline, plausibly ${c.symbol}${(combinedRevenue * 0.01).toFixed(0)}-${(combinedRevenue * 0.03).toFixed(0)} ${c.big} of revenue at risk, and the deal model almost certainly carried none of it.

Recommend committing publicly to the cost number only — around ${c.symbol}${(costSynergy * 0.85).toFixed(0)} ${c.big} — and describing revenue synergies as upside with no date attached. Boards forgive a lowered forecast once; they do not forgive a second miss. Then stop the attrition before chasing cross-sell: the people leaving are the ones the revenue synergies depend on.`,
      };
    },
  },
];
