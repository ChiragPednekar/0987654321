import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Strategy archetypes — corporate-level questions, as distinct from the
 * consulting casebook. These ask "where should this company play and why",
 * not "diagnose this P&L".
 */
export const STRATEGY_ARCHETYPES: Archetype[] = [
  // ------------------------------------------------------ portfolio ---
  {
    id: "portfolio-review",
    categorySlug: "portfolio-strategy",
    domain: "strategy",
    difficulty: "hard",
    estimatedMinutes: 50,
    tags: ["portfolio", "capital-allocation", "divestment"],
    rubric: {
      criteria: {
        portfolio_logic: 30,
        quantitative_analysis: 25,
        strategic_fit: 25,
        recommendation: 20,
      },
      descriptors: {
        portfolio_logic:
          "Expects each unit judged on both market attractiveness and the company's right to win, not growth alone. Penalise answers that keep whatever is growing fastest.",
        quantitative_analysis:
          "Must compute the capital tied up against the return each unit earns, and compare that to the cost of capital given.",
        strategic_fit:
          "Should test whether units share anything real — customers, channel, technology — rather than assuming a conglomerate discount away.",
        recommendation:
          "A clear keep/fix/exit call per unit, sequenced, with what would be done with freed capital.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const wacc = rng.int(10, 14);

      const units = [
        {
          name: "Core",
          revenue: rng.int(600, 1100),
          growth: rng.int(1, 5),
          margin: rng.int(14, 20),
          capital: rng.int(400, 700),
          share: rng.int(22, 34),
        },
        {
          name: "Adjacency",
          revenue: rng.int(150, 380),
          growth: rng.int(18, 34),
          margin: rng.int(2, 9),
          capital: rng.int(200, 420),
          share: rng.int(5, 11),
        },
        {
          name: "Legacy",
          revenue: rng.int(180, 340),
          growth: rng.int(-9, -2),
          margin: rng.int(6, 12),
          capital: rng.int(260, 460),
          share: rng.int(12, 20),
        },
      ];

      const rows = units
        .map(
          (u) =>
            `| ${u.name} | ${c.symbol}${u.revenue} ${c.big} | ${u.growth > 0 ? "+" : ""}${u.growth}% | ${u.margin}% | ${c.symbol}${u.capital} ${c.big} | ${u.share}% |`,
        )
        .join("\n");

      return {
        title: `${company.name}: Which Businesses Deserve the Next Rupee?`,
        scenario: `${company.name} is a ${company.sector} group operating in ${company.geo}. The board has asked for a portfolio review before setting next year's capital plan.

Three business units:

| Unit | Revenue | Growth | Operating margin | Capital employed | Market share |
|---|---|---|---|---|---|
${rows}

The group's weighted average cost of capital is **${wacc}%**.

The CEO is instinctively drawn to the Adjacency business — it is growing fastest and gets the most attention internally. The CFO points out that Legacy still throws off cash. A board member has asked, bluntly, whether the group should own all three at all.

There is capital for **one** major investment next year, or for none if the right answer is to return it.`,
        instructions: `Advise the board. Your answer should provide:

1. **Analysis** — assess each unit on the economics and on the group's right to win. Compute returns on capital employed rather than describing them.
2. **Risks** — what your recommendation depends on, and what would change it.
3. **Recommendation** — a keep, fix or exit call for each unit, and where the capital goes.

State any assumptions you make.`,
        supportingData: {
          wacc_pct: wacc,
          units: units.map((u) => ({
            unit: u.name,
            revenue: u.revenue,
            growth_pct: u.growth,
            operating_margin_pct: u.margin,
            capital_employed: u.capital,
            market_share_pct: u.share,
          })),
          derived_hints: {
            roce_pct: units.map((u) =>
              Number(
                (((u.revenue * (u.margin / 100)) / u.capital) * 100).toFixed(1),
              ),
            ),
          },
        },
        expectedFramework:
          "Attractiveness vs right-to-win per unit; ROCE vs WACC; shared capabilities test; capital allocation decision",
        modelAnswer: `A strong answer works through, in order:

1. **Return on capital by unit.** ROCE = operating profit ÷ capital employed. Core earns ${(((units[0].revenue * (units[0].margin / 100)) / units[0].capital) * 100).toFixed(1)}%, Adjacency ${(((units[1].revenue * (units[1].margin / 100)) / units[1].capital) * 100).toFixed(1)}%, Legacy ${(((units[2].revenue * (units[2].margin / 100)) / units[2].capital) * 100).toFixed(1)}%. Against a ${wacc}% WACC, that immediately shows which units create value and which destroy it.

2. **Growth is not the test.** The Adjacency unit grows at ${units[1].growth}% but earns ${(((units[1].revenue * (units[1].margin / 100)) / units[1].capital) * 100).toFixed(1)}% on ${c.symbol}${units[1].capital} ${c.big} of capital. Growth funded below the cost of capital destroys value faster the faster it grows. The question is whether margin improves with scale — and at ${units[1].share}% share, whether this company will ever be the one that wins.

3. **Legacy is a cash question, not a growth question.** Declining at ${units[2].growth}% but earning ${(((units[2].revenue * (units[2].margin / 100)) / units[2].capital) * 100).toFixed(1)}%, it may be worth more harvested than fixed. The test is whether the capital employed can be released.

4. **The right-to-win test.** Ownership is only justified if the units share something real — customers, channel, technology, procurement scale. If they do not, the group is a holding company and the board member's question is fair.

5. **Recommendation.** Fund Core if its ROCE exceeds WACC and share is defensible; put Adjacency on a milestone-gated budget with a defined kill criterion rather than an open-ended one; harvest or exit Legacy and release its capital. Say explicitly what the freed capital does — reinvestment or return to shareholders.

The weakest answers rank the units by growth rate. The strongest ones notice that the fastest-growing unit is the one consuming the most capital for the lowest return, and say so.`,
      };
    },
  },

  // ------------------------------------------------- competitive response ---
  {
    id: "competitive-response",
    categorySlug: "competitive-strategy",
    domain: "strategy",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["competition", "pricing", "differentiation"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        competitor_analysis: 25,
        quantitative_analysis: 25,
        recommendation: 25,
      },
      descriptors: {
        problem_structuring:
          "Expects the entrant's economics and intent separated from the incumbent's response options. Penalise a reflexive 'match the price'.",
        competitor_analysis:
          "Should reason about whether the entrant can sustain its pricing, not just that it is cheaper today.",
        quantitative_analysis:
          "Must compute the margin and volume consequence of matching versus holding, using the numbers given.",
        recommendation:
          "A specific response with the segments to defend and the ones to concede.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(300, 900);
      const margin = rng.int(18, 30);
      const share = rng.int(28, 45);
      const entrantDiscount = rng.int(15, 30);
      const shareLoss = rng.int(3, 9);
      const premiumMix = rng.int(25, 45);

      return {
        title: `${company.name} Faces a Discount Entrant`,
        scenario: `${company.name} is the share leader in ${company.sector} in ${company.geo}, with **${share}%** of the market, **${c.symbol}${revenue} ${c.big}** of revenue and a **${margin}%** operating margin.

A venture-backed entrant launched nine months ago at a price roughly **${entrantDiscount}% below** ${company.name}'s. It has taken about **${shareLoss} points** of share, concentrated in the price-sensitive segment. Its product is credibly good, though narrower in scope.

What is known:
- ${premiumMix}% of ${company.name}'s revenue comes from premium customers with switching costs and multi-year contracts
- The entrant has raised heavily and is understood to be operating at a loss
- ${company.name}'s sales team is asking for authority to discount to hold accounts

The board wants a considered answer, not a price war.`,
        instructions: `Recommend a competitive response. Your answer should provide:

1. **Analysis** — the entrant's position and economics, and what is actually at risk.
2. **Risks** — what could go wrong with your response, and what you would monitor.
3. **Recommendation** — a specific course of action, including what you would *not* defend.

State any assumptions you make.`,
        supportingData: {
          incumbent: {
            revenue: revenue,
            operating_margin_pct: margin,
            market_share_pct: share,
            premium_revenue_mix_pct: premiumMix,
          },
          entrant: {
            price_discount_pct: entrantDiscount,
            share_taken_points: shareLoss,
            profitable: false,
          },
          derived_hints: {
            margin_if_matched_pct: Math.max(0, margin - entrantDiscount),
            operating_profit: Number((revenue * (margin / 100)).toFixed(0)),
          },
        },
        expectedFramework:
          "Segment the base; entrant sustainability; match vs hold economics; targeted response",
        modelAnswer: `A strong answer works through, in order:

1. **What matching costs.** Cutting price ${entrantDiscount}% across the base takes margin from ${margin}% toward ${Math.max(0, margin - entrantDiscount)}% — on ${c.symbol}${revenue} ${c.big} of revenue that is roughly ${c.symbol}${(revenue * Math.min(margin, entrantDiscount) / 100).toFixed(0)} ${c.big} of operating profit surrendered to defend ${shareLoss} points of share. Compute this before discussing it.

2. **Segment the base.** ${premiumMix}% of revenue sits with customers who have switching costs and are not the ones leaving. Discounting to them is pure margin giveaway — you would be paying customers who were never going to switch.

3. **Can the entrant sustain it?** Loss-funded pricing is a function of the entrant's next raise, not of its cost position. If it has no structural cost advantage, its price is a marketing spend with a time limit. If it does, matching only delays the outcome.

4. **A targeted response beats a blanket one.** Options: a fighter tier or stripped-down SKU for the price-sensitive segment; value reinforcement and contract lengthening for the premium base; selective, contract-linked discounts rather than list-price cuts.

5. **Recommendation.** Hold list price, defend the premium base on value and contract terms, meet the entrant only where the segment is genuinely at risk, and concede the most price-sensitive tail deliberately. Monitor win rates by segment and the entrant's funding, not aggregate share.

The weakest answers match the discount across the board. The strongest ones state which customers they are willing to lose, and why that is the cheaper outcome.`,
      };
    },
  },

  // ----------------------------------------------------- transformation ---
  {
    id: "digital-transformation",
    categorySlug: "transformation",
    domain: "strategy",
    difficulty: "medium",
    estimatedMinutes: 45,
    tags: ["transformation", "digital", "change-management"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        business_case: 25,
        execution_risk: 25,
        recommendation: 25,
      },
      descriptors: {
        problem_structuring:
          "Expects the commercial problem separated from the technology. Penalise answers that lead with a platform choice.",
        business_case:
          "Must quantify the return using the numbers given, including the payback period.",
        execution_risk:
          "Should treat adoption and capability as the binding constraint, not budget.",
        recommendation:
          "A sequenced plan with a defined first phase and a measurable stopping point.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const revenue = rng.int(500, 1400);
      const investment = rng.int(60, 180);
      const savingsPct = rng.float(1.5, 4.5, 1);
      const years = rng.int(3, 5);
      const manualShare = rng.int(35, 70);
      const failureRate = rng.int(60, 75);

      const annualSaving = Number((revenue * (savingsPct / 100)).toFixed(0));
      const payback = Number((investment / annualSaving).toFixed(1));

      return {
        title: `${company.name}: A ${c.symbol}${investment} ${c.big} Transformation Case`,
        scenario: `${company.name} is a ${company.stage}-stage ${company.sector} business in ${company.geo} with **${c.symbol}${revenue} ${c.big}** of revenue.

The COO has proposed a **${c.symbol}${investment} ${c.big}** digital transformation over **${years} years**. Roughly **${manualShare}%** of core operational processes are still manual or spreadsheet-driven. The business case claims **${savingsPct}%** of revenue in annual run-rate savings once complete.

Complications the board is aware of:
- Two previous system implementations were abandoned mid-way
- Industry studies suggest **${failureRate}%** of transformations of this size miss their stated benefits
- The proposal assumes headcount reduction that no one has yet discussed with the affected teams
- The savings are back-loaded: almost none arrive before year ${Math.max(2, years - 2)}

The CEO wants to know whether to approve it, shrink it, or reject it.`,
        instructions: `Advise the CEO. Your answer should provide:

1. **Analysis** — the business case on the numbers, including payback.
2. **Risks** — what makes this fail, and how you would detect it early.
3. **Recommendation** — approve, resize, phase or reject, with a specific first step.

State any assumptions you make.`,
        supportingData: {
          financials: {
            revenue: revenue,
            investment: investment,
            claimed_annual_saving_pct: savingsPct,
            programme_years: years,
          },
          context: {
            manual_process_share_pct: manualShare,
            industry_failure_rate_pct: failureRate,
            prior_failed_attempts: 2,
          },
          derived_hints: {
            annual_saving: annualSaving,
            simple_payback_years: payback,
          },
        },
        expectedFramework:
          "Business case and payback; risk-adjusted return; phasing and gates; adoption as the constraint",
        modelAnswer: `A strong answer works through, in order:

1. **The base case.** Claimed savings are ${savingsPct}% of ${c.symbol}${revenue} ${c.big} = ${c.symbol}${annualSaving} ${c.big} a year. Against ${c.symbol}${investment} ${c.big} of investment that is a simple payback of about **${payback} years**, before discounting and before any slippage.

2. **Risk-adjust it.** At an industry failure rate of ${failureRate}%, the expected value of the full programme is materially below the headline. The honest framing is not "is the return good" but "is the return good enough to survive a ${failureRate}% chance of missing it".

3. **The binding constraint is adoption, not budget.** ${manualShare}% manual process plus two abandoned attempts is a capability and trust problem. A third attempt structured like the first two will fail like the first two. The savings also assume headcount reductions nobody has discussed — that is a change-management risk sitting in a spreadsheet as a number.

4. **Back-loaded benefits are a governance problem.** With nothing arriving before year ${Math.max(2, years - 2)}, there is no early evidence to judge continuation on. That is precisely how the previous two attempts got to abandonment.

5. **Recommendation.** Do not approve the full programme. Approve a phase one narrow enough to deliver measurable benefit inside 12 months on the highest-volume manual process, with a defined success metric and an explicit kill criterion. Release the remaining capital only against demonstrated benefit. Address the headcount assumption openly before it becomes the reason for internal resistance.

The weakest answers debate the technology. The strongest ones notice the savings are back-loaded and unverifiable, and restructure the programme so it can be judged early.`,
      };
    },
  },
];
