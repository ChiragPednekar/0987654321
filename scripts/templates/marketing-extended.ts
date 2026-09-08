import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Additional marketing archetypes: unit economics of acquisition, channel
 * attribution, segmentation, and loyalty. The original three covered launch,
 * positioning and campaign response; these cover the arithmetic a marketing
 * syllabus actually examines.
 */
export const MARKETING_EXTENDED: Archetype[] = [
  {
    id: "cac-payback",
    categorySlug: "growth-marketing",
    domain: "marketing",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["cac", "ltv", "payback", "unit economics"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 20,
        risk_assessment: 15,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must compute CAC, gross-margin-adjusted lifetime value, the LTV/CAC ratio and the payback period in months. Credit answers that use contribution margin rather than revenue.",
        market_analysis:
          "Looks for whether the blended CAC hides a cheap channel subsidising an expensive one, and whether retention differs by channel.",
        risk_assessment:
          "Should note that LTV computed from a short history over-extrapolates, and that payback longer than the funding runway is a solvency problem, not a marketing one.",
        recommendation:
          "Must decide whether to scale, hold or cut spend, by channel, with the numbers.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const monthlySpend = rng.int(20, 160);
      const newCustomers = rng.int(400, 4000);
      const arpuMonthly = rng.int(300, 4000);
      const grossMarginPct = rng.int(55, 85);
      const monthlyChurnPct = rng.float(1.5, 8.0, 1);
      const paidSharePct = rng.int(45, 85);

      const cac = Math.round((monthlySpend * (c.big === "Cr" ? 10_000_000 : 1_000_000)) / newCustomers);
      const lifetimeMonths = Number((100 / monthlyChurnPct).toFixed(1));
      const ltv = Math.round(arpuMonthly * (grossMarginPct / 100) * lifetimeMonths);
      const paybackMonths = Number(
        (cac / (arpuMonthly * (grossMarginPct / 100))).toFixed(1),
      );

      return {
        title: `${company.name}: Is the Growth Worth What It Costs?`,
        scenario: `${company.name} sells ${company.sector} subscriptions in ${company.geo}. Growth has been strong and the board has asked whether it is profitable growth.

Marketing spends **${c.symbol}${monthlySpend} ${c.big} a month** and acquires about **${newCustomers.toLocaleString()} new customers** in that time. Average revenue per user is **${c.symbol}${arpuMonthly} a month** at a **${grossMarginPct}%** gross margin. Monthly logo churn runs at **${monthlyChurnPct}%**.

Roughly **${paidSharePct}%** of new customers come through paid channels; the rest arrive organically but are counted in the same blended figure. The CMO reports a healthy LTV/CAC and wants to double the budget.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — CAC, LTV on a margin basis, the ratio, and payback in months. Show the working.
2. **Risks** — what the blended number is hiding.
3. **Recommendation** — scale, hold or cut, and where.

State any assumptions you make.`,
        supportingData: {
          spend: {
            [`monthly_marketing_spend_${c.big.toLowerCase()}`]: monthlySpend,
            new_customers_per_month: newCustomers,
            paid_share_of_new_customers_pct: paidSharePct,
          },
          economics: {
            arpu_monthly: arpuMonthly,
            gross_margin_pct: grossMarginPct,
            monthly_churn_pct: monthlyChurnPct,
          },
          derived_hints: {
            blended_cac: cac,
            implied_lifetime_months: lifetimeMonths,
            ltv_gross_margin_basis: ltv,
            payback_months: paybackMonths,
          },
        },
        expectedFramework:
          "CAC = spend / customers acquired. LTV = ARPU x gross margin x 1/churn. Judge on payback period and on unblended channel economics.",
        modelAnswer: `Blended CAC = ${c.symbol}${monthlySpend} ${c.big} / ${newCustomers.toLocaleString()} = **${c.symbol}${cac.toLocaleString()}**. Implied lifetime at ${monthlyChurnPct}% monthly churn is 1/${monthlyChurnPct}% = ${lifetimeMonths} months. LTV on a margin basis = ${c.symbol}${arpuMonthly} x ${grossMarginPct}% x ${lifetimeMonths} = **${c.symbol}${ltv.toLocaleString()}**, an LTV/CAC of about **${(ltv / cac).toFixed(1)}x** with payback in **${paybackMonths} months**.

The flaw is in the denominator. Only ${paidSharePct}% of those customers were bought; the organic ${100 - paidSharePct}% are diluting the CAC and making paid look cheaper than it is. True paid CAC is roughly ${c.symbol}${Math.round(cac / (paidSharePct / 100)).toLocaleString()}, which changes the ratio to about ${(ltv / (cac / (paidSharePct / 100))).toFixed(1)}x.

Payback matters more than the ratio when cash is finite: ${paybackMonths} months of payback means every rupee of growth is a rupee of working capital locked up for that long. Doubling the budget doubles the cash absorbed before it doubles the revenue.

Recommend unblending the reporting by channel first, then scaling only the channels whose true payback is inside the funding runway.`,
      };
    },
  },

  {
    id: "channel-attribution",
    categorySlug: "growth-marketing",
    domain: "marketing",
    difficulty: "hard",
    estimatedMinutes: 40,
    tags: ["attribution", "channel mix", "incrementality", "measurement"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 25,
        risk_assessment: 20,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must compare reported return by channel against a plausible incremental return, and quantify the double counting where totals exceed actual conversions.",
        market_analysis:
          "Looks for understanding that last-click over-credits channels near the conversion and under-credits demand generation.",
        risk_assessment:
          "Should propose a way to establish incrementality — holdout, geo split, or spend pause — rather than arguing about models.",
        recommendation:
          "Must reallocate budget with amounts, and specify the test that would validate the decision.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const totalSpend = rng.int(40, 200);
      const brandPct = rng.int(20, 40);
      const searchPct = rng.int(25, 45);
      const socialPct = 100 - brandPct - searchPct;
      const actualConversions = rng.int(6000, 40_000);
      const claimedMultiplier = rng.float(1.3, 2.1, 2);

      return {
        title: `${company.name}: Every Channel Claims the Same Sale`,
        scenario: `${company.name} sells ${company.sector} in ${company.geo}. Last quarter it spent **${c.symbol}${totalSpend} ${c.big}** across three channels: brand (${brandPct}%), paid search (${searchPct}%) and paid social (${socialPct}%).

The company recorded **${actualConversions.toLocaleString()} conversions**. Added together, the channel dashboards claim **${Math.round(actualConversions * claimedMultiplier).toLocaleString()}** — about **${claimedMultiplier}x** the real number.

Paid search reports the best return and the search team wants more budget. Brand reports the worst and is under pressure to justify itself. Attribution is last-click. Nobody has run a holdout test.`,
        instructions: `Advise the CMO. Your answer should provide:

1. **Analysis** — what the reported numbers can and cannot tell you, quantified.
2. **Risks** — what happens if you reallocate on last-click alone.
3. **Recommendation** — a budget decision and the experiment that would prove it.

State any assumptions you make.`,
        supportingData: {
          spend_split_pct: { brand: brandPct, paid_search: searchPct, paid_social: socialPct },
          [`total_spend_${c.big.toLowerCase()}`]: totalSpend,
          conversions: {
            actual_recorded: actualConversions,
            sum_of_channel_claims: Math.round(actualConversions * claimedMultiplier),
            overclaim_multiple: claimedMultiplier,
          },
          measurement: { model: "last click", holdout_tests_run: 0 },
        },
        expectedFramework:
          "Separate correlation from incrementality. Last-click credits the final touch; demand generation appears worthless under it. Design a holdout before reallocating.",
        modelAnswer: `The channels claim ${Math.round(actualConversions * claimedMultiplier).toLocaleString()} conversions against ${actualConversions.toLocaleString()} real ones — roughly ${Math.round((claimedMultiplier - 1) * 100)}% double counting. Every reported ROAS in this deck is therefore overstated, and not evenly.

Last-click systematically flatters the channel closest to the transaction. Paid search looks best partly because it captures demand other channels created: someone who saw the brand campaign then searched the brand name is booked as a search conversion. Cutting brand to fund search would, on this evidence, raise search's apparent return while lowering total sales — and the dashboard would show it working.

The honest answer is that these numbers cannot rank the channels, and no attribution model will fix that, because they are all built on the same correlational data.

Recommend holding the split, and running a geo holdout: suppress brand spend in a matched set of regions for six to eight weeks and measure total conversions against control. That produces an incrementality estimate, and it is the only thing here that would justify moving ${c.symbol}${Math.round(totalSpend * 0.2)} ${c.big} of budget.`,
      };
    },
  },

  {
    id: "loyalty-programme",
    categorySlug: "retention-marketing",
    domain: "marketing",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["loyalty", "retention", "margin", "programme design"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 20,
        risk_assessment: 15,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must net the reward cost against incremental margin, and separate customers whose behaviour changed from those who would have bought anyway.",
        market_analysis:
          "Looks for whether the category has enough purchase frequency for loyalty to work at all.",
        risk_assessment:
          "Should identify the subsidy to existing loyal customers as the main cost, and the liability created by unredeemed points.",
        recommendation:
          "Must commit to launch, redesign or decline, with the break-even incremental frequency.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const activeCustomers = rng.int(50_000, 800_000);
      const purchasesPerYear = rng.float(2.5, 14, 1);
      const basket = rng.int(400, 4500);
      const grossMarginPct = rng.int(25, 55);
      const rewardPct = rng.float(2, 8, 1);
      const expectedUpliftPct = rng.float(3, 12, 1);
      const alreadyLoyalPct = rng.int(35, 65);

      return {
        title: `${company.name}: Will the Loyalty Programme Pay for Itself?`,
        scenario: `${company.name} operates in ${company.sector} across ${company.geo} with about **${activeCustomers.toLocaleString()} active customers**, who buy **${purchasesPerYear} times a year** at an average basket of **${c.symbol}${basket}**. Gross margin is **${grossMarginPct}%**.

Marketing proposes a points programme returning **${rewardPct}%** of spend as future credit. The business case assumes a **${expectedUpliftPct}%** lift in purchase frequency among members.

Analysis of the base shows **${alreadyLoyalPct}%** of customers already buy above the category average and would very likely enrol on day one.`,
        instructions: `Advise the CMO. Your answer should provide:

1. **Analysis** — programme cost, incremental margin, and the net position. Show your working.
2. **Risks** — including who you are paying and what for.
3. **Recommendation** — launch, redesign or decline, with the break-even uplift.

State any assumptions you make.`,
        supportingData: {
          base: {
            active_customers: activeCustomers,
            purchases_per_year: purchasesPerYear,
            average_basket: basket,
            gross_margin_pct: grossMarginPct,
          },
          proposal: {
            reward_rate_pct: rewardPct,
            assumed_frequency_uplift_pct: expectedUpliftPct,
          },
          base_composition: { already_above_average_frequency_pct: alreadyLoyalPct },
        },
        expectedFramework:
          "Reward cost applies to all spend; incremental margin applies only to changed behaviour. Break-even uplift = reward rate / gross margin.",
        modelAnswer: `The reward is paid on every rupee, the uplift only arrives on some of them. Break-even frequency uplift = reward rate / gross margin = ${rewardPct}% / ${grossMarginPct}% = about **${((rewardPct / grossMarginPct) * 100).toFixed(1)}%**.

The plan assumes ${expectedUpliftPct}%, so on the stated numbers it ${expectedUpliftPct > (rewardPct / grossMarginPct) * 100 ? "clears break-even, but not by much" : "does not clear break-even"}.

The real problem is the ${alreadyLoyalPct}% who already buy frequently. They enrol first, redeem most, and change their behaviour least — so a large share of the reward budget is a straight discount to customers you already had. Incremental margin only comes from the remaining ${100 - alreadyLoyalPct}%, which means the effective break-even uplift among *switchable* customers is roughly ${(((rewardPct / grossMarginPct) * 100) / ((100 - alreadyLoyalPct) / 100)).toFixed(1)}%.

Recommend redesigning rather than declining: tier the reward so it pays for behaviour above each customer's own baseline instead of on all spend, and carry the unredeemed points as a liability from day one rather than discovering it at year end.`,
      };
    },
  },
];
