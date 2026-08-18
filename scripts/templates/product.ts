import type { Archetype } from "../lib/generator";

/** Product management archetypes — the PM interview loop end to end. */
export const PRODUCT_ARCHETYPES: Archetype[] = [
  // ------------------------------------------------------- metric drop -----
  {
    id: "metric-drop",
    categorySlug: "metrics",
    domain: "product_management",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["metrics", "diagnosis", "analytics"],
    rubric: {
      criteria: {
        problem_structuring: 25,
        hypothesis_generation: 25,
        data_analysis: 25,
        recommendation: 25,
      },
      descriptors: {
        problem_structuring:
          "Expects the metric decomposed into its inputs before any hypothesis, and clarifying questions asked (which segment, which platform, when exactly).",
        hypothesis_generation:
          "Should separate instrumentation error, seasonality, internal change and external change — and check the first before the others.",
        data_analysis:
          "Must propose specific cuts of the data that would distinguish between hypotheses.",
        recommendation:
          "A concrete diagnostic sequence and what action follows from each finding.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const pipelineMigratedDays = rng.int(1, 20);
      const redesignDaysAgo = rng.int(2, 30);
      const campaignPausedDays = rng.int(5, 25);
      const rolloutPct = rng.int(20, 100);
      const metric = rng.pick([
        "daily active users",
        "weekly active teams",
        "checkout completion rate",
        "trial-to-paid conversion",
        "7-day retention",
      ]);
      const dropPct = rng.int(8, 28);
      const days = rng.int(3, 21);
      const platform = rng.pick(["iOS", "Android", "web", "all platforms"]);
      const region = rng.pick(["India", "the US", "Southeast Asia", "Europe"]);

      return {
        title: `${company.name}: ${metric.charAt(0).toUpperCase() + metric.slice(1)} Dropped ${dropPct}%`,
        scenario: `You are the PM for ${company.name}'s core ${company.sector} product.

**${metric.charAt(0).toUpperCase() + metric.slice(1)}** has fallen **${dropPct}%** over the past **${days} days**. The drop appears concentrated in **${platform}** and is most pronounced in **${region}**.

Context that may or may not be relevant:
- A redesigned onboarding flow shipped ${redesignDaysAgo} days ago to ${rolloutPct}% of users
- Marketing paused a paid acquisition campaign ${campaignPausedDays} days ago
- A competitor launched a free tier last month
- The data team migrated the analytics pipeline ${pipelineMigratedDays} days ago

Your VP wants an answer by end of day and is already asking whether the redesign should be rolled back.`,
        instructions: `Diagnose the drop. Provide:

1. **Analysis** — how you would structure the investigation and which hypotheses you would test in what order.
2. **Risks** — of acting too early, and of acting too late.
3. **Recommendation** — your diagnostic sequence and what you would tell the VP today.

Be specific about the data cuts you would pull.`,
        supportingData: {
          incident: {
            metric,
            drop_pct: dropPct,
            window_days: days,
            concentrated_platform: platform,
            concentrated_region: region,
          },
          recent_changes: {
            onboarding_redesign_days_ago: redesignDaysAgo,
            onboarding_rollout_pct: rolloutPct,
            paid_campaign_paused_days_ago: campaignPausedDays,
            competitor_free_tier_launched: "last month",
            analytics_pipeline_migrated_days_ago: pipelineMigratedDays,
          },
        },
        expectedFramework: `1. **Is it real?** Check instrumentation first — the pipeline migration is the cheapest hypothesis to eliminate and the most embarrassing to miss.
2. **Decompose the metric.** For DAU: new + returning + resurrected − churned. Which component moved?
3. **Segment.** Platform, region, cohort, acquisition channel, new vs existing users.
4. **Timeline.** Does the drop align with a specific deploy, or is it gradual?
5. **Internal vs external.** Internal changes are testable and reversible; external ones are not.
6. **Act** on the evidence, with a rollback only if the evidence points there.`,
        modelAnswer: `**First, clarify.** Before analysis I would establish: is the drop step-change or gradual? Does it appear in a metric computed a different way? Does it show up in revenue or support tickets — the downstream signals that confirm real user impact?

**Hypothesis 1 — it isn't real.** The analytics pipeline migrated recently. A change to event definitions, deduplication or timezone handling produces exactly this pattern. This is the first thing to check because it is cheap and because acting on a measurement artefact is the worst outcome available. **Test:** reconcile against a second source — server logs, payments, or support volume. If those are flat, the drop is in the measurement, not the product.

**Hypothesis 2 — mix, not behaviour.** Paid acquisition was paused ${campaignPausedDays} days ago. That mechanically reduces new users without any existing user changing behaviour. **Test:** decompose ${metric} into new versus returning. If returning users are flat and new users fell, this is a marketing change misread as a product problem — and the correct response is to tell the VP nothing is broken.

**Hypothesis 3 — the redesign.** ${platform === "all platforms" ? "The drop spans platforms, which fits a broad rollout." : `The drop is concentrated in ${platform}, which fits a platform-specific regression rather than a universal one.`} **Test:** compare the treatment and holdout cohorts directly. If the redesign shipped to less than 100% of users, this is a clean A/B comparison already sitting in the data — it will settle the question in an hour.

**Hypothesis 4 — external.** A competitor's free tier would show as elevated churn among existing users, concentrated in price-sensitive segments, and gradual rather than step-change.

**Ordering matters.** Instrumentation, then mix, then internal change, then external. Each is cheaper to test than the next, and each eliminates a class of explanation. Jumping to the redesign — the VP's instinct — risks rolling back a change that is fine and losing the improvement it delivered.

**Risks.** Acting too early means rolling back a healthy release on a measurement artefact, and burning the team's trust in experimentation. Acting too late means shipping a regression to the remaining ${100 - rolloutPct}% of users. The way to hold both is to stop the rollout without reverting: it costs nothing and buys time to be right.

**What I would tell the VP today.** "The redesign is one of four candidates and not yet the leading one. I have paused further rollout so we cannot make it worse. I will have the instrumentation reconciliation and the treatment-versus-holdout comparison by this evening, which together will confirm or eliminate three of the four hypotheses. I would not roll back on today's evidence — the holdout data will tell us in hours, and rolling back now would destroy the cleanest signal we have."`,
      };
    },
  },

  // ---------------------------------------------------- prioritisation -----
  {
    id: "prioritization",
    categorySlug: "prioritization",
    domain: "product_management",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["prioritization", "roadmap", "tradeoffs"],
    rubric: {
      criteria: {
        framework_application: 25,
        quantitative_reasoning: 25,
        stakeholder_management: 20,
        recommendation: 30,
      },
      descriptors: {
        framework_application:
          "Any explicit framework is fine (RICE, weighted scoring, cost of delay) as long as it is applied consistently, not merely named.",
        quantitative_reasoning:
          "Should estimate impact per unit of effort using the numbers given, and acknowledge estimate uncertainty.",
        stakeholder_management:
          "Expects a plan for saying no to the requests not chosen, with reasoning the requester can accept.",
        recommendation:
          "A committed sequence for the quarter, with what is explicitly not being done.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const onboardingWeeks = rng.int(12, 25);
      const activationPct = rng.int(28, 55);
      const ssoWeeks = rng.int(6, 14);
      const ceoWeeks = rng.int(4, 10);
      const activationLift = rng.int(5, 15);
      const perfWeeks = rng.int(10, 20);
      const migrationWeeks = rng.int(20, 40);
      const engineers = rng.int(4, 12);
      const weeks = 12;
      const capacity = engineers * weeks;
      const enterpriseArr = rng.int(200, 900);
      const churnRisk = rng.int(2, 8);
      const debtSlowdown = rng.int(15, 40);

      return {
        title: `${company.name}: One Quarter, Five Demands`,
        scenario: `You are the PM for ${company.name}'s ${company.sector} platform. You have **${engineers} engineers** for a **${weeks}-week quarter** — roughly **${capacity} engineer-weeks** of capacity, before the usual 20-30% goes to support and unplanned work.

Five things are on the table:

**A. Enterprise SSO.** Blocking **${c(enterpriseArr)}k** of annual contract value across three deals in late-stage procurement. Estimated **${ssoWeeks} engineer-weeks**.

**B. Performance work.** The app's slowest screen takes ${rng.float(3, 9, 1)}s to load. Support cites it as the top complaint. Estimated **${perfWeeks} engineer-weeks**.

**C. Onboarding redesign.** Activation sits at ${activationPct}%; research suggests a redesign could add ${activationLift} points. Estimated **${onboardingWeeks} engineer-weeks**.

**D. Platform migration.** Technical debt is slowing every team by an estimated **${debtSlowdown}%**. Estimated **${migrationWeeks} engineer-weeks**.

**E. The CEO's feature.** The CEO promised a specific customer a custom reporting feature at a conference. **${ceoWeeks} engineer-weeks**. No other customer has asked for it.

Sales says A. Support says B. Growth says C. Engineering says D. The CEO says E.`,
        instructions: `Set the quarterly roadmap. Provide:

1. **Analysis** — how you evaluate and rank these, with your reasoning shown.
2. **Risks** — of your choices, including what breaks if you're wrong.
3. **Recommendation** — the committed plan, and how you communicate the no's.

You cannot do everything. Be explicit about what you are cutting.`,
        supportingData: {
          capacity: {
            engineers,
            weeks,
            gross_engineer_weeks: capacity,
            realistic_capacity_pct: 70,
          },
          items: {
            A_enterprise_sso: { blocked_arr_k: enterpriseArr, engineer_weeks: ssoWeeks },
            B_performance: { top_support_complaint: true, engineer_weeks: perfWeeks },
            C_onboarding: {
              current_activation_pct: activationPct,
              expected_lift_points: activationLift,
              engineer_weeks: onboardingWeeks,
            },
            D_platform_migration: {
              team_slowdown_pct: debtSlowdown,
              engineer_weeks: migrationWeeks,
            },
            E_ceo_feature: { customers_requesting: 1, engineer_weeks: ceoWeeks },
          },
          risk: { enterprise_churn_risk_accounts: churnRisk },
        },
        expectedFramework: `1. **Real capacity** = ${capacity} × ~70% = ~${Math.round(capacity * 0.7)} engineer-weeks. Planning against gross capacity is the most common roadmap error.
2. **Score consistently** — RICE (reach × impact × confidence ÷ effort) or cost of delay ÷ duration.
3. **Convert to money or users** where possible; A is already in revenue terms, C can be, B and D are indirect.
4. **Treat D as an investment** — it compounds, so delaying it is a growing cost, not a fixed one.
5. **Handle E on its merits**, not its source.
6. **Sequence**, leave slack, and communicate the trade-offs.`,
        modelAnswer: `**Start with honest capacity.** ${capacity} engineer-weeks gross becomes roughly **${Math.round(capacity * 0.7)}** after support and unplanned work. Every plan that assumes ${capacity} fails in week 8. The five items total ${ssoWeeks + perfWeeks + onboardingWeeks + migrationWeeks + ceoWeeks} engineer-weeks against ~${Math.round(capacity * 0.7)} available — so at most two or three of them happen, and pretending otherwise is the actual failure mode here.

**Scoring.**

- **A (SSO)** — ${c(enterpriseArr)}k of ARR is blocked, contracts are in late-stage procurement, and the effort is the smallest of the meaningful items. Highest confidence and highest value density on the list. It also unblocks a *segment*, not just three deals: SSO is table stakes for every future enterprise deal.
- **C (Onboarding)** — a ${activationLift}-point activation lift compounds across every user acquired thereafter. Large but slower-realising, and the confidence is lower because it rests on research rather than signed contracts.
- **B (Performance)** — top support complaint, so real user pain, but the link to revenue or retention is unquantified. I would want the churn correlation before spending ${perfWeeks} weeks.
- **D (Migration)** — a ${debtSlowdown}% slowdown on every team is the largest number on the page, and it grows. But it cannot be done in a quarter at ${migrationWeeks} weeks alongside anything else, and a half-finished migration is worse than none.
- **E (CEO's feature)** — one customer, no broader demand. The right response is not "no" but "here is what it costs": ${ceoWeeks} engineer-weeks means dropping something else, and the CEO gets to choose which.

**Recommendation for the quarter.**

1. **Ship A (SSO).** Revenue is committed, the deals are live, and it unlocks a segment.
2. **Ship C (Onboarding).** The compounding growth lever, and the quarter's biggest bet.
3. **Start D as a carve-out** — take ${Math.round(migrationWeeks * 0.3)} weeks to do the highest-leverage third of the migration, sequenced so it delivers standalone value rather than sitting half-done. Migrations that wait for a "clear quarter" never happen.
4. **Defer B**, with an instruction to instrument first: correlate the slow screen against churn and session abandonment. If the data supports it, B leads next quarter with a real business case instead of an anecdote.
5. **Decline E as scoped.** Offer the customer a report export via the existing API this quarter, and put the native feature into the normal prioritisation process.

**Communicating the no's.** Each rejection needs a reason the requester can act on, not a verdict. Support gets a date and a measurement plan, not a dismissal. The CEO gets a trade-off — "this displaces SSO, which is holding ${c(enterpriseArr)}k; still want it?" — which is a genuine question, not a rhetorical one. Sales gets SSO and, in exchange, a commitment to stop promising unbuilt features.

**Risks.** If SSO slips, three deals slip with it, so I would start it first and staff it thickest. The onboarding lift is an estimate: I would ship it behind an experiment so a miss costs measurement rather than the quarter. And the migration carve-out is the item most likely to be raided when something urgent lands — protecting it is my job, and if I fail at that, next quarter starts ${debtSlowdown}% slower again.`,
      };
    },
  },

  // -------------------------------------------------------- retention ------
  {
    id: "retention-diagnosis",
    categorySlug: "retention",
    domain: "product_management",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["retention", "cohorts", "churn", "habit"],
    rubric: {
      criteria: {
        cohort_analysis: 25,
        root_cause: 25,
        solution_design: 25,
        measurement: 25,
      },
      descriptors: {
        cohort_analysis:
          "Must distinguish the shape of the retention curve — early drop-off versus a curve that never flattens — because they have different causes.",
        root_cause:
          "Should connect retention to whether users reached value, not to feature counts.",
        solution_design: "Interventions matched to the specific point of drop-off.",
        measurement: "A clear success metric and how it would be tested.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const powerUserUsageShare = rng.int(60, 85);
      const cacIncrease = rng.int(20, 60);
      const d1 = rng.int(45, 70);
      const d7 = rng.int(20, 38);
      const d30 = rng.int(9, 22);
      const d90 = rng.int(5, 15);
      const activationRate = rng.int(30, 55);
      const powerUserPct = rng.int(8, 20);

      return {
        title: `${company.name}: Users Sign Up and Disappear`,
        scenario: `${company.name}'s ${company.sector} product acquires users steadily but struggles to keep them.

**Retention curve (all users):**

| Day | Retained |
|---|---|
| D1 | ${d1}% |
| D7 | ${d7}% |
| D30 | ${d30}% |
| D90 | ${d90}% |

**What else we know:**
- **${activationRate}%** of new users complete the core action at least once in week one
- Among users who complete the core action **three or more times in week one**, D30 retention is **${Math.min(85, d30 * 3)}%**
- **${powerUserPct}%** of users account for roughly ${powerUserUsageShare}% of total usage
- Exit surveys most commonly say "didn't find it useful" and "forgot about it"

Growth is currently offsetting churn with paid acquisition, at a blended CAC that has risen ${cacIncrease}% year on year.`,
        instructions: `Diagnose the retention problem and propose a plan. Provide:

1. **Analysis** — what the curve and the segment data tell you.
2. **Risks** — of the interventions you propose.
3. **Recommendation** — what you would build, and how you would measure success.`,
        supportingData: {
          retention_curve: { d1: d1, d7: d7, d30: d30, d90: d90 },
          segments: {
            activation_rate_pct: activationRate,
            d30_retention_for_3x_core_action_pct: Math.min(85, d30 * 3),
            power_users_pct: powerUserPct,
            power_user_share_of_usage_pct: powerUserUsageShare,
          },
          economics: { cac_increase_yoy_pct: cacIncrease },
          qualitative: {
            top_exit_reasons: ["didn't find it useful", "forgot about it"],
          },
        },
        expectedFramework: `1. **Read the curve's shape.** A steep D1→D7 fall is an onboarding or value-discovery problem. A curve that never flattens is a product-market fit problem. These need opposite responses.
2. **Find the habit moment** — the behaviour that separates retained from churned users.
3. **Compare segments** — the 3×-core-action cohort is the natural experiment already in the data.
4. **Attack the biggest drop-off** first.
5. **Instrument** the intervention so the effect is measurable.`,
        modelAnswer: `**Reading the curve.** The steepest fall is D1→D7 (${d1}% → ${d7}%, losing ${d1 - d7} points), and the curve ${d90 / d30 > 0.6 ? `flattens between D30 and D90 (${d30}% → ${d90}%), which is the important good news: a flattening curve means a real core of users who have found durable value. This is a value-discovery problem, not a product-market-fit problem.` : `keeps falling from D30 to D90 (${d30}% → ${d90}%) without flattening, which is the harder diagnosis: even users who stay a month are not forming a habit. That points at product-market fit, and no amount of onboarding polish fixes it.`}

**The signal that matters most.** Users who complete the core action 3+ times in week one retain at ${Math.min(85, d30 * 3)}% at D30, versus ${d30}% overall — roughly ${(Math.min(85, d30 * 3) / d30).toFixed(1)}× better. Meanwhile only ${activationRate}% complete it even once.

That gap is the whole problem stated in one line: **the product works for people who reach the core action repeatedly, and most people never get there.** The retention problem is not a retention problem — it is an activation problem showing up one step downstream.

**A caution on the correlation.** Users who perform the core action three times may retain because they were always going to — motivated users do more of everything. The causal claim ("make people do it 3×and they will retain") is exactly what needs testing, not assuming. It is still the best lead available, but I would design the intervention as an experiment rather than a rollout.

**The exit-survey evidence.** "Didn't find it useful" is consistent with never reaching value. "Forgot about it" points at the absence of a trigger to return — no notification, no email, no natural reason to come back. Those are different fixes: the first is onboarding, the second is re-engagement.

**Recommendation.**

1. **Define and instrument the activation metric** as "3 core actions in 7 days". Right now the team measures a single completion, which the data says is the wrong bar. Everything else depends on this being measured properly.
2. **Rebuild the first session around one completed core action.** Cut every step that does not lead there — account setup fields, tours, feature tours. Target: raise the ${activationRate}% single-completion rate by 10-15 points.
3. **Build a return trigger for days 2-7.** A notification or email tied to something the user actually did, not a generic "come back". This addresses "forgot about it" directly, and it is cheap relative to onboarding work.
4. **Interview the ${powerUserPct}% power users.** They found value; the fastest way to learn what the path looks like is to ask the people who walked it.

**Measurement.** Primary metric: D30 retention for the treated cohort against a holdout. Guardrail: activation rate must rise without a fall in D1, which would signal the flow has been shortened at the cost of comprehension. I would run it for two full cohorts before reading the result — retention experiments read early are read wrong.

**Risks.** Notifications are the intervention most likely to backfire; over-sending buys week-one numbers and loses trust. And if the curve is genuinely not flattening, none of this is enough, and the honest recommendation is to slow paid acquisition — with CAC up ${cacIncrease}% year on year, buying users to fill a leaking bucket gets more expensive every quarter.`,
      };
    },
  },

  // ----------------------------------------------------- product launch ----
  {
    id: "product-launch",
    categorySlug: "product-launch",
    domain: "product_management",
    difficulty: "medium",
    estimatedMinutes: 40,
    tags: ["launch", "gtm", "rollout"],
    rubric: {
      criteria: {
        launch_strategy: 25,
        risk_management: 25,
        success_metrics: 25,
        recommendation: 25,
      },
      descriptors: {
        launch_strategy:
          "Expects a staged rollout with a rationale, not a date and a press release.",
        risk_management:
          "Should cover rollback plans, support readiness, and cannibalisation of the existing product.",
        success_metrics:
          "Leading and lagging indicators, with thresholds defined before launch.",
        recommendation: "A sequenced plan with go/no-go gates.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const existingUsers = rng.int(50, 900);
      const betaUsers = rng.int(200, 3000);
      const betaSatisfaction = rng.int(60, 90);
      const priceIncrease = rng.int(15, 60);

      return {
        title: `${company.name}: Launching the New Tier`,
        scenario: `${company.name} (${company.sector}, ${company.geo}) is six weeks from launching a new premium tier — the biggest product change in three years.

**Where things stand.**
- **${existingUsers}k** existing users on the current product
- **${betaUsers}** beta users over the past two months; **${betaSatisfaction}%** report satisfaction
- The new tier is priced **${priceIncrease}% above** the current plan
- Two of the four planned features are complete; a third is in QA; the fourth is at risk
- Support has not yet been trained; documentation is roughly half written
- Marketing has booked a launch event and briefed press for a fixed date

The VP of Marketing wants to hold the date. Engineering wants four more weeks. The CEO has asked you to decide.`,
        instructions: `Make the launch call. Provide:

1. **Analysis** — readiness assessment and launch options.
2. **Risks** — of launching on time, and of delaying.
3. **Recommendation** — your decision, the rollout plan, and the metrics you would gate on.`,
        supportingData: {
          audience: {
            existing_users_k: existingUsers,
            beta_users: betaUsers,
            beta_satisfaction_pct: betaSatisfaction,
          },
          product: {
            features_complete: 2,
            features_in_qa: 1,
            features_at_risk: 1,
            price_premium_pct: priceIncrease,
          },
          readiness: {
            support_trained: false,
            documentation_pct_complete: 50,
            press_briefed: true,
            event_booked: true,
          },
        },
        expectedFramework: `1. **Separate the launch from the release.** The event date and the code-ship date are different decisions, and conflating them is what forces bad choices.
2. **Assess readiness** across product, support, docs and pricing — not product alone.
3. **Generate options** beyond ship/delay: staged rollout, limited availability, launch with three features.
4. **Define gates** with numeric thresholds.
5. **Plan the rollback.**`,
        modelAnswer: `**The framing error to fix first.** "Hold the date or delay four weeks" is a false binary. The marketing event and the general-availability rollout do not have to be the same day. A launch event can announce availability that then rolls out progressively — this is how most large software launches actually work, and it dissolves most of the conflict between Marketing and Engineering.

**Readiness.** Product is the *least* worrying gap: two of four features are done and a third is close. The real exposure is operational. Support is untrained and documentation is half-written, which means the first wave of users on a ${priceIncrease}%-more-expensive tier will hit an unprepared support function. Paying more and getting worse support is precisely how a premium launch generates churn and bad press simultaneously.

**Reading the beta signal.** ${betaSatisfaction}% satisfaction across ${betaUsers} users is ${betaSatisfaction > 75 ? "genuinely encouraging, though beta users self-select for enthusiasm and tolerance — the mainstream cohort will be harsher." : "not a strong enough signal to launch broadly on. Below ~75% in a self-selected beta population usually gets worse, not better, with mainstream users."}

**Recommendation — hold the date, stage the rollout.**

1. **Keep the event.** Press is briefed and the date is booked; moving it costs credibility and is the one genuinely irreversible commitment here.
2. **Launch with three features, not four.** Cut the at-risk feature from launch scope and name it publicly as coming next quarter. A shipped, working three-feature tier beats a four-feature tier that slips.
3. **Stage general availability:** 5% of existing users in week one, 25% in week two, 100% by week four — gated, not scheduled.
4. **Gates between stages.** Do not advance if support ticket volume per user exceeds 2× the current baseline, if the new-tier conversion rate is under ${Math.round(rng.int(3, 10))}%, or if any P1 defect is open. These thresholds go in writing *before* launch, because after launch there is always a reason to wave one through.
5. **Use the six weeks for support and docs, not features.** This is the highest-value use of the remaining time, and it is the work that gets cut by default because it is invisible on a roadmap.

**Metrics.** Leading: activation into the new tier, time-to-first-value, support contact rate. Lagging: net revenue retention, upgrade rate, churn among users who upgraded — that last one is the number that reveals whether the ${priceIncrease}% premium was justified by the value delivered.

**Risks.** Cutting the fourth feature risks the tier feeling thin against the price premium; I would validate the three-feature package against beta users' stated willingness to pay before committing. Staged rollout also means press coverage lands before most users can access the product, so the announcement must be explicit that availability is progressive — otherwise the launch generates demand it cannot serve, which is a worse outcome than a quieter launch.`,
      };
    },
  },

  // ---------------------------------------------------- product growth -----
  {
    id: "growth-loop",
    categorySlug: "product-growth",
    domain: "product_management",
    difficulty: "hard",
    estimatedMinutes: 45,
    tags: ["growth", "loops", "virality", "acquisition"],
    rubric: {
      criteria: {
        growth_model: 25,
        loop_design: 25,
        quantitative_reasoning: 25,
        recommendation: 25,
      },
      descriptors: {
        growth_model:
          "Should model growth as a system with inputs and feedback, not a funnel with a bigger top.",
        loop_design:
          "Expects a specific loop with each step named, and an honest view of the viral coefficient.",
        quantitative_reasoning:
          "Must work with the CAC/LTV numbers given and compute payback.",
        recommendation: "A specific loop to build, with the metric that proves it works.",
      },
      passScore: 60,
    },
    build: (company, rng) => {
      const cacIncrease18m = rng.int(25, 70);
      const cac = rng.int(300, 2500);
      const arpu = rng.int(200, 1500);
      const grossMargin = rng.int(60, 85);
      const monthlyChurn = rng.float(2, 8, 1);
      const inviteRate = rng.int(5, 25);
      const inviteConversion = rng.int(10, 35);
      const ltv = Math.round((arpu * (grossMargin / 100)) / (monthlyChurn / 100));
      const k = Number(((inviteRate / 100) * (inviteConversion / 100)).toFixed(3));

      return {
        title: `${company.name}: Paid Growth Is Getting Expensive`,
        scenario: `${company.name}'s ${company.sector} product has grown almost entirely through paid acquisition. That is becoming unsustainable.

**Unit economics (monthly):**
- Blended CAC: **${c(cac)}**
- ARPU: **${c(arpu)}**
- Gross margin: **${grossMargin}%**
- Monthly churn: **${monthlyChurn}%**

**Existing referral behaviour:**
- **${inviteRate}%** of active users invite at least one other person
- **${inviteConversion}%** of those invitations convert to a signup

CAC has risen ${cacIncrease18m}% over 18 months as auction competition increased. The CEO wants a growth model that does not depend on buying every user.`,
        instructions: `Design the growth strategy. Provide:

1. **Analysis** — current unit economics, payback period, and the strength of the existing loop.
2. **Risks** — of the loop you propose and of continuing as-is.
3. **Recommendation** — the specific loop to build and how you would prove it works.`,
        supportingData: {
          unit_economics: {
            blended_cac: cac,
            arpu_monthly: arpu,
            gross_margin_pct: grossMargin,
            monthly_churn_pct: monthlyChurn,
            estimated_ltv: ltv,
            ltv_cac_ratio: Number((ltv / cac).toFixed(2)),
          },
          referral: {
            users_inviting_pct: inviteRate,
            invite_conversion_pct: inviteConversion,
            implied_k_factor: k,
          },
          trend: { cac_increase_18m_pct: cacIncrease18m },
        },
        expectedFramework: `1. **LTV** = ARPU × gross margin ÷ churn.
2. **LTV:CAC** and **payback period** = CAC ÷ (ARPU × margin).
3. **K-factor** = invite rate × conversion rate. K ≥ 1 is self-sustaining; below that the loop amplifies but does not replace paid.
4. **Identify the loop type** — viral, content, or paid-recycled.
5. **Find the weakest step** and fix that, rather than adding a new channel.`,
        modelAnswer: `**Unit economics.** LTV = ${c(arpu)} × ${grossMargin}% ÷ ${monthlyChurn}% = **${c(ltv)}**. Against a CAC of ${c(cac)}, LTV:CAC is **${(ltv / cac).toFixed(2)}**. Payback is ${c(cac)} ÷ (${c(arpu)} × ${grossMargin}%) = **${(cac / (arpu * (grossMargin / 100))).toFixed(1)} months**.

${ltv / cac > 3 ? `At ${(ltv / cac).toFixed(1)}×, the economics are healthy today — but the trend is the problem, not the level. CAC up ${cacIncrease18m}% over 18 months puts this ratio under 3× within a year or two if nothing changes.` : `At ${(ltv / cac).toFixed(1)}×, this is already below the 3× rule of thumb. Paid acquisition is close to unprofitable, and CAC is still rising. This is urgent rather than strategic.`}

**The existing loop.** K = ${inviteRate}% × ${inviteConversion}% = **${k}**. Every user brings ${k} new users. That is well below 1, so this is not self-sustaining growth — but that is the wrong bar to judge it against. A K of ${k} still reduces effective CAC by roughly ${(k * 100).toFixed(0)}%, because each paid user brings a fraction of a free one. Effective CAC becomes about ${c(Math.round(cac / (1 + k)))} rather than ${c(cac)}.

**Where the loop is weakest.** Only ${inviteRate}% of users invite anyone, while ${inviteConversion}% of invitations convert. The conversion step is working; the *initiation* step is not. Doubling invite rate from ${inviteRate}% to ${inviteRate * 2}% takes K to ${(k * 2).toFixed(3)} and cuts effective CAC to about ${c(Math.round(cac / (1 + k * 2)))}. Doubling the conversion rate instead achieves the same arithmetic — but conversion is already at ${inviteConversion}%, so there is less headroom, and improving the weaker step is usually cheaper.

**Loop design.** The failure mode of most referral programmes is bolting on an incentive and calling it a loop. The durable version makes sharing part of getting value from the product, not a favour to the company:
- **Trigger:** the moment a user completes the core action successfully — that is when they have something worth sharing.
- **Action:** sharing an artefact the recipient actually wants (a report, a workspace invite, a result), not a referral code.
- **Reward:** something that improves the sharer's own experience — collaboration, more capacity — rather than cash, which attracts the wrong users and stops working when it ends.
- **Return:** the recipient's signup creates a reason for the original user to come back.

**Recommendation.**
1. **Build the loop around the existing core action.** Instrument invite initiation as a first-class metric — right now it is not measured as a product event, only as an outcome.
2. **Target invite rate**, not conversion. Move ${inviteRate}% → ${Math.min(50, inviteRate * 2)}% over two quarters.
3. **Prove it as an experiment.** Holdout cohort, measure blended CAC and K, and only scale after two full cohorts. Referral metrics are unusually easy to fool yourself with, because early adopters of a share feature are the users who would have referred anyway.
4. **Do not cut paid yet.** The loop amplifies paid rather than replacing it at K = ${k}; cutting spend before the loop is proven turns a growth problem into a revenue problem.

**Risks.** Incentivised referrals attract users with worse retention, which would inflate signups while lowering LTV — so segment retention by acquisition source from day one. And if churn at ${monthlyChurn}% monthly is the real constraint, no acquisition loop compensates: at that rate the average user lasts ${(100 / monthlyChurn).toFixed(0)} months, and fixing retention would raise LTV more than any loop raises volume. I would run the retention diagnosis in parallel before committing a full quarter to growth mechanics.`,
      };
    },
  },
];

/** Compact currency helper — PM cases are geography-agnostic. */
function c(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}
