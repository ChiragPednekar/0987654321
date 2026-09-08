import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Additional operations archetypes: inventory policy, supply resilience,
 * quality economics and workforce scheduling. Between them they cover the
 * quantitative core of an operations management syllabus that the original
 * three (capacity, throughput, network design) did not reach.
 */
export const OPERATIONS_EXTENDED: Archetype[] = [
  {
    id: "safety-stock",
    categorySlug: "inventory",
    domain: "operations",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["inventory", "safety stock", "service level", "eoq"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must compute the cost of holding versus the cost of stocking out, and size a reorder point from demand and lead time rather than asserting one.",
        market_analysis:
          "Looks for whether demand variability is seasonal, promotional or structural, and whether customers actually defect on a stockout in this category.",
        risk_assessment:
          "Should note that a higher service level costs disproportionately more at the tail, and that lead time variability hurts more than demand variability.",
        recommendation:
          "Must set a service level and reorder point with the cash and margin consequences stated.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const weeklyDemand = rng.int(400, 3000);
      const demandStdDev = Math.round(weeklyDemand * rng.float(0.15, 0.45, 2));
      const leadTimeWeeks = rng.int(2, 9);
      const unitCost = rng.int(200, 3000);
      const holdingPct = rng.int(18, 30);
      const marginPct = rng.int(22, 45);
      const stockoutRatePct = rng.int(6, 18);
      const currentServicePct = 100 - stockoutRatePct;

      return {
        title: `${company.name}: How Much Stock Is the Right Amount?`,
        scenario: `${company.name} distributes ${company.sector} products across ${company.geo}. One SKU family accounts for a disproportionate share of complaints.

Demand averages **${weeklyDemand} units a week** with a standard deviation of **${demandStdDev} units**. Replenishment lead time is **${leadTimeWeeks} weeks** and has itself been slipping. Each unit costs **${c.symbol}${unitCost}** to buy and carries at roughly **${holdingPct}% a year** once warehousing, insurance and capital are counted. Gross margin is **${marginPct}%**.

The line currently stocks out about **${stockoutRatePct}%** of weeks. Sales say every stockout sends a customer to a competitor. Finance say inventory is already too high.`,
        instructions: `Advise the operations director. Your answer should provide:

1. **Analysis** — the reorder point and safety stock implied by the demand and lead time, and what each service level costs.
2. **Risks** — where the assumptions break, especially lead time variability.
3. **Recommendation** — a target service level and stock policy, with the cash impact.

State any assumptions you make.`,
        supportingData: {
          demand: {
            weekly_mean_units: weeklyDemand,
            weekly_std_dev_units: demandStdDev,
            coefficient_of_variation: Number((demandStdDev / weeklyDemand).toFixed(2)),
          },
          supply: { lead_time_weeks: leadTimeWeeks, lead_time_reliability: "deteriorating" },
          economics: {
            unit_cost: unitCost,
            annual_holding_cost_pct: holdingPct,
            gross_margin_pct: marginPct,
          },
          current_performance: { service_level_pct: currentServicePct },
          derived_hints: {
            mean_demand_over_lead_time_units: weeklyDemand * leadTimeWeeks,
            demand_std_dev_over_lead_time_units: Math.round(
              demandStdDev * Math.sqrt(leadTimeWeeks),
            ),
          },
        },
        expectedFramework:
          "Reorder point = mean demand over lead time + z x std dev over lead time. Trade the holding cost of safety stock against lost margin on stockouts.",
        modelAnswer: `Mean demand over the lead time is ${weeklyDemand} x ${leadTimeWeeks} = ${weeklyDemand * leadTimeWeeks} units. Demand variability over the lead time scales with the square root of time: ${demandStdDev} x sqrt(${leadTimeWeeks}) = about ${Math.round(demandStdDev * Math.sqrt(leadTimeWeeks))} units.

A 95% service level needs roughly 1.65 standard deviations of safety stock — about ${Math.round(1.65 * demandStdDev * Math.sqrt(leadTimeWeeks))} units — costing ${c.symbol}${Math.round(1.65 * demandStdDev * Math.sqrt(leadTimeWeeks) * unitCost * (holdingPct / 100)).toLocaleString()} a year to hold. Going to 99% needs 2.33 standard deviations: about 40% more stock for four points of service. That convexity is the whole decision.

Against that, a stockout costs the margin on the lost unit — ${c.symbol}${Math.round(unitCost * (marginPct / 100))} — plus whatever share of the customer never comes back, which is the number sales are really arguing about and nobody has measured.

The bigger lever is the lead time itself: it enters the safety stock formula under a square root, so halving it cuts safety stock by roughly 30% at no holding cost at all. Fix the supplier before buying more inventory.`,
      };
    },
  },

  {
    id: "dual-sourcing",
    categorySlug: "supply-chain",
    domain: "operations",
    difficulty: "hard",
    estimatedMinutes: 40,
    tags: ["supply chain", "resilience", "single source", "risk"],
    rubric: {
      criteria: {
        financial_analysis: 20,
        market_analysis: 20,
        risk_assessment: 25,
        recommendation: 15,
      },
      descriptors: {
        financial_analysis:
          "Must price the resilience: the unit cost premium of a second source against the expected cost of disruption (probability x duration x margin at risk).",
        market_analysis:
          "Looks for supplier concentration, switching cost, qualification lead time, and whether the second source is genuinely independent.",
        risk_assessment:
          "Should treat correlated risk explicitly — two suppliers in the same region or sharing a sub-tier supplier are not two sources.",
        recommendation:
          "Must commit to a sourcing structure with a split, and state the disruption probability at which the answer changes.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const annualSpend = rng.int(60, 320);
      const premiumPct = rng.float(3, 12, 1);
      const disruptionProbPct = rng.int(5, 25);
      const disruptionWeeks = rng.int(4, 16);
      const weeklyMargin = Number((annualSpend * rng.float(0.2, 0.5, 2) / 52).toFixed(2));
      const qualificationMonths = rng.int(4, 14);

      return {
        title: `${company.name}: One Supplier, One Region, One Problem`,
        scenario: `${company.name} makes ${company.sector} products for ${company.geo}. A single supplier provides a component representing **${c.symbol}${annualSpend} ${c.big}** of annual spend — around a third of bill-of-materials cost — and there is no qualified alternative.

Procurement has found a second source. It would cost about **${premiumPct}% more** per unit and take **${qualificationMonths} months** to qualify. The incumbent has hinted that splitting the volume would cost the company its current pricing tier.

Risk modelling puts the chance of a material disruption at that supplier at roughly **${disruptionProbPct}% a year**, with an expected outage of **${disruptionWeeks} weeks**. Contribution margin at risk is about **${c.symbol}${weeklyMargin} ${c.big} a week** if the line stops.

The alternative supplier's plant is in the same region as the incumbent's.`,
        instructions: `Advise the COO. Your answer should provide:

1. **Analysis** — price the insurance. What does dual sourcing cost, and what expected loss does it avoid?
2. **Risks** — including whether this second source actually reduces the risk you care about.
3. **Recommendation** — a sourcing structure and volume split, with the trigger to revisit.

State any assumptions you make.`,
        supportingData: {
          current_sourcing: {
            [`annual_spend_${c.big.toLowerCase()}`]: annualSpend,
            suppliers: 1,
            share_of_bom_pct: 33,
          },
          alternative: {
            unit_cost_premium_pct: premiumPct,
            qualification_months: qualificationMonths,
            region: "same as incumbent",
          },
          risk_model: {
            annual_disruption_probability_pct: disruptionProbPct,
            expected_outage_weeks: disruptionWeeks,
            [`contribution_margin_at_risk_per_week_${c.big.toLowerCase()}`]: weeklyMargin,
          },
        },
        expectedFramework:
          "Expected loss = probability x duration x margin per week. Compare against the annual premium of holding a second source. Then test whether the sources are correlated.",
        modelAnswer: `Expected annual loss from the single source = ${disruptionProbPct}% x ${disruptionWeeks} weeks x ${c.symbol}${weeklyMargin} ${c.big} = about **${c.symbol}${((disruptionProbPct / 100) * disruptionWeeks * weeklyMargin).toFixed(2)} ${c.big} a year**.

The premium on dual sourcing, if half the volume moves, is ${premiumPct}% x 50% x ${c.symbol}${annualSpend} ${c.big} = about ${c.symbol}${((premiumPct / 100) * 0.5 * annualSpend).toFixed(2)} ${c.big} a year, before the lost pricing tier the incumbent is threatening.

The number that should stop the room is the region. Two suppliers in the same region share weather, power, port, and often a sub-tier supplier — so this is not two sources, it is one source with two invoices. Qualifying it buys much less risk reduction than the model implies while paying the full premium.

Recommend qualifying the alternative anyway to break the incumbent's pricing leverage, but continue searching for a genuinely independent source in a different region, and treat the ${qualificationMonths}-month qualification as the real constraint — it means the decision has to be made before the disruption, which is why it keeps getting deferred.`,
      };
    },
  },

  {
    id: "quality-economics",
    categorySlug: "quality",
    domain: "operations",
    difficulty: "medium",
    estimatedMinutes: 35,
    tags: ["quality", "defects", "cost of poor quality", "process"],
    rubric: {
      criteria: {
        financial_analysis: 25,
        market_analysis: 15,
        risk_assessment: 20,
        recommendation: 20,
      },
      descriptors: {
        financial_analysis:
          "Must total the cost of poor quality — scrap, rework, warranty, and returns — and compare it against the cost of the proposed intervention.",
        market_analysis:
          "Looks for where defects are detected: internal failure is cheap, customer-detected failure is not.",
        risk_assessment:
          "Should identify that inspection catches defects but does not prevent them, and that the true cost includes reputation and churn that the ledger does not capture.",
        recommendation:
          "Must choose between inspecting more and fixing the process, with the payback period stated.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const unitsPerYear = rng.int(80_000, 900_000);
      const defectPct = rng.float(1.5, 7.5, 1);
      const scrapCost = rng.int(150, 1400);
      const warrantyClaimPct = rng.float(0.6, 3.2, 1);
      const warrantyCost = rng.int(1200, 9000);
      const processFix = rng.int(15, 90);
      const inspectionAnnual = rng.int(8, 40);

      const defectiveUnits = Math.round(unitsPerYear * (defectPct / 100));
      const warrantyUnits = Math.round(unitsPerYear * (warrantyClaimPct / 100));

      return {
        title: `${company.name}: Inspect More, or Fix the Line?`,
        scenario: `${company.name} manufactures ${company.sector} products in ${company.geo}, running **${unitsPerYear.toLocaleString()} units a year**.

Internal quality checks reject **${defectPct}%** of output, at a scrap and rework cost of about **${c.symbol}${scrapCost} a unit**. A further **${warrantyClaimPct}%** of shipped units come back under warranty, each costing roughly **${c.symbol}${warrantyCost}** once field service, replacement and admin are counted.

Two proposals are on the table. Engineering wants **${c.symbol}${processFix} ${c.big}** of one-off capital to re-tool the station where most defects originate. Quality wants **${c.symbol}${inspectionAnnual} ${c.big} a year** of additional inspection headcount to catch more before shipment.

The plant manager is measured on unit cost.`,
        instructions: `Advise the plant manager. Your answer should provide:

1. **Analysis** — the total cost of poor quality today, split by where it is detected, and the return on each proposal.
2. **Risks** — what each option does not solve.
3. **Recommendation** — which to fund, with a payback period.

State any assumptions you make.`,
        supportingData: {
          volume: { units_per_year: unitsPerYear },
          internal_failure: {
            defect_rate_pct: defectPct,
            defective_units_per_year: defectiveUnits,
            scrap_rework_cost_per_unit: scrapCost,
          },
          external_failure: {
            warranty_claim_rate_pct: warrantyClaimPct,
            warranty_units_per_year: warrantyUnits,
            cost_per_claim: warrantyCost,
          },
          proposals: {
            [`process_retool_one_off_${c.big.toLowerCase()}`]: processFix,
            [`additional_inspection_per_year_${c.big.toLowerCase()}`]: inspectionAnnual,
          },
        },
        expectedFramework:
          "Cost of poor quality = internal failure + external failure. Compare prevention against detection on payback, and note that inspection does not reduce the defect rate.",
        modelAnswer: `Internal failure costs ${defectiveUnits.toLocaleString()} x ${c.symbol}${scrapCost} = about ${c.symbol}${((defectiveUnits * scrapCost) / (c.big === "Cr" ? 10_000_000 : 1_000_000)).toFixed(1)} ${c.big} a year. External failure costs ${warrantyUnits.toLocaleString()} x ${c.symbol}${warrantyCost} = about ${c.symbol}${((warrantyUnits * warrantyCost) / (c.big === "Cr" ? 10_000_000 : 1_000_000)).toFixed(1)} ${c.big}.

Note the asymmetry: a defect caught at the station costs ${c.symbol}${scrapCost}; the same defect caught by a customer costs ${c.symbol}${warrantyCost}, roughly ${Math.round(warrantyCost / scrapCost)}x more. That ratio is the argument.

Inspection moves defects from the expensive column to the cheap one but does not reduce how many are made — the scrap cost rises as detection improves. Re-tooling reduces the number created, which improves both columns at once.

Fund the re-tool. Its payback is the reduction in combined failure cost against ${c.symbol}${processFix} ${c.big} of one-off capital, and unlike the inspection headcount it does not recur every year. Keep enough inspection to measure whether the fix worked.`,
      };
    },
  },
];
