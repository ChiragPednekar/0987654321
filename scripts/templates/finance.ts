import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Finance archetypes. Ten analytical shapes, expanded across company profiles
 * to produce 100 cases. Every scenario carries real numbers so the grader can
 * check whether the student actually computed anything.
 */
export const FINANCE_ARCHETYPES: Archetype[] = [
  // ------------------------------------------------------ capital raising ---
  {
    id: "capital-raise",
    categorySlug: "capital-raising",
    domain: "finance",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["fundraising", "burn", "runway", "dilution"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 20,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must compute runway (cash ÷ net burn), the burn multiple (net burn ÷ net new ARR), and the implied dilution at the stated valuation. Credit answers that check whether growth justifies the burn rather than asserting it.",
        market_analysis:
          "Looks for comparison against sector benchmarks (Rule of 40, growth-adjusted burn), the funding environment, and what comparable companies raise at this stage.",
        risk_assessment:
          "Should identify down-round risk, the consequences of not raising, dilution to founders, and the sensitivity of runway to growth slowing.",
        recommendation:
          "Must commit to raise / don't raise / raise a different amount, with a specific number and the trigger conditions that would change the answer.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const nrrPct = rng.int(95, 130);
      const grossMarginPct = rng.int(62, 82);
      const c = currency(company);
      const revenue = rng.int(30, 90);
      const growth = rng.int(20, 60);
      const burn = rng.int(12, 35);
      // Derive cash from a target runway rather than drawing it independently:
      // a raise/don't-raise decision is only interesting inside 9-22 months.
      const targetRunwayMonths = rng.int(9, 22);
      const cash = Math.max(5, Math.round((burn / 12) * targetRunwayMonths));
      const askAmount = rng.int(80, 200);
      const valuation = askAmount * rng.int(4, 8);
      const runway = (cash / (burn / 12)).toFixed(1);
      const netNewArr = Math.round(revenue * (growth / 100));
      const burnMultiple = (burn / netNewArr).toFixed(2);

      return {
        title: `${company.name}: Raise Capital or Extend Runway?`,
        scenario: `${company.name} is a ${company.sector} business operating in ${company.geo}. It closed last financial year at **${c.symbol}${revenue} ${c.big}** of annual recurring revenue, growing **${growth}% year on year**.

The company burns **${c.symbol}${burn} ${c.big} per year** on a net basis and holds **${c.symbol}${cash} ${c.big}** of cash. Gross margin is ${grossMarginPct}%, and net revenue retention sits at ${nrrPct}%.

The board has been approached by a growth fund offering **${c.symbol}${askAmount} ${c.big}** at a **${c.symbol}${valuation} ${c.big} pre-money valuation**. The CEO is torn: the round would fund an aggressive push into two adjacent markets, but the founders would take meaningful dilution, and one board member argues the company could reach breakeven on its existing cash instead.

The CFO wants a clear recommendation before the next board meeting.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — the financial position, computed rather than described. Show your working.
2. **Risks** — what could go wrong on each path, and what you would monitor.
3. **Recommendation** — a specific course of action, with the amount and terms you would accept or reject.

State any assumptions you make.`,
        supportingData: {
          financials: {
            [`arr_${c.big.toLowerCase()}`]: revenue,
            growth_pct: growth,
            [`net_burn_${c.big.toLowerCase()}_per_year`]: burn,
            [`cash_${c.big.toLowerCase()}`]: cash,
            gross_margin_pct: grossMarginPct,
            net_revenue_retention_pct: nrrPct,
          },
          proposed_round: {
            [`amount_${c.big.toLowerCase()}`]: askAmount,
            [`pre_money_${c.big.toLowerCase()}`]: valuation,
            implied_dilution_pct: Number(
              ((askAmount / (valuation + askAmount)) * 100).toFixed(1),
            ),
          },
          derived_hints: {
            runway_months: Number(runway),
            net_new_arr: netNewArr,
            burn_multiple: Number(burnMultiple),
          },
        },
        expectedFramework: `A strong answer works through, in order:

1. **Runway** — cash ÷ monthly net burn. Here that is ${c.symbol}${cash} ${c.big} ÷ ${(burn / 12).toFixed(1)} = **${runway} months**.
2. **Efficiency** — burn multiple = net burn ÷ net new ARR = ${burn} ÷ ${netNewArr} = **${burnMultiple}**. Below 1.5 is good; above 2 is expensive growth.
3. **Rule of 40** — growth % + margin %. Compare against the sector.
4. **Dilution** — round ÷ post-money.
5. **Counterfactual** — what breakeven requires: how much growth must be sacrificed, and is that a worse outcome than dilution?
6. **Decision** — commit, with trigger conditions.`,
        modelAnswer: `**Position.** ${company.name} has ${runway} months of runway (${c.symbol}${cash} ${c.big} ÷ ${(burn / 12).toFixed(1)} ${c.big}/month). That is ${Number(runway) < 18 ? "inside the window where fundraising becomes a forced move rather than a choice" : "comfortable enough to negotiate from strength"}.

**Efficiency.** Net new ARR is ${c.symbol}${netNewArr} ${c.big} (${revenue} × ${growth}%). Against ${c.symbol}${burn} ${c.big} of net burn, the burn multiple is ${burnMultiple}. ${Number(burnMultiple) < 1.5 ? "This is efficient growth — the company is converting capital into revenue well, which strengthens the case for stepping on the accelerator." : "This is expensive growth. Each unit of new revenue costs more than the benchmark, which weakens the argument for raising to grow faster rather than fixing efficiency first."}

**Dilution.** ${c.symbol}${askAmount} ${c.big} on a ${c.symbol}${valuation} ${c.big} pre-money is ${((askAmount / (valuation + askAmount)) * 100).toFixed(1)}% dilution. That is the price of the option on the adjacent markets.

**Risks.** The dominant risk is not dilution, it is raising late. If growth decelerates below ${Math.round(growth * 0.6)}%, the valuation on offer disappears and the next round is a down round. Against that, the breakeven path requires cutting roughly ${c.symbol}${burn} ${c.big} of annual spend, which almost certainly means cutting the growth that justifies the current multiple.

**Recommendation.** ${Number(burnMultiple) < 1.5 ? `Raise, but negotiate. The efficiency metrics support the story, so push the pre-money up or take ${c.symbol}${Math.round(askAmount * 0.7)} ${c.big} at the same valuation to reduce dilution while still funding one of the two adjacent markets rather than both.` : `Do not raise this round on these terms. Spend two quarters bringing the burn multiple below 1.5 by cutting the least efficient acquisition channel, then raise from a position of demonstrated efficiency.`} Revisit immediately if net new ARR falls two consecutive quarters, or if runway drops below 12 months.`,
      };
    },
  },

  // ----------------------------------------------------------------- DCF ---
  {
    id: "dcf-valuation",
    categorySlug: "dcf",
    domain: "finance",
    difficulty: "hard",
    estimatedMinutes: 60,
    tags: ["dcf", "wacc", "terminal-value", "valuation"],
    rubric: {
      criteria: {
        cash_flow_projection: 25,
        discount_rate: 20,
        terminal_value: 20,
        sensitivity_analysis: 15,
        recommendation: 20,
      },
      descriptors: {
        cash_flow_projection:
          "Free cash flow must be built from EBIT, not revenue: EBIT × (1 − tax) + D&A − capex − ΔNWC. Penalise answers that discount net income or revenue.",
        discount_rate:
          "Expects WACC assembled from CAPM cost of equity and after-tax cost of debt, weighted by capital structure. Credit stating the equity risk premium and beta used.",
        terminal_value:
          "Gompertz or exit-multiple both acceptable, but the perpetuity growth rate must be below long-run GDP growth, and the answer should note what share of value sits in the terminal value.",
        sensitivity_analysis:
          "Looks for a WACC × growth grid or equivalent, and an honest statement of how wide the resulting range is.",
        recommendation:
          "Must land on a value or range and say whether the asking price is attractive.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const nwcPct = rng.int(2, 5);
      const c = currency(company);
      const revenue = rng.int(200, 900);
      const ebitMargin = rng.int(12, 26);
      const growth = rng.int(6, 18);
      const taxRate = rng.int(22, 30);
      const capexPct = rng.int(4, 9);
      const daPct = rng.int(3, 7);
      const beta = rng.float(0.9, 1.6, 2);
      const riskFree = rng.float(3.0, 7.0, 1);
      const erp = rng.float(4.5, 7.0, 1);
      const debtCost = rng.float(6.0, 11.0, 1);
      const debtWeight = rng.int(20, 45);
      const askingPrice = rng.int(1200, 4500);

      return {
        title: `Valuing ${company.name}: A Five-Year DCF`,
        scenario: `A private equity client is considering acquiring **${company.name}**, a ${company.sector} business in ${company.geo}. You have been asked to build the valuation case.

The company generated **${c.symbol}${revenue} ${c.big}** of revenue last year at an EBIT margin of **${ebitMargin}%**. Management projects revenue growth of **${growth}% per year for five years**, after which the business is expected to settle into mature, GDP-like growth.

Capital expenditure runs at **${capexPct}% of revenue** and depreciation & amortisation at **${daPct}%**. Changes in net working capital consume roughly **${nwcPct}% of incremental revenue**. The effective tax rate is **${taxRate}%**.

The company's equity beta is **${beta}**, the risk-free rate is **${riskFree}%**, and the equity risk premium is **${erp}%**. Debt carries a pre-tax cost of **${debtCost}%** and makes up **${debtWeight}%** of the capital structure.

The seller is asking **${c.symbol}${askingPrice} ${c.big}** for the enterprise.`,
        instructions: `Value the business and advise on the asking price. Provide:

1. **Analysis** — a five-year free cash flow projection, your WACC, and a terminal value.
2. **Risks** — the assumptions your valuation is most sensitive to.
3. **Recommendation** — is ${c.symbol}${askingPrice} ${c.big} attractive? What would you pay?

Show your calculations. State assumptions explicitly where the case is silent.`,
        supportingData: {
          operating: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            ebit_margin_pct: ebitMargin,
            revenue_growth_pct: growth,
            capex_pct_of_revenue: capexPct,
            da_pct_of_revenue: daPct,
            nwc_pct_of_incremental_revenue: nwcPct,
            tax_rate_pct: taxRate,
          },
          capital_structure: {
            equity_beta: beta,
            risk_free_rate_pct: riskFree,
            equity_risk_premium_pct: erp,
            pre_tax_cost_of_debt_pct: debtCost,
            debt_weight_pct: debtWeight,
          },
          transaction: {
            [`asking_enterprise_value_${c.big.toLowerCase()}`]: askingPrice,
          },
        },
        expectedFramework: `1. **Free cash flow** for each of years 1-5:
   FCF = EBIT × (1 − t) + D&A − capex − ΔNWC

2. **WACC**:
   - Cost of equity = ${riskFree}% + ${beta} × ${erp}% = ${(riskFree + beta * erp).toFixed(2)}%
   - After-tax cost of debt = ${debtCost}% × (1 − ${taxRate}%) = ${(debtCost * (1 - taxRate / 100)).toFixed(2)}%
   - WACC = ${100 - debtWeight}% × cost of equity + ${debtWeight}% × after-tax cost of debt

3. **Terminal value** at year 5, using either perpetuity growth (g below long-run GDP) or an exit EBITDA multiple. Sanity-check one against the other.

4. **Discount** everything to today, sum, and compare with the asking price.

5. **Sensitivity** across WACC and terminal growth.`,
        modelAnswer: `**WACC.** Cost of equity via CAPM is ${riskFree}% + ${beta} × ${erp}% = **${(riskFree + beta * erp).toFixed(2)}%**. After-tax cost of debt is ${debtCost}% × (1 − ${taxRate / 100}) = **${(debtCost * (1 - taxRate / 100)).toFixed(2)}%**. Weighting these ${100 - debtWeight}/${debtWeight} gives a WACC of approximately **${((1 - debtWeight / 100) * (riskFree + beta * erp) + (debtWeight / 100) * debtCost * (1 - taxRate / 100)).toFixed(2)}%**.

**Free cash flow.** Year 1 revenue is ${c.symbol}${(revenue * (1 + growth / 100)).toFixed(0)} ${c.big}. EBIT at ${ebitMargin}% is ${c.symbol}${(revenue * (1 + growth / 100) * (ebitMargin / 100)).toFixed(0)} ${c.big}; taxed at ${taxRate}% that is ${c.symbol}${(revenue * (1 + growth / 100) * (ebitMargin / 100) * (1 - taxRate / 100)).toFixed(0)} ${c.big} of NOPAT. Adding back D&A (${daPct}% of revenue) and subtracting capex (${capexPct}% of revenue) leaves a net drag of ${(capexPct - daPct).toFixed(0)}% of revenue, before working capital. Repeat for years 2-5 at ${growth}% growth.

Note the structural point: because capex exceeds D&A by ${(capexPct - daPct).toFixed(0)} percentage points of revenue, faster growth *reduces* near-term free cash flow. Growth is not free here.

**Terminal value.** With perpetuity growth of 3% (below long-run GDP, which is the discipline that matters), TV = FCF₅ × 1.03 ÷ (WACC − 3%). At these rates the terminal value will represent roughly 65-75% of total enterprise value — which is the honest headline of this valuation: it is mostly a bet on the terminal assumption, not on the five-year plan.

**Sensitivity.** Flex WACC ±1pp and terminal growth ±1pp. That grid will typically swing enterprise value by ±30-40%. Any single-point valuation presented without this range is overconfident.

**Recommendation.** ${company.name} is worth a *range*, not a number. Compare the midpoint against the ${c.symbol}${askingPrice} ${c.big} ask: if the ask sits above the high end of the grid, walk away or restructure toward an earn-out that shifts terminal-value risk back to the seller. Given how much value sits beyond year five, I would anchor the offer on the exit-multiple cross-check rather than the perpetuity method, and insist on a sensitivity-driven range in the investment committee paper.`,
      };
    },
  },

  // ----------------------------------------------------------- NPV / IRR ---
  {
    id: "npv-irr-project",
    categorySlug: "npv-irr",
    domain: "finance",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["npv", "irr", "capital-budgeting", "payback"],
    rubric: {
      criteria: {
        financial_analysis: 30,
        assumptions: 20,
        risk_assessment: 20,
        recommendation: 30,
      },
      descriptors: {
        financial_analysis:
          "NPV must be computed with the correct discount rate and sign convention. Credit IRR and payback as supporting metrics, and penalise ranking projects on IRR alone when scale differs.",
        assumptions:
          "Should state assumptions about the discount rate, project life, and terminal/salvage value, and flag that sunk costs are irrelevant.",
        risk_assessment:
          "Expects a break-even or sensitivity view: what has to be true for NPV to go negative.",
        recommendation:
          "A go/no-go under capital rationing, with a clear ranking rule.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const investA = rng.int(40, 120);
      const cashA = rng.int(12, 40);
      const lifeA = rng.int(5, 9);
      const investB = rng.int(150, 400);
      const cashB = rng.int(40, 110);
      const lifeB = rng.int(6, 12);
      const hurdle = rng.int(10, 16);
      const budget = Math.round((investA + investB) * 0.6);
      const sunk = rng.int(5, 20);

      return {
        title: `${company.name}: Two Projects, One Budget`,
        scenario: `${company.name}, a ${company.sector} company in ${company.geo}, has two capital projects competing for approval and only **${c.symbol}${budget} ${c.big}** of approved capital this year.

**Project A — Automation upgrade.** Requires **${c.symbol}${investA} ${c.big}** upfront and is expected to generate **${c.symbol}${cashA} ${c.big}** of incremental after-tax cash flow per year for **${lifeA} years**.

**Project B — New production line.** Requires **${c.symbol}${investB} ${c.big}** upfront and is expected to generate **${c.symbol}${cashB} ${c.big}** per year for **${lifeB} years**.

The company's hurdle rate is **${hurdle}%**.

Two complications. First, the finance team has already spent **${c.symbol}${sunk} ${c.big}** on engineering studies for Project B, and the COO argues this money "shouldn't be wasted". Second, Project B's cash flows depend on a customer contract that is signed but renews annually.`,
        instructions: `Recommend how to allocate the capital budget. Provide:

1. **Analysis** — NPV, IRR and payback for each project.
2. **Risks** — including how you treat the engineering spend and the contract renewal risk.
3. **Recommendation** — which project (or projects) to fund.`,
        supportingData: {
          project_a: {
            [`investment_${c.big.toLowerCase()}`]: investA,
            [`annual_cash_flow_${c.big.toLowerCase()}`]: cashA,
            life_years: lifeA,
          },
          project_b: {
            [`investment_${c.big.toLowerCase()}`]: investB,
            [`annual_cash_flow_${c.big.toLowerCase()}`]: cashB,
            life_years: lifeB,
          },
          constraints: {
            hurdle_rate_pct: hurdle,
            [`capital_budget_${c.big.toLowerCase()}`]: budget,
            [`already_spent_on_b_studies_${c.big.toLowerCase()}`]: sunk,
          },
        },
        expectedFramework: `1. **NPV** of each project using the annuity form: NPV = CF × [(1 − (1+r)^−n) ÷ r] − I₀
2. **IRR** — the rate at which NPV = 0. Note that IRR alone misranks projects of different scale.
3. **Payback** as a liquidity check, not a decision rule.
4. **Sunk cost** — the ${c.symbol}${sunk} ${c.big} is spent and irrecoverable. It must not enter the decision.
5. **Profitability index** (NPV ÷ investment) when capital is rationed.
6. **Risk-adjust** Project B for the annual renewal.`,
        modelAnswer: `**Project A.** The annuity factor at ${hurdle}% over ${lifeA} years is ${((1 - Math.pow(1 + hurdle / 100, -lifeA)) / (hurdle / 100)).toFixed(2)}. NPV = ${c.symbol}${cashA} ${c.big} × ${((1 - Math.pow(1 + hurdle / 100, -lifeA)) / (hurdle / 100)).toFixed(2)} − ${c.symbol}${investA} ${c.big} = **${c.symbol}${(cashA * ((1 - Math.pow(1 + hurdle / 100, -lifeA)) / (hurdle / 100)) - investA).toFixed(1)} ${c.big}**. Simple payback is ${(investA / cashA).toFixed(1)} years.

**Project B.** The annuity factor over ${lifeB} years is ${((1 - Math.pow(1 + hurdle / 100, -lifeB)) / (hurdle / 100)).toFixed(2)}. NPV = ${c.symbol}${cashB} ${c.big} × ${((1 - Math.pow(1 + hurdle / 100, -lifeB)) / (hurdle / 100)).toFixed(2)} − ${c.symbol}${investB} ${c.big} = **${c.symbol}${(cashB * ((1 - Math.pow(1 + hurdle / 100, -lifeB)) / (hurdle / 100)) - investB).toFixed(1)} ${c.big}**. Payback is ${(investB / cashB).toFixed(1)} years.

**The sunk cost.** The ${c.symbol}${sunk} ${c.big} already spent on studies is irrelevant. It is gone whether or not the project proceeds. The COO's argument is the sunk cost fallacy in its textbook form, and accepting it would mean letting past spending justify future spending — exactly backwards. The only forward-looking question is whether ${c.symbol}${investB} ${c.big} of *new* capital earns above ${hurdle}%.

**Capital rationing.** With only ${c.symbol}${budget} ${c.big} available, ${investA + investB > budget ? "both projects cannot be funded." : "both fit within the budget."} Under rationing the right rule is the profitability index (NPV per unit of capital), not raw NPV and certainly not IRR — IRR systematically favours the smaller project regardless of how much value the larger one creates.

Project A's PI is ${((cashA * ((1 - Math.pow(1 + hurdle / 100, -lifeA)) / (hurdle / 100)) - investA) / investA).toFixed(2)}; Project B's is ${((cashB * ((1 - Math.pow(1 + hurdle / 100, -lifeB)) / (hurdle / 100)) - investB) / investB).toFixed(2)}.

**Risk.** Project B's cash flows rest on an annually renewing contract. Renewal risk should be handled by raising B's discount rate or by probability-weighting the later years, not by ignoring it. A single non-renewal in year 2 or 3 removes most of B's NPV.

**Recommendation.** Fund the project with the higher risk-adjusted profitability index, and fund it fully rather than part-funding both. Before committing to B, I would make approval conditional on converting the annual contract into a multi-year commitment — that single change is worth more to B's NPV than any operational improvement in the plan.`,
      };
    },
  },

  // -------------------------------------------------------------- M&A ------
  {
    id: "ma-accretion",
    categorySlug: "mergers-acquisitions",
    domain: "finance",
    difficulty: "hard",
    estimatedMinutes: 55,
    tags: ["m&a", "accretion-dilution", "synergies", "deal-structure"],
    rubric: {
      criteria: {
        deal_analysis: 25,
        synergy_assessment: 25,
        risk_assessment: 25,
        recommendation: 25,
      },
      descriptors: {
        deal_analysis:
          "Expects combined EPS worked through: acquirer earnings + target earnings + after-tax synergies − after-tax financing cost, over the new share count. Accretion/dilution must be computed, not asserted.",
        synergy_assessment:
          "Should separate cost synergies (credible, controllable) from revenue synergies (usually optimistic), and note integration cost and phasing.",
        risk_assessment:
          "Looks for integration risk, customer overlap, culture, financing risk if rates move, and the consequences of synergies arriving late.",
        recommendation:
          "A clear position on price, structure (cash vs stock) and walk-away conditions.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const acquirerEarnings = rng.int(80, 250);
      const acquirerShares = rng.int(50, 150);
      const acquirerPrice = rng.int(40, 120);
      const targetEarnings = rng.int(20, 70);
      const targetPrice = rng.int(400, 1200);
      const premium = rng.int(20, 45);
      const synergies = rng.int(15, 60);
      const integrationCost = rng.int(20, 80);
      const debtRate = rng.float(6, 10, 1);
      const taxRate = 25;
      const acquirerEps = (acquirerEarnings / acquirerShares).toFixed(2);

      return {
        title: `${company.name} Acquires a Rival: Accretive or Not?`,
        scenario: `${company.name} (${company.sector}, ${company.geo}) is considering acquiring a smaller competitor.

**Acquirer.** Net income of **${c.symbol}${acquirerEarnings} ${c.big}**, **${acquirerShares} ${c.big === "Cr" ? "crore" : "million"} shares** outstanding, trading at **${c.symbol}${acquirerPrice}** per share. Current EPS is therefore **${c.symbol}${acquirerEps}**.

**Target.** Net income of **${c.symbol}${targetEarnings} ${c.big}**, currently valued by the market at **${c.symbol}${targetPrice} ${c.big}**. The board expects to pay a **${premium}% premium** to that price.

Management projects **${c.symbol}${synergies} ${c.big}** of annual run-rate synergies, roughly ${rng.int(55, 80)}% of which are cost synergies from overlapping sales and back-office functions, with the remainder from cross-selling. One-time integration costs are estimated at **${c.symbol}${integrationCost} ${c.big}**.

The deal would be financed with debt at **${debtRate}%**. The marginal tax rate is ${taxRate}%.`,
        instructions: `Advise the board on whether to proceed. Provide:

1. **Analysis** — accretion/dilution to EPS in year one and at full synergy run-rate.
2. **Risks** — what would make this deal destroy value.
3. **Recommendation** — proceed, renegotiate, or walk. Specify price and structure.`,
        supportingData: {
          acquirer: {
            [`net_income_${c.big.toLowerCase()}`]: acquirerEarnings,
            shares_outstanding: acquirerShares,
            share_price: acquirerPrice,
            eps: Number(acquirerEps),
          },
          target: {
            [`net_income_${c.big.toLowerCase()}`]: targetEarnings,
            [`market_value_${c.big.toLowerCase()}`]: targetPrice,
            premium_pct: premium,
          },
          deal: {
            [`run_rate_synergies_${c.big.toLowerCase()}`]: synergies,
            [`integration_cost_${c.big.toLowerCase()}`]: integrationCost,
            debt_rate_pct: debtRate,
            tax_rate_pct: taxRate,
          },
        },
        expectedFramework: `1. **Purchase price** = market value × (1 + premium).
2. **Financing cost** = purchase price × debt rate, then after tax.
3. **Combined earnings** = acquirer + target + after-tax synergies − after-tax interest.
4. **Combined EPS** = combined earnings ÷ share count (unchanged in an all-cash deal).
5. **Compare** against standalone EPS. Do this for year 1 (partial synergies, integration costs) and steady state.
6. **Sanity check** the price against the target's standalone value.`,
        modelAnswer: `**Purchase price.** ${c.symbol}${targetPrice} ${c.big} × ${(1 + premium / 100).toFixed(2)} = **${c.symbol}${(targetPrice * (1 + premium / 100)).toFixed(0)} ${c.big}**.

**Financing.** At ${debtRate}%, annual interest is ${c.symbol}${(targetPrice * (1 + premium / 100) * (debtRate / 100)).toFixed(1)} ${c.big}, or ${c.symbol}${(targetPrice * (1 + premium / 100) * (debtRate / 100) * (1 - taxRate / 100)).toFixed(1)} ${c.big} after tax.

**Steady-state EPS.** Combined earnings = ${acquirerEarnings} + ${targetEarnings} + ${(synergies * (1 - taxRate / 100)).toFixed(1)} (after-tax synergies) − ${(targetPrice * (1 + premium / 100) * (debtRate / 100) * (1 - taxRate / 100)).toFixed(1)} (after-tax interest) = **${c.symbol}${(acquirerEarnings + targetEarnings + synergies * (1 - taxRate / 100) - targetPrice * (1 + premium / 100) * (debtRate / 100) * (1 - taxRate / 100)).toFixed(1)} ${c.big}**.

Share count is unchanged in an all-cash deal, so EPS = ${(( acquirerEarnings + targetEarnings + synergies * (1 - taxRate / 100) - targetPrice * (1 + premium / 100) * (debtRate / 100) * (1 - taxRate / 100)) / acquirerShares).toFixed(2)} versus ${acquirerEps} standalone. That is **${((acquirerEarnings + targetEarnings + synergies * (1 - taxRate / 100) - targetPrice * (1 + premium / 100) * (debtRate / 100) * (1 - taxRate / 100)) / acquirerShares > Number(acquirerEps) ? "accretive" : "dilutive")}**.

**The load-bearing assumption.** Strip the synergies out and the deal is ${acquirerEarnings + targetEarnings - targetPrice * (1 + premium / 100) * (debtRate / 100) * (1 - taxRate / 100) > acquirerEarnings ? "still marginally accretive" : "clearly dilutive"}. In other words, the entire case rests on delivering ${c.symbol}${synergies} ${c.big} of synergies. Year one will be worse than steady state: synergies phase in over 18-24 months while the ${c.symbol}${integrationCost} ${c.big} of integration costs land immediately.

**Risks.** Cost synergies from overlapping back-office functions are the credible portion and are within management's control. The cross-selling component is the part that routinely fails to appear — it depends on customers behaving as the model assumes. I would haircut revenue synergies by at least half in the base case. Beyond that: integration distraction during the transition, key-person attrition at the target, and the fact that floating-rate debt makes accretion sensitive to rates moving against you.

**Recommendation.** Accretion here is thin and synergy-dependent, so the discipline has to come from price and structure rather than optimism. I would cap the premium below ${premium}% — every point of premium is paid with certainty while every point of synergy is a forecast — and push for part-stock consideration so the seller shares integration risk. Walk away if the cost-synergy diligence cannot substantiate at least ${Math.round(synergies * 0.6)} ${c.big} of the ${c.symbol}${synergies} ${c.big} from headcount and facilities overlap alone.`,
      };
    },
  },

  // ----------------------------------------------- financial statements ----
  {
    id: "statement-diagnosis",
    categorySlug: "financial-statements",
    domain: "finance",
    difficulty: "easy",
    estimatedMinutes: 30,
    tags: ["three-statements", "working-capital", "cash-conversion"],
    rubric: {
      criteria: {
        financial_analysis: 30,
        diagnosis: 30,
        risk_assessment: 15,
        recommendation: 25,
      },
      descriptors: {
        financial_analysis:
          "Expects the working capital cycle computed: DSO + DIO − DPO. Credit linking the income statement to the cash flow statement.",
        diagnosis:
          "The core insight is that a profitable company can run out of cash. The answer should identify where cash is trapped.",
        risk_assessment: "Covenant risk, supplier relationships, seasonality.",
        recommendation:
          "Specific levers with an estimate of the cash they release.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const revenueGrowth = rng.int(15, 35);
      const c = currency(company);
      const revenue = rng.int(100, 400);
      const grossMargin = rng.int(25, 45);
      const netMargin = rng.int(4, 12);
      const dso = rng.int(55, 110);
      const dio = rng.int(45, 120);
      const dpo = rng.int(25, 55);
      const cash = rng.int(3, 15);
      const overdraft = rng.int(30, 90);
      const ccc = dso + dio - dpo;

      return {
        title: `${company.name} Is Profitable and Nearly Out of Cash`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo}. Last year it reported **${c.symbol}${revenue} ${c.big}** of revenue, a gross margin of **${grossMargin}%**, and a net profit margin of **${netMargin}%** — its third consecutive profitable year.

The CEO is baffled. The company has **${c.symbol}${cash} ${c.big}** in the bank, has drawn **${c.symbol}${overdraft} ${c.big}** of its overdraft facility, and has twice delayed supplier payments this quarter.

Balance sheet metrics:
- Days sales outstanding: **${dso} days**
- Days inventory outstanding: **${dio} days**
- Days payables outstanding: **${dpo} days**

Revenue grew ${revenueGrowth}% last year, and the sales team is targeting similar growth again.`,
        instructions: `Explain to the CEO what is happening and what to do about it. Provide:

1. **Analysis** — why a profitable company is short of cash.
2. **Risks** — what happens if nothing changes.
3. **Recommendation** — the specific actions you would take, in priority order.`,
        supportingData: {
          income_statement: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            gross_margin_pct: grossMargin,
            net_margin_pct: netMargin,
            revenue_growth_pct: revenueGrowth,
          },
          working_capital: {
            days_sales_outstanding: dso,
            days_inventory_outstanding: dio,
            days_payables_outstanding: dpo,
            cash_conversion_cycle_days: ccc,
          },
          liquidity: {
            [`cash_${c.big.toLowerCase()}`]: cash,
            [`overdraft_drawn_${c.big.toLowerCase()}`]: overdraft,
          },
        },
        expectedFramework: `1. **Cash conversion cycle** = DSO + DIO − DPO = ${dso} + ${dio} − ${dpo} = **${ccc} days**.
2. **Cash tied up** ≈ (CCC ÷ 365) × revenue.
3. **Growth makes it worse** — every extra unit of revenue funds more receivables and inventory before it produces cash.
4. **Levers**, in order of speed: collections, inventory, payment terms.
5. **Quantify** the cash released by improving each lever.`,
        modelAnswer: `**The arithmetic.** The cash conversion cycle is ${dso} + ${dio} − ${dpo} = **${ccc} days**. At ${c.symbol}${revenue} ${c.big} of revenue, that ties up roughly ${c.symbol}${((ccc / 365) * revenue).toFixed(0)} ${c.big} in working capital — far more than the ${c.symbol}${(revenue * (netMargin / 100)).toFixed(0)} ${c.big} of profit the business earns in a year.

**Why profit and cash have diverged.** Profit is recognised when a sale is invoiced; cash arrives ${dso} days later, after inventory has already been paid for. The company waits ${ccc} days between paying out and being paid. Growth is not the cure here — it is the accelerant. Each additional ${c.symbol}1 ${c.big} of revenue consumes about ${c.symbol}${(ccc / 365).toFixed(2)} ${c.big} of extra working capital, so growing ${revenueGrowth}% again would absorb more cash than the business generates. This company is growing itself into insolvency.

**Risks.** The overdraft is being used to fund permanent working capital, which is a structural mismatch — short-term facilities funding a long-term need. Delayed supplier payments invite tightened terms, which would push DPO *down* and make the cycle worse in a self-reinforcing loop. Any covenant tied to the facility is the near-term cliff.

**Recommendation, in priority order.**

1. **Collections first** — it is the fastest lever and needs no counterparty concession. Cutting DSO from ${dso} to ${Math.round(dso * 0.75)} days releases roughly ${c.symbol}${(((dso - Math.round(dso * 0.75)) / 365) * revenue).toFixed(0)} ${c.big}. Tighten credit terms, invoice on dispatch rather than month-end, and put the worst payers on prepayment.
2. **Inventory second** — ${dio} days is the largest single component. A stock-keeping-unit review targeting the slowest-moving third typically recovers 15-25% of inventory value.
3. **Payables last, and carefully** — negotiate longer terms formally rather than simply paying late. Paying late destroys the supplier relationship you will need if the cycle tightens further.
4. **Cap growth** until the cycle is below ${Math.round(ccc * 0.7)} days. Telling a sales team to grow more slowly is unpopular, but taking on revenue this business cannot fund is the specific thing that would sink it.`,
      };
    },
  },

  // --------------------------------------------------- comps valuation -----
  {
    id: "comps-valuation",
    categorySlug: "valuation",
    domain: "finance",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["comparables", "multiples", "ev-ebitda"],
    rubric: {
      criteria: {
        peer_selection: 25,
        multiple_analysis: 25,
        adjustments: 20,
        recommendation: 30,
      },
      descriptors: {
        peer_selection:
          "Should justify which comparables are genuinely comparable on growth, margin and risk — not just industry label.",
        multiple_analysis:
          "Expects EV/EBITDA and EV/Revenue applied correctly, with the bridge from enterprise value to equity value (subtract net debt).",
        adjustments:
          "Credit adjustments for size, growth, margin differential, liquidity and control premium.",
        recommendation: "A defensible valuation range with a point of view.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const peerCMargin = rng.int(12, 20);
      const peerCGrowth = rng.int(-5, 3);
      const peerBMargin = rng.int(10, 20);
      const peerBGrowth = rng.int(20, 40);
      const peerAMargin = rng.int(18, 28);
      const peerAGrowth = rng.int(4, 12);
      const c = currency(company);
      const revenue = rng.int(150, 600);
      const ebitdaMargin = rng.int(14, 30);
      const growth = rng.int(5, 25);
      const netDebt = rng.int(40, 200);
      const peer1 = rng.float(7.5, 11.5, 1);
      const peer2 = rng.float(9.0, 14.0, 1);
      const peer3 = rng.float(6.0, 9.5, 1);
      const ebitda = Math.round(revenue * (ebitdaMargin / 100));

      return {
        title: `What Is ${company.name} Worth? A Comparables Analysis`,
        scenario: `${company.name} (${company.sector}, ${company.geo}) is preparing for a sale process. You have been asked to establish a valuation range using trading comparables.

**The company.** Revenue of **${c.symbol}${revenue} ${c.big}**, EBITDA margin of **${ebitdaMargin}%** (EBITDA of ${c.symbol}${ebitda} ${c.big}), revenue growth of **${growth}%**, and net debt of **${c.symbol}${netDebt} ${c.big}**.

**Trading comparables.**

| Peer | EV/EBITDA | Revenue growth | EBITDA margin |
|---|---|---|---|
| Peer A — same sector, 3× larger | ${peer1}× | ${peerAGrowth}% | ${peerAMargin}% |
| Peer B — adjacent sector, high growth | ${peer2}× | ${peerBGrowth}% | ${peerBMargin}% |
| Peer C — same sector, declining | ${peer3}× | ${peerCGrowth}% | ${peerCMargin}% |

The banker running the process has proposed simply averaging the three multiples.`,
        instructions: `Produce a valuation range. Provide:

1. **Analysis** — which comparables you would use and why, and the resulting enterprise and equity values.
2. **Risks** — where this methodology could mislead.
3. **Recommendation** — your valuation range and the number you would take to the seller.

Critique the banker's proposed approach.`,
        supportingData: {
          target: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            ebitda_margin_pct: ebitdaMargin,
            [`ebitda_${c.big.toLowerCase()}`]: ebitda,
            revenue_growth_pct: growth,
            [`net_debt_${c.big.toLowerCase()}`]: netDebt,
          },
          comparables: [
            { peer: "A", ev_ebitda: peer1, growth_pct: peerAGrowth, margin_pct: peerAMargin },
            { peer: "B", ev_ebitda: peer2, growth_pct: peerBGrowth, margin_pct: peerBMargin },
            { peer: "C", ev_ebitda: peer3, growth_pct: peerCGrowth, margin_pct: peerCMargin },
          ],
        },
        expectedFramework: `1. **Screen the peers** on growth, margin and risk — not sector label alone.
2. **Apply** the defensible multiple range to EBITDA to get enterprise value.
3. **Bridge** to equity value: EV − net debt.
4. **Adjust** for size, growth differential and marketability.
5. **Cross-check** with EV/Revenue.
6. **Present a range**, and say where in it you would settle.`,
        modelAnswer: `**The banker's approach is wrong.** Averaging ${peer1}×, ${peer2}× and ${peer3}× treats three structurally different businesses as interchangeable. Peer B trades at ${peer2}× because it grows at 20-40%; Peer C trades at ${peer3}× because it is shrinking. A simple mean smuggles both distortions into the answer and produces a number with no defensible logic behind it.

**Peer screening.** ${company.name} grows at ${growth}% with a ${ebitdaMargin}% margin. Peer A is the closest analogue on sector and margin, though larger. Peer B is only relevant if this company's growth is genuinely comparable — at ${growth}% it ${growth > 20 ? "arguably is" : "is not"}. Peer C sets the floor: it is what the market pays for this sector without growth.

**Valuation.** Anchoring on Peer A at ${peer1}× and sanity-checking against the others:
- At ${peer1}×: EV = ${c.symbol}${(ebitda * peer1).toFixed(0)} ${c.big}, equity = ${c.symbol}${(ebitda * peer1 - netDebt).toFixed(0)} ${c.big}
- At ${peer3}× (floor): EV = ${c.symbol}${(ebitda * peer3).toFixed(0)} ${c.big}, equity = ${c.symbol}${(ebitda * peer3 - netDebt).toFixed(0)} ${c.big}
- At ${peer2}× (ceiling): EV = ${c.symbol}${(ebitda * peer2).toFixed(0)} ${c.big}, equity = ${c.symbol}${(ebitda * peer2 - netDebt).toFixed(0)} ${c.big}

Note how much the net debt of ${c.symbol}${netDebt} ${c.big} matters: it moves equity value one-for-one, and it is the step most often skipped.

**Adjustments.** Apply a size discount against Peer A — smaller companies trade cheaper for liquidity and concentration reasons. In a control sale, offset this with a control premium, which typically runs 20-30%.

**Risks.** Trading comps price minority stakes in public companies on a given day; this is a control sale of a private one. Multiples also compress quickly when sentiment turns, so a range struck today has a shelf life. Three comparables is a thin sample — I would want precedent transactions as a cross-check before going to market.

**Recommendation.** A defensible range is **${c.symbol}${(ebitda * peer3 - netDebt).toFixed(0)}–${(ebitda * peer1 * 1.15 - netDebt).toFixed(0)} ${c.big}** of equity value. I would guide the seller to expect the middle of that band, and I would resist the temptation to lead with the Peer B multiple — anchoring the seller on a number the growth profile cannot support is how processes fail late and expensively.`,
      };
    },
  },
];
