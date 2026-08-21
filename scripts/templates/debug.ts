import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Debug archetypes — "fix the pitch / fix the model" (spec §6e).
 *
 * The student is handed a finished piece of work that is confidently wrong,
 * and has to find the error rather than produce an answer from scratch. Each
 * case embeds exactly one decisive flaw plus a few plausible-but-harmless
 * details, so the skill being tested is discrimination, not suspicion.
 */
export const DEBUG_ARCHETYPES: Archetype[] = [
  // ------------------------------------------------- broken DCF ---
  {
    id: "debug-dcf",
    categorySlug: "dcf",
    domain: "finance",
    difficulty: "hard",
    estimatedMinutes: 40,
    tags: ["debug", "dcf", "valuation", "wacc"],
    rubric: {
      criteria: {
        error_identification: 35,
        quantitative_correction: 30,
        explanation: 20,
        residual_review: 15,
      },
      descriptors: {
        error_identification:
          "Must name the decisive error — terminal growth exceeding the discount rate — not merely list things that look odd.",
        quantitative_correction:
          "Should recompute terminal value with a defensible growth rate and show the corrected figure.",
        explanation:
          "Explains why the formula breaks, not just that the number is large.",
        residual_review:
          "Notes the lesser issues without inflating them into the headline problem.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const fcf = rng.int(40, 120);
      const wacc = rng.int(9, 12);
      const badGrowth = wacc + rng.int(1, 3); // the decisive flaw
      const sensibleGrowth = rng.int(2, 4);

      const badTv = Math.round((fcf * (1 + badGrowth / 100)) / 0.001);
      const goodTv = Math.round(
        (fcf * (1 + sensibleGrowth / 100)) / ((wacc - sensibleGrowth) / 100),
      );

      return {
        title: `${company.name}: Review This DCF Before It Goes to the IC`,
        scenario: `An analyst at ${company.name} has produced the valuation below for the investment committee. It is due to be presented tomorrow. Your job is to review it, not to rebuild it.

**The analyst's model**

| Input | Value |
|---|---|
| Year-5 free cash flow | ${c.symbol}${fcf} ${c.big} |
| WACC | ${wacc}% |
| Terminal growth rate | **${badGrowth}%** |
| Terminal value | ${c.symbol}${badTv.toLocaleString()} ${c.big} |
| Forecast horizon | 5 years |
| Mid-year convention | Not applied |
| Net debt | Deducted at book value |

The analyst's note reads: *"Terminal value dominates the valuation at roughly 95% of enterprise value, which is normal for a growth business. The model shows substantial upside and I recommend we proceed."*

The IC will approve based on this number unless someone objects.`,
        instructions: `Review the model. Your answer should provide:

1. **Analysis** — identify the error or errors, and say which one actually matters.
2. **Risks** — what happens if this goes to the committee uncorrected.
3. **Recommendation** — the corrected figure, computed, and what you would tell the analyst.

State any assumptions you make.`,
        supportingData: {
          model: {
            year_5_fcf: fcf,
            wacc_pct: wacc,
            terminal_growth_pct: badGrowth,
            stated_terminal_value: badTv,
            mid_year_convention: false,
          },
          derived_hints: {
            defensible_growth_pct: sensibleGrowth,
            corrected_terminal_value: goodTv,
          },
        },
        expectedFramework:
          "Gordon growth constraint (g < WACC); recompute TV; sanity-check TV share of EV",
        modelAnswer: `The decisive error is that **terminal growth (${badGrowth}%) exceeds the discount rate (${wacc}%)**.

1. **Why it breaks.** Terminal value under Gordon growth is FCF × (1+g) ÷ (WACC − g). With g > WACC the denominator turns negative, and as g approaches WACC it approaches zero — which is how the analyst produced ${c.symbol}${badTv.toLocaleString()} ${c.big}. The number is not optimistic, it is undefined. A perpetual growth rate above the cost of capital also implies the business eventually exceeds the size of the economy.

2. **The correction.** With a defensible ${sensibleGrowth}% — at or below long-run nominal GDP — terminal value becomes ${c.symbol}${fcf} × 1.0${sensibleGrowth} ÷ (${wacc}% − ${sensibleGrowth}%) ≈ **${c.symbol}${goodTv.toLocaleString()} ${c.big}**. That is a different investment case entirely.

3. **The analyst's own note is the tell.** "Terminal value is 95% of enterprise value" is presented as reassurance. It is the symptom. A TV share that high means the explicit forecast is doing no work and the valuation rests entirely on the broken assumption.

4. **The lesser issues, in proportion.** No mid-year convention modestly understates value; net debt at book rather than market is a minor refinement. Both are worth raising, neither changes the recommendation. Do not lead with them.

5. **What to tell the analyst.** The model cannot go to the IC. Constrain g below WACC as a hard rule, and re-underwrite with the corrected terminal value before forming any view.

The weakest answers list every imperfection with equal weight. The strongest ones identify the one error that makes the output meaningless, and treat the rest as footnotes.`,
      };
    },
  },

  // --------------------------------------------- broken market sizing ---
  {
    id: "debug-market-sizing",
    categorySlug: "market-sizing",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["debug", "market-sizing", "estimation"],
    rubric: {
      criteria: {
        error_identification: 35,
        quantitative_correction: 30,
        explanation: 20,
        residual_review: 15,
      },
      descriptors: {
        error_identification:
          "Must catch the double-count between households and individuals, which is what inflates the answer by roughly an order of magnitude.",
        quantitative_correction:
          "Recomputes the size on a consistent unit and shows the working.",
        explanation:
          "Explains why mixing units invalidates the estimate.",
        residual_review:
          "Comments on the softer assumptions without treating them as the main fault.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const population = rng.int(120, 260);
      const householdSize = rng.int(3, 5);
      const penetration = rng.int(18, 35);
      const price = rng.int(1200, 4800);
      const replacement = rng.int(4, 8);

      const households = Math.round(population / householdSize);
      const badUnits = Math.round((population * 1_000_000 * (penetration / 100)) / replacement);
      const goodUnits = Math.round((households * 1_000_000 * (penetration / 100)) / replacement);

      return {
        title: `${company.name}: This Market Size Looks Too Big`,
        scenario: `A junior consultant has sized the annual replacement market for a household appliance in ${company.geo}. The number is being used to justify a ${c.symbol}${rng.int(50, 200)} ${c.big} capacity investment.

**Their working, verbatim**

> Population is **${population}m**. Average household size is **${householdSize}**, so there are about **${households}m households**.
>
> Penetration of this appliance is **${penetration}%**.
>
> Appliances are replaced every **${replacement} years**.
>
> So annual replacement demand = ${population}m × ${penetration}% ÷ ${replacement} = **${(badUnits / 1_000_000).toFixed(1)}m units per year**.
>
> At **${c.symbol}${price}** per unit, that is a market of roughly **${c.symbol}${Math.round((badUnits * price) / c.multiplier).toLocaleString()} ${c.big}** a year.

The partner has asked you to check it before it goes in the deck.`,
        instructions: `Check the estimate. Your answer should provide:

1. **Analysis** — find the error and quantify how much it distorts the answer.
2. **Risks** — what depends on this number being right.
3. **Recommendation** — the corrected size, computed, and how you would sanity-check it.

State any assumptions you make.`,
        supportingData: {
          stated_working: {
            population_m: population,
            household_size: householdSize,
            households_m: households,
            penetration_pct: penetration,
            replacement_years: replacement,
            price_per_unit: price,
            stated_units_m: Number((badUnits / 1_000_000).toFixed(1)),
          },
          derived_hints: {
            corrected_units_m: Number((goodUnits / 1_000_000).toFixed(1)),
            overstatement_multiple: Number((badUnits / goodUnits).toFixed(1)),
          },
        },
        expectedFramework:
          "Unit consistency; households vs individuals; recompute; sanity-check against a known anchor",
        modelAnswer: `The decisive error is a **unit mismatch**: the consultant derives households, then sizes the market using population.

1. **What went wrong.** Penetration of a *household* appliance is a share of households, not of people. The working computes ${population}m × ${penetration}% — applying a household penetration rate to individuals. Because average household size is ${householdSize}, this overstates the market by roughly **${(badUnits / goodUnits).toFixed(1)}×**.

2. **The correction.** ${households}m households × ${penetration}% ÷ ${replacement} years ≈ **${(goodUnits / 1_000_000).toFixed(1)}m units a year**, versus the stated ${(badUnits / 1_000_000).toFixed(1)}m. At ${c.symbol}${price} that is ${c.symbol}${Math.round((goodUnits * price) / c.multiplier).toLocaleString()} ${c.big}, not ${c.symbol}${Math.round((badUnits * price) / c.multiplier).toLocaleString()} ${c.big}.

3. **Why it survived review.** Every individual input is defensible. The error is in the join between them, which is exactly where sizing errors hide and why stating units at each step matters.

4. **The softer assumptions, in proportion.** Flat ${penetration}% penetration ignores urban/rural split; a fixed ${replacement}-year replacement cycle ignores the installed-base age profile; new household formation is excluded entirely. All worth noting, none of them the reason the number is wrong.

5. **Sanity check.** Divide the corrected figure by households to get units per household per year and confirm it is consistent with a ${replacement}-year life. Any estimate that fails that reciprocal check is wrong regardless of how tidy the arithmetic looked.

The weakest answers re-derive the market from scratch and quietly get a different number. The strongest ones point at the exact line where units stopped matching.`,
      };
    },
  },

  // ------------------------------------------- broken recommendation ---
  {
    id: "debug-recommendation",
    categorySlug: "profitability",
    domain: "consulting",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["debug", "synthesis", "logic", "recommendation"],
    rubric: {
      criteria: {
        error_identification: 35,
        logic_correction: 30,
        explanation: 20,
        residual_review: 15,
      },
      descriptors: {
        error_identification:
          "Must catch that the recommendation does not follow from the evidence — the data show a mix problem, the pitch proposes a price fix.",
        logic_correction:
          "States what the evidence actually supports.",
        explanation:
          "Explains the reasoning gap rather than restating the data.",
        residual_review:
          "Notes presentation issues without mistaking them for the substantive fault.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(300, 900);
      const marginDrop = rng.int(3, 8);
      const priceChange = rng.int(-1, 1);
      const premiumDecline = rng.int(12, 28);
      const budgetGrowth = rng.int(15, 35);

      return {
        title: `${company.name}: Pressure-Test This Recommendation`,
        scenario: `A team has finished a margin diagnostic at ${company.name} (${c.symbol}${revenue} ${c.big} revenue) and drafted the recommendation below. The partner wants it pressure-tested before the client readout.

**The draft recommendation**

> "Operating margin fell **${marginDrop} points** this year. Our analysis shows the business has lost pricing discipline. We recommend an immediate **across-the-board price increase of 5-7%**, supported by tighter discount governance."

**The evidence pack behind it**

| Finding | Value |
|---|---|
| Average realised price, like-for-like | ${priceChange >= 0 ? "+" : ""}${priceChange}% |
| Premium-tier volume | −${premiumDecline}% |
| Budget-tier volume | +${budgetGrowth}% |
| Discount rate on premium tier | Unchanged |
| Input costs | +${rng.int(2, 6)}% |

The slide is well built and the client is expecting a pricing answer.`,
        instructions: `Pressure-test the recommendation. Your answer should provide:

1. **Analysis** — does the recommendation follow from the evidence? Show why or why not.
2. **Risks** — what happens if the client acts on it as written.
3. **Recommendation** — what the evidence actually supports.

State any assumptions you make.`,
        supportingData: {
          evidence: {
            margin_drop_points: marginDrop,
            like_for_like_price_change_pct: priceChange,
            premium_volume_change_pct: -premiumDecline,
            budget_volume_change_pct: budgetGrowth,
            premium_discount_rate: "unchanged",
          },
          draft_recommendation: "across-the-board price increase of 5-7%",
        },
        expectedFramework:
          "Does the conclusion follow from the evidence; price vs mix decomposition; corrected recommendation",
        modelAnswer: `The recommendation **does not follow from the evidence**. This is a mix problem being diagnosed as a pricing problem.

1. **The evidence contradicts the premise.** Like-for-like price moved ${priceChange >= 0 ? "+" : ""}${priceChange}% and discounting on the premium tier is unchanged. There is no pricing indiscipline in this data. What changed is *what customers bought*: premium volume down ${premiumDecline}%, budget volume up ${budgetGrowth}%. Margin fell because the sales mix shifted toward a lower-margin tier.

2. **Why the proposed action backfires.** An across-the-board 5-7% increase raises prices on the budget tier — the only part of the business currently growing — and on the premium tier that customers are already leaving. It accelerates the mix shift it is meant to cure. The recommendation is not merely unsupported; acting on it makes the problem worse.

3. **What the evidence supports.** Diagnose why premium volume is falling — competitive entry, a value perception change, or sales incentives quietly favouring easier budget-tier deals. Then act on mix: reposition premium, adjust incentives toward premium conversion, and review the budget tier's margin structure since it is now carrying the volume.

4. **Presentation issues, in proportion.** The slide asserts "lost pricing discipline" without a supporting exhibit, and reports margin in points without a price-volume-mix bridge. Real issues, but secondary to the conclusion being wrong.

5. **What to tell the team.** The number is right and the story is wrong. Build the price-volume-mix bridge first; the recommendation will follow from it rather than around it.

The weakest answers polish the wording of a conclusion that the data do not support. The strongest ones notice the evidence says mix and the slide says price.`,
      };
    },
  },
];
