import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Additional finance archetypes.
 *
 * The original six covered raising, valuing and choosing between projects. These
 * four cover the parts of a core finance syllabus that were missing: what
 * capital costs, where cash is trapped inside working capital, whether to own an
 * asset at all, and what to do with cash once you have it.
 *
 * Every scenario carries computable numbers, because a rubric that asks for
 * working can only be graded if the working exists.
 */
export const FINANCE_EXTENDED: Archetype[] = [
  // --------------------------------------------------------------- wacc ---
  {
    id: "wacc-hurdle",
    categorySlug: "capital-structure",
    domain: "finance",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["wacc", "cost of capital", "capital structure", "hurdle rate"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must compute WACC from the given weights, cost of equity (CAPM: rf + beta x ERP) and after-tax cost of debt. Credit answers that show the arithmetic rather than quoting a number.",
        market_analysis:
          "Looks for whether the beta and equity risk premium are appropriate for this sector and geography, and whether the capital structure is stable or drifting.",
        risk_assessment:
          "Should note that a single company-wide hurdle rate misprices projects of different risk, and identify what happens to WACC if leverage or rates move.",
        recommendation:
          "Must state a hurdle rate to use and whether the project clears it, with the sensitivity that would flip the answer.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const debtPct = rng.int(20, 55);
      const equityPct = 100 - debtPct;
      const riskFree = rng.float(5.5, 7.5, 1);
      const erp = rng.float(5.0, 8.0, 1);
      const beta = rng.float(0.8, 1.6, 2);
      const debtRate = rng.float(8.0, 12.5, 1);
      const taxPct = rng.int(22, 30);
      const projectReturn = rng.float(11.0, 18.0, 1);
      const projectSize = rng.int(40, 220);

      const costOfEquity = Number((riskFree + beta * erp).toFixed(2));
      const afterTaxDebt = Number((debtRate * (1 - taxPct / 100)).toFixed(2));
      const wacc = Number(
        ((equityPct / 100) * costOfEquity + (debtPct / 100) * afterTaxDebt).toFixed(2),
      );

      return {
        title: `${company.name}: What Should This Project Have to Beat?`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo}. The board is being asked to approve a **${c.symbol}${projectSize} ${c.big}** capacity expansion that the sponsoring team says will return **${projectReturn}%**.

The CFO has been using a flat 12% hurdle rate for every proposal for the last four years. A new board member has challenged that, pointing out the capital structure has shifted and rates have moved since it was set.

Current position: the company is funded **${debtPct}% debt and ${equityPct}% equity**. It borrows at **${debtRate}%** pre-tax and pays a **${taxPct}%** effective tax rate. The equity beta is **${beta}**, the risk-free rate is **${riskFree}%**, and the equity risk premium in this market is taken as **${erp}%**.

The project has roughly the same operating risk as the existing business.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — compute the cost of equity, the after-tax cost of debt, and the blended WACC. Show the arithmetic.
2. **Risks** — what the single-hurdle-rate approach gets wrong, and what would move your number.
3. **Recommendation** — the hurdle rate you would set and whether this project clears it.

State any assumptions you make.`,
        supportingData: {
          capital_structure: { debt_pct: debtPct, equity_pct: equityPct },
          cost_inputs: {
            risk_free_rate_pct: riskFree,
            equity_risk_premium_pct: erp,
            equity_beta: beta,
            pre_tax_cost_of_debt_pct: debtRate,
            effective_tax_rate_pct: taxPct,
          },
          proposal: {
            [`size_${c.big.toLowerCase()}`]: projectSize,
            claimed_return_pct: projectReturn,
            legacy_hurdle_rate_pct: 12,
          },
          derived_hints: {
            cost_of_equity_pct: costOfEquity,
            after_tax_cost_of_debt_pct: afterTaxDebt,
            wacc_pct: wacc,
          },
        },
        expectedFramework:
          "CAPM for cost of equity, after-tax cost of debt, weight by capital structure, compare project return to WACC, then sensitise.",
        modelAnswer: `Cost of equity = ${riskFree}% + ${beta} x ${erp}% = ${costOfEquity}%. After-tax debt = ${debtRate}% x (1 - ${taxPct}%) = ${afterTaxDebt}%. WACC = ${equityPct}% x ${costOfEquity}% + ${debtPct}% x ${afterTaxDebt}% = **${wacc}%**.

The project returns ${projectReturn}%, so it ${projectReturn > wacc ? "clears" : "does not clear"} the true cost of capital — against the legacy 12% hurdle it would have been ${projectReturn > 12 ? "approved" : "rejected"}, which is ${projectReturn > wacc === projectReturn > 12 ? "the same answer for the wrong reason" : "the opposite of the right answer"}.

The deeper problem is using one rate everywhere: a project riskier than the core business should face a higher hurdle, and a safer one a lower hurdle. Recommend setting the corporate WACC at ${wacc}% and adding a risk premium by project category. Revisit if leverage moves more than 10 points or the risk-free rate moves more than 100bps.`,
      };
    },
  },

  // ----------------------------------------------------- working capital ---
  {
    id: "working-capital",
    categorySlug: "working-capital",
    domain: "finance",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["working capital", "cash conversion cycle", "dso", "liquidity"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must compute the cash conversion cycle (DSO + DIO - DPO) and the cash released by a stated improvement. Credit answers that convert days into currency rather than stopping at days.",
        market_analysis:
          "Looks for comparison against sector norms — a distributor and a SaaS business have completely different working capital shapes — and whether customers or suppliers hold the power.",
        risk_assessment:
          "Should identify that squeezing suppliers or tightening credit terms has commercial consequences: lost customers, worse input prices, or supplier failure.",
        recommendation:
          "Must pick which lever to pull first with a quantified cash impact, and say what would be given up.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(200, 900);
      const cogsPct = rng.int(55, 75);
      const cogs = Math.round(revenue * (cogsPct / 100));
      const dso = rng.int(48, 95);
      const dio = rng.int(40, 110);
      const dpo = rng.int(25, 60);
      const ccc = dso + dio - dpo;
      const dailyRevenue = Number((revenue / 365).toFixed(2));
      const targetDsoCut = rng.int(10, 25);
      const cashReleased = Number((dailyRevenue * targetDsoCut).toFixed(1));

      return {
        title: `${company.name} Is Profitable and Cash Is Still Tight`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo}. Last year it turned over **${c.symbol}${revenue} ${c.big}** at a ${100 - cogsPct}% gross margin and reported a profit — yet it drew on its overdraft in seven months out of twelve.

The treasurer has pulled the working capital numbers: receivables run at **${dso} days**, inventory at **${dio} days**, and the company pays its own suppliers in **${dpo} days**.

Sales insist the long payment terms are what win contracts in this market. Procurement say the inventory is a deliberate buffer after a supply disruption two years ago. The bank has asked for a plan before renewing the facility.`,
        instructions: `Advise the CFO. Your answer should provide:

1. **Analysis** — compute the cash conversion cycle and how much cash is tied up. Convert days into money.
2. **Risks** — what breaks commercially if you pull each lever.
3. **Recommendation** — which lever first, how much cash it frees, and what it costs you.

State any assumptions you make.`,
        supportingData: {
          financials: {
            [`revenue_${c.big.toLowerCase()}`]: revenue,
            [`cogs_${c.big.toLowerCase()}`]: cogs,
            gross_margin_pct: 100 - cogsPct,
          },
          working_capital_days: {
            days_sales_outstanding: dso,
            days_inventory_outstanding: dio,
            days_payables_outstanding: dpo,
          },
          derived_hints: {
            cash_conversion_cycle_days: ccc,
            [`revenue_per_day_${c.big.toLowerCase()}`]: dailyRevenue,
            [`cash_released_per_${targetDsoCut}_dso_days_${c.big.toLowerCase()}`]:
              cashReleased,
          },
        },
        expectedFramework:
          "Cash conversion cycle = DSO + DIO - DPO. Translate days into currency at revenue or COGS per day, then rank levers by cash freed against commercial cost.",
        modelAnswer: `CCC = ${dso} + ${dio} - ${dpo} = **${ccc} days**. At ${c.symbol}${dailyRevenue} ${c.big} of revenue per day, each day of DSO is roughly ${c.symbol}${dailyRevenue} ${c.big} of cash. Cutting DSO by ${targetDsoCut} days frees about **${c.symbol}${cashReleased} ${c.big}**.

Profit and cash diverge here because growth funds itself out of the balance sheet: every new contract adds ${dso} days of receivable before it adds cash.

Rank the levers by cash-per-unit-of-pain. Receivables usually come first because the cost is collections effort rather than margin — tighten terms on the tail of small accounts, not the strategic ones. Inventory is second and slower: the ${dio}-day buffer is insurance bought after a real disruption, so cutting it is a risk decision, not a finance one. Stretching payables to ${dpo + 15} days is the fastest on paper and the most dangerous, since suppliers price it back in.`,
      };
    },
  },

  // ------------------------------------------------------- lease vs buy ---
  {
    id: "lease-vs-buy",
    categorySlug: "capital-structure",
    domain: "finance",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["lease", "capex", "npv", "asset financing"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must discount both cash flow streams and compare on a like-for-like present value basis, including the tax shield and any residual value.",
        market_analysis:
          "Looks for whether the asset is core, how fast it obsoletes, and whether a second-hand market exists for it.",
        risk_assessment:
          "Should cover obsolescence, utilisation risk, covenant and balance-sheet treatment, and what happens if volumes fall.",
        recommendation:
          "Must commit to lease or buy with the present-value gap stated, and the utilisation level at which the answer flips.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const purchase = rng.int(20, 90);
      const years = rng.int(4, 8);
      const leaseAnnual = Number(((purchase / years) * rng.float(1.15, 1.4, 2)).toFixed(1));
      const residualPct = rng.int(10, 35);
      const residual = Number(((purchase * residualPct) / 100).toFixed(1));
      const discount = rng.float(9, 14, 1);
      const taxPct = rng.int(22, 30);
      const utilisation = rng.int(55, 92);

      return {
        title: `${company.name}: Own the Fleet or Rent It?`,
        scenario: `${company.name} operates in ${company.sector} across ${company.geo}. It needs additional equipment for the next **${years} years** and has two offers on the table.

**Buy**: **${c.symbol}${purchase} ${c.big}** up front, depreciated straight-line over ${years} years, with an expected resale value of about **${residualPct}%** of cost at the end.

**Lease**: **${c.symbol}${leaseAnnual} ${c.big} per year** for ${years} years, fully deductible, with the lessor carrying maintenance and taking the asset back at the end.

The company's discount rate is **${discount}%** and its effective tax rate is **${taxPct}%**. Current utilisation of the existing equivalent fleet runs at **${utilisation}%**, and the operations director expects demand in this segment to be lumpy.`,
        instructions: `Advise the CFO. Your answer should provide:

1. **Analysis** — the present value of each option, on a comparable after-tax basis.
2. **Risks** — utilisation, obsolescence, and what the balance sheet treatment changes.
3. **Recommendation** — lease or buy, with the number, and the condition that would reverse it.

State any assumptions you make.`,
        supportingData: {
          buy_option: {
            [`purchase_price_${c.big.toLowerCase()}`]: purchase,
            depreciation_years: years,
            residual_value_pct: residualPct,
            [`residual_value_${c.big.toLowerCase()}`]: residual,
          },
          lease_option: {
            [`annual_payment_${c.big.toLowerCase()}`]: leaseAnnual,
            term_years: years,
            maintenance_included: true,
          },
          assumptions: {
            discount_rate_pct: discount,
            effective_tax_rate_pct: taxPct,
            current_fleet_utilisation_pct: utilisation,
          },
        },
        expectedFramework:
          "Discount both after-tax cash flow streams over the same horizon, include depreciation tax shield and residual on the buy side, then test against utilisation.",
        modelAnswer: `Compare present values, not headline totals. Buying costs ${c.symbol}${purchase} ${c.big} today, returns a depreciation tax shield of roughly ${c.symbol}${((purchase / years) * (taxPct / 100)).toFixed(1)} ${c.big} a year, and returns ${c.symbol}${residual} ${c.big} of residual in year ${years} — which is worth materially less discounted at ${discount}%.

Leasing costs ${c.symbol}${leaseAnnual} ${c.big} a year after-tax-deductible, so the annual bite is about ${c.symbol}${(leaseAnnual * (1 - taxPct / 100)).toFixed(1)} ${c.big}, with no residual and no maintenance exposure.

The decision usually turns on utilisation rather than the discount rate. At ${utilisation}% and lumpy demand, the lease buys optionality: you stop paying when you hand it back. Buying wins when utilisation is high and stable, because you keep the residual and stop paying the lessor's margin. State the utilisation break-even and recommend against the shape of demand, not the shape of the spreadsheet.`,
      };
    },
  },

  // ----------------------------------------------------- capital return ---
  {
    id: "capital-return",
    categorySlug: "capital-structure",
    domain: "finance",
    difficulty: "hard",
    estimatedMinutes: 40,
    tags: ["dividend", "buyback", "capital allocation", "shareholder return"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 20,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must compare the returns available from reinvestment against the cost of capital, and quantify what each use of cash does to EPS and to the balance sheet.",
        market_analysis:
          "Looks for the signalling consequences of each choice, the shareholder register's preferences, and whether the shares look cheap on the stated multiple.",
        risk_assessment:
          "Should cover the irreversibility of a dividend commitment, buying back overvalued stock, and holding cash through a downturn.",
        recommendation:
          "Must allocate the cash with specific amounts across uses, and say what would change it.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const cash = rng.int(150, 600);
      const operatingCash = rng.int(80, 250);
      const roic = rng.float(9, 22, 1);
      const wacc = rng.float(10, 14, 1);
      const peRatio = rng.int(9, 26);
      const capexBacklogPct = rng.int(20, 60);
      const capexBacklog = Math.round((cash * capexBacklogPct) / 100);

      return {
        title: `${company.name} Has More Cash Than Ideas`,
        scenario: `${company.name} is a mature ${company.sector} business in ${company.geo}. It holds **${c.symbol}${cash} ${c.big}** of net cash and generates a further **${c.symbol}${operatingCash} ${c.big}** a year from operations after maintenance capex.

Return on invested capital in the core business runs at **${roic}%** against a cost of capital of about **${wacc}%**. The growth team has a pipeline of expansion projects worth **${c.symbol}${capexBacklog} ${c.big}**, but the CFO privately rates only half of them as clearing the hurdle.

The shares trade at **${peRatio}x earnings**. The largest institutional shareholder has written to the board asking for "a coherent capital return policy". The company has never paid a dividend.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — what each use of the cash is worth: reinvest, dividend, buyback, or hold.
2. **Risks** — what each choice commits you to, and what it signals.
3. **Recommendation** — an allocation with amounts, and the trigger that would change it.

State any assumptions you make.`,
        supportingData: {
          position: {
            [`net_cash_${c.big.toLowerCase()}`]: cash,
            [`annual_operating_cash_flow_${c.big.toLowerCase()}`]: operatingCash,
            [`identified_growth_capex_${c.big.toLowerCase()}`]: capexBacklog,
          },
          returns: { roic_pct: roic, wacc_pct: wacc, spread_pct: Number((roic - wacc).toFixed(1)) },
          market: { price_earnings_ratio: peRatio, dividend_history: "none" },
        },
        expectedFramework:
          "Reinvest while incremental returns exceed WACC; return the rest. Choose the return mechanism on flexibility and valuation, not on preference.",
        modelAnswer: `The order is set by the spread. ROIC of ${roic}% against a ${wacc}% cost of capital is a ${(roic - wacc).toFixed(1)}-point spread, so reinvestment creates value **only for the projects that actually clear the hurdle** — and the CFO says that is half the pipeline, roughly ${c.symbol}${Math.round(capexBacklog / 2)} ${c.big}. Funding the other half destroys value however good the story is.

That leaves about ${c.symbol}${cash - Math.round(capexBacklog / 2)} ${c.big} plus ongoing cash flow. A dividend is a commitment the market punishes you for cutting; a buyback is discretionary and can be paused. At ${peRatio}x, the buyback is ${peRatio < 15 ? "accretive and the shares look cheap" : "harder to justify — you would be buying at a full multiple"}.

Recommend: fund the qualifying projects, initiate a modest progressive dividend sized to be sustainable through a downturn, and run a buyback with the remainder. Hold a cash floor of about a year of operating cash flow. Revisit if the spread narrows below two points.`,
      };
    },
  },
];
