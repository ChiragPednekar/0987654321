import type { Archetype } from "../lib/generator";
import { currency } from "../lib/generator";

/**
 * Marketing archetypes. These are commercial cases, not creative briefs — the
 * questions are about where money goes and what it returns.
 */
export const MARKETING_ARCHETYPES: Archetype[] = [
  // --------------------------------------------------- channel mix / CAC ---
  {
    id: "channel-mix",
    categorySlug: "customer-acquisition",
    domain: "marketing",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["cac", "channel-mix", "payback", "performance-marketing"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        quantitative_analysis: 30,
        channel_judgement: 25,
        recommendation: 20,
      },
      descriptors: {
        problem_structuring:
          "Expects spend judged on payback and incrementality, not on volume delivered. Penalise answers that simply shift budget to the largest channel.",
        quantitative_analysis:
          "Must compute blended and per-channel CAC and LTV/CAC from the numbers given, and reach a payback in months.",
        channel_judgement:
          "Should question whether branded search and retargeting are incremental at all, rather than crediting them at face value.",
        recommendation:
          "A specific reallocation with an amount, and a test designed to prove it before scaling.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const arpu = rng.int(300, 1400);
      const grossMargin = rng.int(55, 82);
      const monthlyChurn = rng.float(1.5, 5, 1);

      const channels = [
        {
          name: "Paid search — non-brand",
          spend: rng.int(30, 70),
          customers: rng.int(1200, 3200),
        },
        {
          name: "Paid search — brand",
          spend: rng.int(8, 22),
          customers: rng.int(1800, 4200),
        },
        {
          name: "Paid social",
          spend: rng.int(25, 60),
          customers: rng.int(700, 2100),
        },
        {
          name: "Affiliates & retargeting",
          spend: rng.int(10, 28),
          customers: rng.int(900, 2600),
        },
      ];

      const totalSpend = channels.reduce((s, ch) => s + ch.spend, 0);
      const totalCustomers = channels.reduce((s, ch) => s + ch.customers, 0);
      const ltv = Number(((arpu * (grossMargin / 100)) / (monthlyChurn / 100)).toFixed(0));

      const rows = channels
        .map(
          (ch) =>
            `| ${ch.name} | ${c.symbol}${ch.spend} ${c.big} | ${ch.customers.toLocaleString()} | ${c.symbol}${((ch.spend * c.multiplier) / ch.customers).toFixed(0)} |`,
        )
        .join("\n");

      return {
        title: `${company.name}: Where Should the Acquisition Budget Go?`,
        scenario: `${company.name} is a ${company.stage}-stage ${company.sector} business in ${company.geo}. The CMO has **${c.symbol}${totalSpend} ${c.big}** of annual acquisition budget and has been asked to justify next year's plan.

Last year's spend and results:

| Channel | Spend | New customers | Cost per acquisition |
|---|---|---|---|
${rows}

Unit economics:
- Average revenue per user: **${c.symbol}${arpu}** per month
- Gross margin: **${grossMargin}%**
- Monthly churn: **${monthlyChurn}%**

The board has asked for a **${rng.int(20, 40)}%** increase in new customers next year without an increase in budget. The CMO's instinct is to move money into brand search, which shows by far the lowest cost per acquisition.`,
        instructions: `Recommend an allocation. Your answer should provide:

1. **Analysis** — the unit economics and each channel's true efficiency, computed rather than described.
2. **Risks** — what your reallocation depends on, and what would change your mind.
3. **Recommendation** — a specific budget shift, and how you would prove it works before committing fully.

State any assumptions you make.`,
        supportingData: {
          unit_economics: {
            arpu_monthly: arpu,
            gross_margin_pct: grossMargin,
            monthly_churn_pct: monthlyChurn,
          },
          channels: channels.map((ch) => ({
            channel: ch.name,
            spend: ch.spend,
            new_customers: ch.customers,
          })),
          derived_hints: {
            ltv: ltv,
            blended_cac: Number(((totalSpend * c.multiplier) / totalCustomers).toFixed(0)),
            customer_lifetime_months: Number((100 / monthlyChurn).toFixed(1)),
          },
        },
        expectedFramework:
          "LTV and payback; per-channel CAC; incrementality of brand and retargeting; test-and-scale allocation",
        modelAnswer: `A strong answer works through, in order:

1. **Lifetime value first.** Gross-margin ARPU is ${c.symbol}${arpu} × ${grossMargin}% = ${c.symbol}${(arpu * (grossMargin / 100)).toFixed(0)} per month. At ${monthlyChurn}% monthly churn the average lifetime is ${(100 / monthlyChurn).toFixed(1)} months, so LTV ≈ **${c.symbol}${ltv}**. Everything else is judged against this number.

2. **Blended CAC is ${c.symbol}${((totalSpend * c.multiplier) / totalCustomers).toFixed(0)}**, giving an LTV/CAC of roughly ${(ltv / ((totalSpend * c.multiplier) / totalCustomers)).toFixed(1)}× — but the blend hides the decision. Compute CAC per channel, then payback in months as CAC ÷ monthly gross profit.

3. **Interrogate the cheap channels.** Brand search and retargeting almost always show the lowest CAC, because they capture demand that already exists. The question is not what they cost per conversion but how many of those customers would have arrived anyway. Moving budget into them, as the CMO proposes, usually buys conversions you already had — the reported CAC falls while actual new customers do not rise. This is the trap in the case.

4. **The growth target constrains the answer.** More customers on flat budget means either improving conversion, or shifting into channels with headroom, or accepting a higher CAC on the margin as long as payback stays inside an acceptable window.

5. **Recommendation.** Hold or reduce brand search to the minimum needed to defend the term; fund the non-brand channels with genuine headroom; run a geo-based holdout or spend-down test on brand and retargeting to measure incrementality before reallocating fully. Commit a defined test budget with a decision date rather than reallocating everything at once.

The weakest answers push budget toward whichever channel reports the lowest CAC. The strongest ones ask whether that channel is creating demand or merely harvesting it, and design a test that answers the question.`,
      };
    },
  },

  // ---------------------------------------------------------- retention ---
  {
    id: "retention-diagnosis-mkt",
    categorySlug: "retention-loyalty",
    domain: "marketing",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["retention", "cohorts", "churn", "loyalty"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        cohort_analysis: 30,
        root_cause: 25,
        recommendation: 20,
      },
      descriptors: {
        problem_structuring:
          "Expects churn split by cohort, tenure and acquisition source before any hypothesis. Penalise answers that treat churn as one number.",
        cohort_analysis:
          "Must notice whether the problem is early-life or late-life churn, and whether recent cohorts differ from older ones.",
        root_cause:
          "Should connect the deterioration to a specific change — acquisition mix, onboarding, pricing — with evidence.",
        recommendation:
          "Actions targeted at the cohort actually leaving, with an expected retention impact.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const arpu = rng.int(200, 900);
      const oldChurn = rng.float(2, 3.5, 1);
      const newChurn = Number((oldChurn + rng.float(1.5, 3.5, 1)).toFixed(1));
      const month1 = rng.int(55, 72);
      const month3 = rng.int(38, 54);
      const month12 = rng.int(24, 36);
      const discountMix = rng.int(30, 60);
      const base = rng.int(20, 90);

      return {
        title: `${company.name}: Newer Customers Are Leaving Faster`,
        scenario: `${company.name} is a ${company.sector} business in ${company.geo} with about **${base}k** active customers paying **${c.symbol}${arpu}** per month on average.

Monthly churn has risen from **${oldChurn}%** to **${newChurn}%** over four quarters. Acquisition has not slowed — the base is still growing — but the finance team has noticed revenue growth decelerating faster than the customer count would suggest.

What the analytics team has produced:
- Cohorts from 12+ months ago still churn at about **${oldChurn}%** a month
- Cohorts acquired in the last two quarters churn at roughly **${newChurn}%**
- Retention by tenure: month 1 **${month1}%**, month 3 **${month3}%**, month 12 **${month12}%**
- **${discountMix}%** of customers acquired in the last two quarters came in on a promotional discount, up from a much smaller share previously

The CMO believes the product has got worse. The Head of Product disagrees and points at marketing.`,
        instructions: `Diagnose the churn increase and recommend a response. Your answer should provide:

1. **Analysis** — structure the churn problem and isolate where it actually sits.
2. **Risks** — what your diagnosis depends on, and what would disprove it.
3. **Recommendation** — specific actions, and what you would measure to know they worked.

State any assumptions you make.`,
        supportingData: {
          base: {
            active_customers_k: base,
            arpu_monthly: arpu,
          },
          churn: {
            older_cohorts_pct: oldChurn,
            recent_cohorts_pct: newChurn,
          },
          retention_by_tenure_pct: {
            month_1: month1,
            month_3: month3,
            month_12: month12,
          },
          acquisition: {
            discount_acquired_share_pct: discountMix,
          },
          derived_hints: {
            monthly_revenue_at_risk: Number(
              ((base * 1000 * arpu * (newChurn - oldChurn)) / 100 / c.multiplier).toFixed(1),
            ),
          },
        },
        expectedFramework:
          "Churn by cohort × tenure × acquisition source; early-life vs late-life; mix shift vs product change",
        modelAnswer: `A strong answer works through, in order:

1. **Separate mix from deterioration.** Older cohorts still churn at ${oldChurn}%. The product has not got worse *for them*. Aggregate churn rose because the composition of the base changed — this is a mix shift, and it points at acquisition, not product.

2. **Locate it by tenure.** Retention falls from ${month1}% at month 1 to ${month3}% by month 3, then flattens to ${month12}% by month 12. The damage is early-life. Customers are leaving before they reach the point where the product proves itself, which is an onboarding and expectation problem, not a long-term value problem.

3. **Follow the discount.** ${discountMix}% of recent customers arrived on promotion. Discount-acquired customers routinely churn at multiples of full-price ones: they select for price sensitivity, and many leave the moment the promotional period ends. That single fact explains both the cohort difference and why revenue decelerates faster than customer count — the customers being added are worth less than the ones being lost.

4. **Quantify it.** The churn delta of ${(newChurn - oldChurn).toFixed(1)} points on a ${base}k base at ${c.symbol}${arpu} ARPU is roughly ${c.symbol}${((base * 1000 * arpu * (newChurn - oldChurn)) / 100 / c.multiplier).toFixed(1)} ${c.big} of monthly revenue at risk. Put the number on it.

5. **Recommendation.** Cap or retarget discount acquisition and measure channels on retained customers rather than signups; rebuild first-30-day onboarding against the specific drop between month 1 and month 3; test converting existing discount customers to full price ahead of renewal rather than at it. Measure month-3 retention by cohort, not blended churn.

The weakest answers argue about whether it is product or marketing. The strongest ones observe that old cohorts are unchanged, which settles the argument before it starts.`,
      };
    },
  },

  // -------------------------------------------------------------- GTM ---
  {
    id: "gtm-launch",
    categorySlug: "gtm",
    domain: "marketing",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["gtm", "positioning", "pricing", "launch"],
    rubric: {
      criteria: {
        segmentation: 25,
        positioning: 25,
        quantitative_analysis: 25,
        recommendation: 25,
      },
      descriptors: {
        segmentation:
          "Expects a defensible choice of beachhead segment with a reason, not a list of everyone who might buy.",
        positioning:
          "Should articulate what the product replaces and why a buyer switches, not a feature list.",
        quantitative_analysis:
          "Must size the beachhead and check the go-to-market motion can be paid for at the stated price point.",
        recommendation:
          "A launch plan with a first segment, channel and price, and a defined success threshold.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const c = currency(company);
      const tam = rng.int(2000, 9000);
      const price = rng.int(2000, 18000);
      const salesCost = rng.int(40, 120);
      const budget = rng.int(20, 60);
      const incumbentShare = rng.int(45, 70);

      const segments = [
        { name: "Enterprise", accounts: rng.int(300, 900), willingness: rng.int(60, 90) },
        { name: "Mid-market", accounts: rng.int(2000, 6000), willingness: rng.int(35, 60) },
        { name: "SMB", accounts: rng.int(20000, 70000), willingness: rng.int(10, 25) },
      ];

      const rows = segments
        .map(
          (s) =>
            `| ${s.name} | ${s.accounts.toLocaleString()} | ${s.willingness}% |`,
        )
        .join("\n");

      return {
        title: `${company.name}: Launching Into a Market With an Incumbent`,
        scenario: `${company.name} is a ${company.stage}-stage ${company.sector} business in ${company.geo}, preparing to launch a new product into an established category.

The category is dominated by an incumbent holding roughly **${incumbentShare}%** share. The addressable market is about **${c.symbol}${tam} ${c.big}**.

Candidate segments:

| Segment | Addressable accounts | Share expressing willingness to switch |
|---|---|---|
${rows}

Constraints:
- Planned list price: **${c.symbol}${price}** per account per year
- Fully loaded cost of a field sales rep: **${c.symbol}${salesCost} ${c.big}** per year
- First-year launch budget: **${c.symbol}${budget} ${c.big}**
- The product is genuinely better on one dimension and worse on two

The founder wants to launch to all three segments simultaneously "to see what sticks".`,
        instructions: `Design the go-to-market. Your answer should provide:

1. **Analysis** — which segment to enter first and why, sized with the numbers given.
2. **Risks** — what your plan depends on, and what would make you change segment.
3. **Recommendation** — a specific first segment, channel, price and success threshold.

State any assumptions you make.`,
        supportingData: {
          market: {
            tam: tam,
            incumbent_share_pct: incumbentShare,
          },
          segments: segments.map((s) => ({
            segment: s.name,
            accounts: s.accounts,
            switch_willingness_pct: s.willingness,
          })),
          economics: {
            list_price_per_account: price,
            loaded_sales_rep_cost: salesCost,
            launch_budget: budget,
          },
          derived_hints: {
            accounts_per_rep_to_break_even: Math.ceil(
              (salesCost * c.multiplier) / price,
            ),
          },
        },
        expectedFramework:
          "Beachhead selection; switching motivation; GTM motion affordable at price point; staged expansion",
        modelAnswer: `A strong answer works through, in order:

1. **The motion has to be affordable at the price.** A rep costs ${c.symbol}${salesCost} ${c.big} and the product lists at ${c.symbol}${price}, so a rep must close roughly **${Math.ceil((salesCost * c.multiplier) / price)} accounts a year** merely to cover their own cost. If that number is implausible for a segment, field sales is the wrong motion for it regardless of how attractive the segment looks.

2. **Size each segment properly.** Accounts × willingness to switch × realistic win rate, not accounts × willingness. SMB has the most accounts but the lowest willingness and cannot support a sales-led motion at this price. Enterprise has the highest willingness but long cycles the launch budget may not survive.

3. **"Launch to all three" is the trap.** With ${c.symbol}${budget} ${c.big} and one product, three motions means three half-funded ones, no learning loop, and a message diluted to fit everyone. Say this directly.

4. **Positioning follows the beachhead.** Better on one dimension and worse on two is only a winning position for buyers who weight that one dimension heavily. Identify who those buyers are — that is the segment, and it is what the message has to lead with.

5. **Recommendation.** Pick the single segment where switching willingness, deal size and affordable motion intersect — usually mid-market here. Lead with the one dimension of genuine advantage, price to the value on that dimension rather than to the incumbent, and set an explicit first-year threshold (accounts closed, win rate, CAC payback) that decides whether to expand or stop.

The weakest answers describe all three segments and pick the largest. The strongest ones eliminate segments on the affordability of the sales motion before discussing appeal.`,
      };
    },
  },
];
