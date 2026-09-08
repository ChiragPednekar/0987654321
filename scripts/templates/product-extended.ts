import type { Archetype } from "../lib/generator";

/**
 * Additional product archetypes: cohort retention, prioritisation under a fixed
 * budget, marketplace liquidity, and reading an experiment honestly. These are
 * the four conversations a PM actually has that the original five did not cover.
 */
export const PRODUCT_EXTENDED: Archetype[] = [


  {
    id: "marketplace-liquidity",
    categorySlug: "marketplace",
    domain: "product_management",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["marketplace", "liquidity", "two-sided", "supply"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 25,
        risk_assessment: 20,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must compute match rate and identify which side is constraining, using the search-to-fill numbers rather than headline user counts.",
        market_analysis:
          "Looks for understanding that marketplace liquidity is local — a national average hides city-level failure.",
        risk_assessment:
          "Should note that subsidising the short side is expensive and reverses when the subsidy stops, and that over-supplying the long side makes matters worse.",
        recommendation:
          "Must pick a side, a geography, and a mechanism, with the metric that proves it worked.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const buyers = rng.int(40_000, 400_000);
      const sellers = rng.int(2_000, 30_000);
      const searches = rng.int(200_000, 900_000);
      const fillRatePct = rng.int(38, 72);
      const topCityFillPct = rng.int(70, 92);
      const tailCityFillPct = rng.int(12, 35);
      const cities = rng.int(6, 40);

      return {
        title: `${company.name}: Plenty of Demand, Nothing to Buy`,
        scenario: `${company.name} runs a ${company.sector} marketplace in ${company.geo}, live in **${cities} cities**.

Last month: **${buyers.toLocaleString()} active buyers**, **${sellers.toLocaleString()} active sellers**, **${searches.toLocaleString()} searches**, and an overall fill rate of **${fillRatePct}%**.

That average conceals a wide spread. The three largest cities fill at about **${topCityFillPct}%**. The bottom half of cities fill at around **${tailCityFillPct}%**.

Growth marketing has been buying buyer-side installs, because buyer acquisition is cheaper and the install numbers look good in the board deck. Supply acquisition is manual and slow.`,
        instructions: `Advise the general manager. Your answer should provide:

1. **Analysis** — which side is constrained, where, and what the fill rate really says.
2. **Risks** — what happens if you keep acquiring on the current side.
3. **Recommendation** — which side, which cities, which mechanism, and the metric that proves it.

State any assumptions you make.`,
        supportingData: {
          scale: {
            active_buyers: buyers,
            active_sellers: sellers,
            searches: searches,
            buyer_to_seller_ratio: Number((buyers / sellers).toFixed(1)),
          },
          liquidity: {
            overall_fill_rate_pct: fillRatePct,
            top_3_cities_fill_pct: topCityFillPct,
            bottom_half_cities_fill_pct: tailCityFillPct,
            cities_live: cities,
          },
          acquisition: { buyer_side: "paid, scaling", seller_side: "manual, flat" },
        },
        expectedFramework:
          "Liquidity is local. Find the constrained side per geography, stop acquiring on the long side, and concentrate supply until density crosses the threshold.",
        modelAnswer: `A ${(buyers / sellers).toFixed(1)}:1 buyer-to-seller ratio with a ${fillRatePct}% fill rate says supply is the constraint, not demand. Buying more buyers into that adds searches that cannot be filled — which raises acquisition cost and lowers fill rate at the same time.

The national average is the more dangerous number. At ${topCityFillPct}% the top cities are liquid and compounding; at ${tailCityFillPct}% the bottom half is failing, and a buyer whose first search returns nothing rarely comes back. Averaging them produces ${fillRatePct}%, a figure describing no city that exists.

Recommend three things. Stop paid buyer acquisition in the bottom-half cities entirely — you are paying to create bad first experiences. Redirect that budget to seller acquisition concentrated in the two or three tail cities closest to the density threshold, rather than spread across all ${Math.round(cities / 2)}. And change the reported metric from installs to city-level fill rate, because the current dashboard rewards exactly the behaviour causing the problem.`,
      };
    },
  },

  {
    id: "experiment-readout",
    categorySlug: "experimentation",
    domain: "product_management",
    difficulty: "hard",
    estimatedMinutes: 35,
    tags: ["ab testing", "statistics", "experimentation", "decision"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 25,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must engage with the sample size and effect size, and judge whether the observed lift is distinguishable from noise.",
        market_analysis:
          "Looks for whether the primary metric is the one the business cares about, and whether a guardrail metric moved.",
        risk_assessment:
          "Should identify peeking, multiple comparisons, and short-run novelty effects as reasons a result may not hold.",
        recommendation:
          "Must decide ship, iterate or kill, and say what evidence would change it.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const perArm = rng.int(1_200, 40_000);
      const baselinePct = rng.float(2.0, 9.0, 1);
      const liftPct = rng.float(1.5, 14, 1);
      const variantsTested = rng.int(1, 6);
      const runDays = rng.int(3, 21);
      const guardrailDropPct = rng.float(0.2, 3.5, 1);

      return {
        title: `${company.name}: The Test Says Ship. Should You?`,
        scenario: `${company.name} ran an experiment on its ${company.sector} product in ${company.geo}.

The new checkout flow was tested against control with **${perArm.toLocaleString()} users per arm** over **${runDays} days**. Control converted at **${baselinePct}%**; the variant converted **${liftPct}% relatively higher**. The team reports the result as significant at p < 0.05.

Two details sit further down the document. The team tested **${variantsTested} variant${variantsTested === 1 ? "" : "s"}** against the same control, and checked results daily, calling the test when it crossed the threshold. A guardrail metric — refund rate — rose by **${guardrailDropPct} percentage points**, which was reported as "not significant".

The PM wants to ship on Monday.`,
        instructions: `Advise the PM. Your answer should provide:

1. **Analysis** — whether this result supports the conclusion, given the sample and how the test was run.
2. **Risks** — the specific ways this readout could be wrong.
3. **Recommendation** — ship, iterate, or re-run, with what you would require.

State any assumptions you make.`,
        supportingData: {
          design: {
            users_per_arm: perArm,
            variants_against_one_control: variantsTested,
            run_days: runDays,
            stopping_rule: "checked daily, stopped when p < 0.05",
          },
          results: {
            control_conversion_pct: baselinePct,
            relative_lift_pct: liftPct,
            absolute_lift_pts: Number((baselinePct * (liftPct / 100)).toFixed(2)),
          },
          guardrails: {
            refund_rate_change_pts: guardrailDropPct,
            reported_as: "not significant",
          },
        },
        expectedFramework:
          "Check power, then the stopping rule, then multiple comparisons, then guardrails. A p-value from a peeked test is not a p-value.",
        modelAnswer: `The absolute lift is ${(baselinePct * (liftPct / 100)).toFixed(2)} percentage points on a ${baselinePct}% baseline. With ${perArm.toLocaleString()} per arm, an effect that small is ${perArm > 15000 ? "near the edge of what this sample can resolve" : "very likely inside the noise — the test is underpowered for it"}.

Three problems compound. Stopping the moment p crossed 0.05, having peeked daily for ${runDays} days, inflates the false positive rate well above 5% — the threshold assumes one look, not ${runDays}. Testing ${variantsTested} variant${variantsTested === 1 ? "" : "s"} against one control compounds it further${variantsTested > 1 ? ", and no correction appears to have been applied" : ""}. And ${runDays} days ${runDays < 14 ? "does not cover a full weekly cycle, so the result may be a day-of-week artefact, and any novelty effect is still in the data" : "is short enough that novelty effects have not decayed"}.

The refund rate is the part that should stop the ship. "Not significant" on a guardrail is not evidence of no harm — it usually means the test was never powered to detect harm at that scale. A ${guardrailDropPct}-point rise in refunds could exceed the value of the conversion lift outright.

Recommend re-running with a pre-registered sample size, a fixed end date, correction for the multiple variants, and refund rate as a powered secondary metric. Do not ship Monday.`,
      };
    },
  },
];
