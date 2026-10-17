/**
 * Preparation courses and curricula for proctored certificate exams.
 *
 * Each certification track provides a structured 4-module preparation course
 * that teaches the required frameworks, mental models, formulas, and rubrics
 * before a candidate sits for the timed, proctored examination.
 */

export interface CourseCaseRecommendation {
  slug: string;
  title: string;
  companyTrack: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes: number;
  focus: string;
}

export interface CourseModule {
  id: string;
  order: number;
  title: string;
  durationMinutes: number;
  summary: string;
  keyConcepts: string[];
  studyGuide: {
    overview: string;
    frameworkTitle: string;
    frameworkSteps: { step: string; detail: string }[];
    rulesOfThumb: string[];
    commonPitfalls: string[];
  };
  checkpoints: string[];
  recommendedCases: CourseCaseRecommendation[];
}

export interface CertCourse {
  examSlug: string;
  track: string;
  title: string;
  subtitle: string;
  description: string;
  estimatedHours: number;
  prerequisites: string[];
  targetAudience: string;
  modules: CourseModule[];
}

export const CERT_COURSES: Record<string, CertCourse> = {
  "consulting-case-certificate": {
    examSlug: "consulting-case-certificate",
    track: "Consulting",
    title: "Consulting Case Mastery & Strategic Structuring",
    subtitle: "A rigorous 4-module course covering MECE issue trees, unit economics, market entry strategy, and executive synthesis.",
    description:
      "Engineered by ex-MBB consultants to transition you from memorizing standard frameworks to developing first-principles problem-solving instincts. Master the exact structure, mental math, and executive communication required to pass the proctored exam and top-tier consulting interviews.",
    estimatedHours: 8,
    prerequisites: [
      "Basic understanding of business operations and financial revenue/cost drivers",
      "Comfort with mental business arithmetic and percentage changes",
    ],
    targetAudience: "Aspiring management consultants, strategy analysts, and corporate development professionals.",
    modules: [
      {
        id: "consulting-mod-1",
        order: 1,
        title: "Problem Structuring & MECE Issue Trees",
        durationMinutes: 90,
        summary: "Learn how to dissect ambiguous business problems into mutually exclusive, collectively exhaustive (MECE) branches with clear hypotheses.",
        keyConcepts: [
          "MECE Decomposition Principle",
          "Hypothesis-Driven Problem Solving (Pyramid Structuring)",
          "Profitability Trees & Value Driver Trees",
          "Clarifying Questions & Scope Definition",
        ],
        studyGuide: {
          overview:
            "Top consulting firms do not test your memory of frameworks; they test your ability to build tailored issue trees that systematically isolate root causes. A great structure is MECE, tailored to the specific client industry, and driven by an initial hypothesis.",
          frameworkTitle: "4-Step Tailored Structuring Process",
          frameworkSteps: [
            {
              step: "1. Scope & Objective Clarification",
              detail: "Clarify the core objective (e.g. 15% EBITDA drop vs cash crunch), client business model, and quantitative goal within the first 2 minutes.",
            },
            {
              step: "2. Root Hypothesis Formulation",
              detail: "State an initial working hypothesis based on the prompt before building your tree (e.g., 'Given that industry volumes are growing, the issue is likely client-specific margin compression').",
            },
            {
              step: "3. MECE Tree Construction",
              detail: "Break the problem down into 2–4 mutually exclusive branches. For profit drops: Revenue (Price × Volume by channel) vs Cost (Fixed vs Variable per unit).",
            },
            {
              step: "4. Prioritized Exploration",
              detail: "Tell the interviewer which branch you will investigate first and why, using your hypothesis as a compass.",
            },
          ],
          rulesOfThumb: [
            "Never use an off-the-shelf framework without customizing branch labels to the client's business model.",
            "Always state whether you expect the issue to be internal (company-specific) or external (market/competitor-wide).",
            "Keep trees to 2–3 levels of depth initially; avoid sprawling lists that cannot be systematically checked.",
          ],
          commonPitfalls: [
            "Jumping to solutions before isolating the root cause in the structure.",
            "Overlapping categories (violating MECE), which causes duplicated calculations and confusion.",
            "Failing to articulate the rationale for choosing which branch to test first.",
          ],
        },
        checkpoints: [
          "I can construct a tailored 3-level MECE profitability tree in under 90 seconds.",
          "I state a clear initial hypothesis before dividing into sub-branches.",
          "I can size an unfamiliar market using both top-down and bottom-up logic.",
        ],
        recommendedCases: [
          {
            slug: "market-sizing-1",
            title: "Market Sizing: Electric two-wheelers in Europe",
            companyTrack: "Amazon",
            difficulty: "easy",
            estimatedMinutes: 25,
            focus: "Top-down market sizing and demographic filtering",
          },
          {
            slug: "profitability-decline-1",
            title: "Vantage Analytics: Profits Down Despite Flat Revenue",
            companyTrack: "Morgan Stanley",
            difficulty: "easy",
            estimatedMinutes: 45,
            focus: "MECE cost decomposition and SaaS margin analysis",
          },
        ],
      },
      {
        id: "consulting-mod-2",
        order: 2,
        title: "Quantitative Business Analysis & Unit Economics",
        durationMinutes: 120,
        summary: "Master margin breakdown, contribution analysis, breakeven volume, price elasticity, and fast mental business math under pressure.",
        keyConcepts: [
          "Fixed vs. Variable Cost Segregation",
          "Contribution Margin & Breakeven Volume Math",
          "Price Elasticity of Demand & Revenue Sensitivity",
          "Operating Leverage & Marginal Cost Curves",
        ],
        studyGuide: {
          overview:
            "Exams and interviews test whether you can run the numbers cleanly without a spreadsheet, sanity-check order-of-magnitude results, and derive strategic insight from quantitative outputs.",
          frameworkTitle: "Unit Economics & Profit Sensitivity Formula Sheet",
          frameworkSteps: [
            {
              step: "Contribution Margin",
              detail: "CM = Price per Unit - Variable Cost per Unit. Contribution Margin Ratio = CM ÷ Price.",
            },
            {
              step: "Breakeven Units",
              detail: "Breakeven Volume = Total Fixed Costs ÷ Contribution Margin per Unit.",
            },
            {
              step: "Operating Leverage",
              detail: "Degree of Operating Leverage = Contribution Margin ÷ Operating Profit (EBIT). High leverage means small volume dips cause severe profit drops.",
            },
            {
              step: "Price Elasticity",
              detail: "e = (% Change in Quantity Demanded) ÷ (% Change in Price). If |e| < 1, price increases expand total revenue.",
            },
          ],
          rulesOfThumb: [
            "Round numbers sensibly during initial mental estimates (e.g. 21% -> 20%) to keep momentum, but state your rounding.",
            "Always interpret the number aloud: don't just say '14.2%'; say '14.2%, which is 400 bps below industry average'.",
            "Double check units: Cr vs Lakhs vs Millions vs Billions.",
          ],
          commonPitfalls: [
            "Treating semi-variable costs as purely fixed.",
            "Confusing markup on cost with margin on revenue (25% markup = 20% margin).",
            "Dropping calculation working in written answers; evaluators award points for methodology.",
          ],
        },
        checkpoints: [
          "I can calculate breakeven volume and margin of safety instantly.",
          "I verify whether fixed costs remain fixed across different capacity tiers.",
          "I always explain the business implication of a calculated metric.",
        ],
        recommendedCases: [
          {
            slug: "profitability-decline-2",
            title: "Tessellate: Profits Down Despite Flat Revenue",
            companyTrack: "Razorpay",
            difficulty: "medium",
            estimatedMinutes: 45,
            focus: "Segment-level contribution margin and customer churn",
          },
          {
            slug: "pricing-strategy-1",
            title: "Halcyon Bank: Can We Raise Prices 16%?",
            companyTrack: "Flipkart",
            difficulty: "hard",
            estimatedMinutes: 50,
            focus: "Price elasticity, churn modeling, and revenue sensitivity",
          },
        ],
      },
      {
        id: "consulting-mod-3",
        order: 3,
        title: "Growth Strategy, Market Entry & Competitive Dynamics",
        durationMinutes: 105,
        summary: "Evaluate new geographies, product adjacencies, organic vs. M&A entry vehicles, and competitive response models.",
        keyConcepts: [
          "Market Attractiveness (TAM, CAGR, Profit Pools)",
          "Competitive Landscape & Porter's 5 Forces Applied",
          "Entry Modes: Organic Build vs. M&A Acquisition vs. Joint Venture",
          "Synergies, Cannibalization & Payback Horizon",
        ],
        studyGuide: {
          overview:
            "When evaluating expansion or growth, candidates must balance market opportunity with company capabilities and execution risk. A recommendation to enter must address target customer segments, entry mode, and economic viability.",
          frameworkTitle: "Market Entry Evaluation Framework",
          frameworkSteps: [
            {
              step: "1. Market Attractiveness",
              detail: "Addressable market size (TAM/SAM), growth rate (CAGR), customer willingness to pay, and structural profit margins.",
            },
            {
              step: "2. Competitive Positioning",
              detail: "Incumbent concentration, defensible moats, barriers to entry (capital, regulatory, patents), and anticipated competitive response.",
            },
            {
              step: "3. Company Capabilities",
              detail: "Core competencies, distribution channels, technology transferability, and brand equity transfer.",
            },
            {
              step: "4. Financial & Implementation Viability",
              detail: "Upfront capital investment, expected payback period, ROI vs hurdle rate, and choice between Greenfield build, acquisition, or partnership.",
            },
          ],
          rulesOfThumb: [
            "A fast-growing market with strong incumbents and high capital requirements is often best entered via partnership or acquisition.",
            "Always account for cannibalization if the new offering overlaps with existing product lines.",
            "Factor in country-specific regulatory and supply chain constraints.",
          ],
          commonPitfalls: [
            "Recommending market entry purely because the market is large, without proving competitive advantage.",
            "Ignoring the time-to-market trade-offs between building in-house vs acquiring a local player.",
            "Overestimating market share capture in Year 1.",
          ],
        },
        checkpoints: [
          "I structure market entry evaluations across market, competition, client fit, and financial returns.",
          "I contrast Greenfield build, M&A, and Joint Ventures with explicit pros and cons.",
          "I analyze potential competitive retaliation.",
        ],
        recommendedCases: [
          {
            slug: "market-entry-1",
            title: "Should Bluepeak Logistics Enter Brazil?",
            companyTrack: "Morgan Stanley",
            difficulty: "medium",
            estimatedMinutes: 50,
            focus: "Geographic market entry, regulatory risk, and local partnerships",
          },
          {
            slug: "growth-strategy-1",
            title: "Granite Materials: Finding 12% Growth",
            companyTrack: "Bain",
            difficulty: "hard",
            estimatedMinutes: 45,
            focus: "Organic expansion vs adjacency diversification",
          },
        ],
      },
      {
        id: "consulting-mod-4",
        order: 4,
        title: "Synthesis, Executive Delivery & Partner Recommendation",
        durationMinutes: 90,
        summary: "Learn to synthesize complex analyses into concise, answer-first executive recommendations with risk mitigation roadmaps.",
        keyConcepts: [
          "The Pyramid Principle (Answer-First Communication)",
          "Three-Pillar Supporting Evidence Architecture",
          "Risk Matrix & Contingency Mitigation",
          "Immediate Next Steps & 100-Day Operational Roadmap",
        ],
        studyGuide: {
          overview:
            "A brilliant analysis fails if the recommendation is rambling or ambiguous. Partners and clients expect a definitive, action-oriented answer in the first 15 seconds, followed by structured proof points and risk hedging.",
          frameworkTitle: "Executive Recommendation Delivery Structure",
          frameworkSteps: [
            {
              step: "1. The Lead (Answer First)",
              detail: "State the core recommendation directly with specific numbers: 'We recommend entering the German solar market via a €45M bolt-on acquisition to achieve €18M EBITDA by Year 3.'",
            },
            {
              step: "2. The Three Pillars of Support",
              detail: "Provide 3 distinct reasons: 1) Market demand & return on capital, 2) Synergies & competitive advantage, 3) Feasibility & execution timeline.",
            },
            {
              step: "3. Key Risks & Mitigation Actions",
              detail: "Identify top 2 risks and how the client will mitigate them (e.g., 'To mitigate supply chain delays, lock in multi-year supplier contracts').",
            },
            {
              step: "4. Immediate Next Steps",
              detail: "Detail the concrete actions for the next 30 to 90 days (e.g. conduct vendor audit, begin regulatory filings).",
            },
          ],
          rulesOfThumb: [
            "Never hedge with 'It depends' without immediately defining what it depends on and giving your primary recommendation.",
            "Use active voice and precise figures rather than qualitative generalities.",
            "Keep the written synthesis structured with bold headers and bullet points.",
          ],
          commonPitfalls: [
            "Walking through the chronological story of how you solved the case instead of leading with the answer.",
            "Listing risks without concrete mitigation proposals.",
            "Failing to answer the specific question asked in the prompt.",
          ],
        },
        checkpoints: [
          "I can deliver a crisp 60-second answer-first synthesis.",
          "I always include specific metrics and a risk mitigation plan.",
          "I structure written answers for rapid executive scanning.",
        ],
        recommendedCases: [
          {
            slug: "operations-capacity-1",
            title: "Northwind Energy Cannot Meet Demand",
            companyTrack: "BCG",
            difficulty: "medium",
            estimatedMinutes: 45,
            focus: "Capacity bottleneck diagnosis and executive capital recommendation",
          },
          {
            slug: "pricing-strategy-2",
            title: "Lumen Learning: Can We Raise Prices 9%?",
            companyTrack: "Razorpay",
            difficulty: "medium",
            estimatedMinutes: 50,
            focus: "End-to-end pricing synthesis and board-ready deliverables",
          },
        ],
      },
    ],
  },

  "finance-case-certificate": {
    examSlug: "finance-case-certificate",
    track: "Finance",
    title: "Corporate Finance, Valuation & Capital Strategy",
    subtitle: "A rigorous 4-module curriculum covering 3-statement modeling, DCF mechanics, trading multiples, and M&A accretion/dilution.",
    description:
      "Designed for investment bankers, private equity analysts, and corporate finance leads. Master the core mechanics of corporate valuation, cash flow diagnostics, hurdle rates, and transaction math required to pass the proctored exam.",
    estimatedHours: 8,
    prerequisites: [
      "Familiarity with financial statements (Income Statement, Balance Sheet, Cash Flows)",
      "Understanding of time value of money, discount rates, and enterprise value",
    ],
    targetAudience: "Investment banking candidates, corporate finance associates, and private equity professionals.",
    modules: [
      {
        id: "finance-mod-1",
        order: 1,
        title: "Three-Statement Linkages & Cash Flow Forensics",
        durationMinutes: 105,
        summary: "Master the mechanics connecting net income, working capital, Capex, and debt schedules across the 3 core statements.",
        keyConcepts: [
          "Income Statement to Cash Flow Bridge",
          "Working Capital Requirements & Cash Drag",
          "EBITDA vs. Free Cash Flow (FCF) Distinctions",
          "Profitability vs. Solvency Diagnostics",
        ],
        studyGuide: {
          overview:
            "Profitable companies routinely go bankrupt from negative operating cash flows and poor working capital management. You must master how revenue recognition, inventory turnover, and DPO/DSO dictate actual cash viability.",
          frameworkTitle: "Cash Flow Reconstruction Architecture",
          frameworkSteps: [
            {
              step: "1. Operating Cash Flow (CFO)",
              detail: "Net Income + Non-Cash Charges (D&A, Stock-based comp) - Change in Net Working Capital (Accounts Receivable, Inventory, Accounts Payable).",
            },
            {
              step: "2. Investing Cash Flow (CFI)",
              detail: "Capital Expenditures (Capex) + Asset Acquisitions / Disposals.",
            },
            {
              step: "3. Financing Cash Flow (CFF)",
              detail: "Debt Issuance / Repayment + Equity Raised / Share Repurchases - Dividends Paid.",
            },
            {
              step: "4. Free Cash Flow (FCF)",
              detail: "Unlevered FCF = NOPAT + D&A - Capex - Change in NWC. Levered FCF = CFO - Capex - Mandatory Debt Repayments.",
            },
          ],
          rulesOfThumb: [
            "An increase in an asset is a cash outflow; an increase in a liability is a cash inflow.",
            "High DSO (Days Sales Outstanding) paired with rising inventory is the #1 early indicator of liquidity failure.",
            "Never confuse accounting EBITDA with true cash flow; Capex and working capital must always be accounted for.",
          ],
          commonPitfalls: [
            "Double-counting depreciation when adjusting both operating profit and capital assets.",
            "Ignoring interest expense tax shields when deriving NOPAT.",
            "Assuming profitable growth automatically creates positive cash flows.",
          ],
        },
        checkpoints: [
          "I can explain every line connecting Net Income to ending cash on the balance sheet.",
          "I diagnose working capital imbalances (DSO, DIO, DPO).",
          "I know the exact difference between Levered and Unlevered Free Cash Flow.",
        ],
        recommendedCases: [
          {
            slug: "statement-diagnosis-2",
            title: "Verity Insurance Is Profitable and Nearly Out of Cash",
            companyTrack: "McKinsey",
            difficulty: "easy",
            estimatedMinutes: 30,
            focus: "Reconciling net profit with severe operating cash drain",
          },
          {
            slug: "statement-diagnosis-3",
            title: "Kirana Connect Is Profitable and Nearly Out of Cash",
            companyTrack: "BCG",
            difficulty: "easy",
            estimatedMinutes: 30,
            focus: "Working capital cycle and inventory holding cost analysis",
          },
        ],
      },
      {
        id: "finance-mod-2",
        order: 2,
        title: "DCF Modeling & Cost of Capital (WACC)",
        durationMinutes: 120,
        summary: "Construct intrinsic valuation models using Unlevered Free Cash Flows, CAPM beta de-levering, and terminal value methodologies.",
        keyConcepts: [
          "Unlevered Free Cash Flow (UFCF) Forecasting",
          "WACC: Cost of Equity (CAPM) and After-Tax Cost of Debt",
          "Beta Unlevering & Re-levering Mechanics",
          "Terminal Value: Gordon Growth vs. Exit Multiple Method",
        ],
        studyGuide: {
          overview:
            "Discounted Cash Flow (DCF) calculates the intrinsic value of an enterprise by discounting projected future cash flows at the company's weighted average cost of capital (WACC).",
          frameworkTitle: "DCF & WACC Formula Blueprint",
          frameworkSteps: [
            {
              step: "Cost of Equity (Ke)",
              detail: "Ke = Risk-Free Rate (Rf) + Beta (β) × Equity Risk Premium (ERP).",
            },
            {
              step: "Beta Adjustments",
              detail: "Unlevered Beta = Levered Beta ÷ [1 + (1 - Tax Rate) × (Debt / Equity)]. Re-lever for target capital structure.",
            },
            {
              step: "WACC Formula",
              detail: "WACC = (E/V × Ke) + (D/V × Kd × (1 - Tax Rate)), where V = E + D.",
            },
            {
              step: "Terminal Value (TV)",
              detail: "Gordon Growth: TV = [FCF_final × (1 + g)] ÷ (WACC - g). Exit Multiple: TV = Final EBITDA × EV/EBITDA multiple.",
            },
          ],
          rulesOfThumb: [
            "Terminal value typically represents 60%–85% of total enterprise value in a DCF; verify sensitivity to terminal growth (g) and WACC.",
            "Perpetual growth rate (g) should never exceed the long-term GDP growth rate of the operating economy (typically 2%–3% developed, 4%–6% emerging).",
            "Enterprise Value (EV) = Market Value of Equity + Total Debt + Preferred Stock + Minority Interest - Cash & Equivalents.",
          ],
          commonPitfalls: [
            "Discounting levered cash flows using WACC (levered cash flows must use Cost of Equity Ke).",
            "Mismatching mid-year discounting conventions.",
            "Forgetting to subtract net debt from Enterprise Value to arrive at Implied Equity Value.",
          ],
        },
        checkpoints: [
          "I can calculate WACC and de-lever/re-lever industry betas.",
          "I compute Enterprise Value to Equity Value bridges accurately.",
          "I run sensitivity tables on WACC vs terminal growth rates.",
        ],
        recommendedCases: [
          {
            slug: "dcf-valuation-2",
            title: "Valuing Pallas Pharma: A Five-Year DCF",
            companyTrack: "Bain",
            difficulty: "hard",
            estimatedMinutes: 60,
            focus: "Full 5-year UFCF projection, WACC calculation, and terminal valuation",
          },
          {
            slug: "dcf-valuation-3",
            title: "Valuing Quantile Capital: A Five-Year DCF",
            companyTrack: "Goldman Sachs",
            difficulty: "medium",
            estimatedMinutes: 60,
            focus: "Asset management cash flow forecasting and discount rate selection",
          },
        ],
      },
      {
        id: "finance-mod-3",
        order: 3,
        title: "Trading & Transaction Comparables (Comps)",
        durationMinutes: 90,
        summary: "Select peer groups, calculate standardized valuation multiples (EV/EBITDA, P/E, EV/Sales), and adjust for non-recurring items.",
        keyConcepts: [
          "Peer Universe Selection & Operational Benchmarking",
          "Enterprise Value Multiples (EV/EBITDA, EV/EBIT, EV/ARR)",
          "Equity Value Multiples (P/E, Price/Book)",
          "Multiples Normalization & Control Premiums",
        ],
        studyGuide: {
          overview:
            "Comps valuation provides market-based relative valuation. Trading comps reflect current public market pricing, while precedent transactions reflect prices paid for control, including acquisition premiums.",
          frameworkTitle: "Comparables Valuation Methodology",
          frameworkSteps: [
            {
              step: "1. Peer Selection",
              detail: "Filter peers by sector, geography, size, margin profile, growth rate, and capital intensity.",
            },
            {
              step: "2. Multiple Selection",
              detail: "Use EV multiples for capital-structure-neutral comparisons (EV/EBITDA). Use P/E for financial institutions or equity investor views.",
            },
            {
              step: "3. Multiples Calculation",
              detail: "Standardize LTM (Last Twelve Months) and NTM (Next Twelve Months) metrics, eliminating one-off gains/losses.",
            },
            {
              step: "4. Range Formulation",
              detail: "Apply 25th percentile, median, and 75th percentile multiples to client financial metrics to establish a valuation football field.",
            },
          ],
          rulesOfThumb: [
            "Precedent transaction multiples are typically 15%–30% higher than public trading comps due to control premiums and expected synergies.",
            "Never compare unadjusted gross numbers across companies with different lease accounting or depreciation policies.",
            "Fast-growing SaaS companies are valued on EV/ARR; asset-heavy manufacturers on EV/EBITDA or P/B.",
          ],
          commonPitfalls: [
            "Mixing enterprise multiples with equity denominators (e.g. EV ÷ Net Income).",
            "Blindly averaging peer multiples without removing extreme outliers.",
            "Ignoring differences in capital structure when comparing P/E ratios.",
          ],
        },
        checkpoints: [
          "I know which multiple is appropriate for each industry model.",
          "I can construct a valuation football field across DCF, Comps, and Precedents.",
          "I properly adjust for control premiums and non-recurring items.",
        ],
        recommendedCases: [
          {
            slug: "comps-valuation-2",
            title: "What Is Cobalt Robotics Worth? A Comparables Analysis",
            companyTrack: "Stripe",
            difficulty: "medium",
            estimatedMinutes: 40,
            focus: "Public trading comps, multiple normalization, and valuation range",
          },
          {
            slug: "comps-valuation-3",
            title: "What Is Nimbus Health Worth? A Comparables Analysis",
            companyTrack: "Google",
            difficulty: "medium",
            estimatedMinutes: 40,
            focus: "High-growth healthcare multiples and peer universe benchmarking",
          },
        ],
      },
      {
        id: "finance-mod-4",
        order: 4,
        title: "Capital Budgeting & M&A Accretion/Dilution",
        durationMinutes: 105,
        summary: "Evaluate capital projects using NPV/IRR and analyze strategic acquisitions for earnings accretion, debt capacity, and synergies.",
        keyConcepts: [
          "Net Present Value (NPV) & Internal Rate of Return (IRR)",
          "Payback Period & Hurdle Rate Benchmarking",
          "Pro-Forma M&A Accretion / Dilution Analysis",
          "Financing Mix: Cash vs. Stock vs. Debt",
        ],
        studyGuide: {
          overview:
            "Corporate capital allocation requires choosing between competing projects with finite budgets, and evaluating whether an acquisition will enhance or destroy shareholder earnings per share (EPS).",
          frameworkTitle: "Investment Appraisal & M&A Decision Framework",
          frameworkSteps: [
            {
              step: "1. NPV & IRR Decision Rule",
              detail: "Accept projects where NPV > 0 and IRR > WACC. If projects are mutually exclusive, choose the highest positive NPV.",
            },
            {
              step: "2. M&A Financing Structure",
              detail: "Cost of Cash = Foregone interest on cash × (1 - t). Cost of Debt = Pre-tax cost of debt × (1 - t). Cost of Equity = Reciprocal of Buyer's P/E ratio.",
            },
            {
              step: "3. Accretion / Dilution Math",
              detail: "Pro-Forma EPS = (Buyer Net Income + Target Net Income + After-Tax Synergies - After-Tax Interest on Debt) ÷ New Total Shares.",
            },
            {
              step: "4. Balance Sheet Impact",
              detail: "Verify post-deal leverage ratios: Debt / EBITDA should remain within prudent limits (< 3.0x–4.0x).",
            },
          ],
          rulesOfThumb: [
            "In a 100% stock deal: If Buyer P/E > Target P/E, the transaction is accretive to EPS.",
            "In debt/cash deals: Compare the after-tax cost of debt/cash against the Target's earnings yield (Target Net Income ÷ Purchase Price).",
            "Be conservative with cost synergies; delay revenue synergies to Years 2–3.",
          ],
          commonPitfalls: [
            "Favoring a project with higher IRR but smaller absolute NPV when capital is unconstrained.",
            "Assuming EPS accretion automatically implies value creation (accretion can happen by taking on risky leverage).",
            "Failing to account for transaction and integration advisory fees.",
          ],
        },
        checkpoints: [
          "I can calculate NPV and explain IRR reinvestment rate assumptions.",
          "I calculate pro-forma EPS accretion/dilution and required breakeven synergies.",
          "I determine debt serviceability and interest coverage ratios post-acquisition.",
        ],
        recommendedCases: [
          {
            slug: "npv-irr-project-2",
            title: "Lumen Learning: Two Projects, One Budget",
            companyTrack: "Stripe",
            difficulty: "medium",
            estimatedMinutes: 40,
            focus: "Mutually exclusive capital allocation under budget constraints",
          },
          {
            slug: "ma-accretion-2",
            title: "Basil & Co Acquires a Rival: Accretive or Not?",
            companyTrack: "Google",
            difficulty: "medium",
            estimatedMinutes: 55,
            focus: "M&A financing mix, pro-forma EPS impact, and synergy thresholds",
          },
        ],
      },
    ],
  },

  "product-marketing-certificate": {
    examSlug: "product-marketing-certificate",
    track: "Product & Marketing",
    title: "Product Strategy, Growth Loops & Go-To-Market",
    subtitle: "A rigorous 4-module curriculum covering user discovery, AARRR metric funnels, RICE prioritization, and commercial launch execution.",
    description:
      "Built for product managers, growth leads, and marketing strategists. Master user journey dissection, metric drop root-cause diagnosis, feature trade-offs, and multi-channel go-to-market strategies required to pass the proctored exam.",
    estimatedHours: 8,
    prerequisites: [
      "Understanding of modern software/consumer product metrics (DAU, WAU, Retention, Churn)",
      "Basic grasp of acquisition funnels and digital marketing channels",
    ],
    targetAudience: "Product managers, associate PMs, product marketing managers, and growth strategists.",
    modules: [
      {
        id: "product-mod-1",
        order: 1,
        title: "Product Discovery, User Segmentation & Problem Framing",
        durationMinutes: 90,
        summary: "Identify high-value user problems through Jobs-To-Be-Done (JTBD), behavioral segmentation, and customer empathy mapping.",
        keyConcepts: [
          "Jobs-To-Be-Done (JTBD) Framework",
          "Behavioral vs. Demographic User Segmentation",
          "User Journey & Friction Point Mapping",
          "Problem Validation & Solution Space Boundaries",
        ],
        studyGuide: {
          overview:
            "Great product managers fall in love with the problem, not their initial solution. You must demonstrate how to segment users based on core motivations and identify where the highest-friction drop-offs occur.",
          frameworkTitle: "Problem Framing & Discovery Workflow",
          frameworkSteps: [
            {
              step: "1. Persona & Context Identification",
              detail: "Define the specific user persona experiencing the problem (e.g. power users vs casual mobile browse users).",
            },
            {
              step: "2. The 'Job to Be Done' (JTBD)",
              detail: "Articulate the functional, social, and emotional job: 'When [situation], I want to [motivation], so that [outcome].'",
            },
            {
              step: "3. Current Workarounds & Pain Points",
              detail: "Analyze how users solve the problem today and quantify the cost of friction (wasted time, money, or abandoned tasks).",
            },
            {
              step: "4. Success Metrics & Guardrails",
              detail: "Define what success looks like for the user and for the business before proposing technical solutions.",
            },
          ],
          rulesOfThumb: [
            "Prioritize problems that are frequent, painful, and directly tied to retention or willingness to pay.",
            "Segment by user intent and frequency, not just demographic buckets.",
            "Always state trade-offs: solving for power users often complicates the onboarding for new users.",
          ],
          commonPitfalls: [
            "Proposing a feature solution before diagnosing the underlying user need.",
            "Treating all users as a monolithic cohort.",
            "Confusing user requests with underlying user problems.",
          ],
        },
        checkpoints: [
          "I can frame any product challenge using the Jobs-To-Be-Done model.",
          "I define clear user personas with quantifiable pain points.",
          "I map user journeys from discovery to habitual use.",
        ],
        recommendedCases: [
          {
            slug: "metric-drop-1",
            title: "Vantage Analytics: Trial-to-paid conversion Dropped 23%",
            companyTrack: "Goldman Sachs",
            difficulty: "easy",
            estimatedMinutes: 40,
            focus: "Onboarding friction diagnosis and behavioral drop-off analysis",
          },
          {
            slug: "metric-drop-2",
            title: "Tessellate: Checkout completion rate Dropped 27%",
            companyTrack: "BCG",
            difficulty: "easy",
            estimatedMinutes: 40,
            focus: "Funnel leak analysis and developer checkout usability",
          },
        ],
      },
      {
        id: "product-mod-2",
        order: 2,
        title: "Metrics Hierarchy, Funnels & Retention Loops",
        durationMinutes: 105,
        summary: "Diagnose metric drops, establish North Star metric trees, evaluate cohort retention curves, and calculate LTV/CAC ratios.",
        keyConcepts: [
          "North Star Metric & Supporting Input Metrics",
          "AARRR Funnel (Acquisition, Activation, Retention, Referral, Revenue)",
          "Cohort Retention Curves & Asymptote Analysis",
          "LTV, CAC, Payback Period & Unit Economics",
        ],
        studyGuide: {
          overview:
            "A product metric drop is never a single mystery number; it is an outcome of an upstream funnel shift. You must know how to structure an investigative tree across cohorts, platforms, and release versions to isolate the driver.",
          frameworkTitle: "Metric Drop Investigation Protocol",
          frameworkSteps: [
            {
              step: "1. Clarify & Isolate",
              detail: "Clarify timeline (gradual vs sudden cliff), platform (iOS vs Android vs Web), user type (new vs existing), and geography.",
            },
            {
              step: "2. Funnel Step Breakdown",
              detail: "Trace the user funnel: Impressions -> Landing -> Sign-up -> Activation -> First Transaction. Which specific transition dropped?",
            },
            {
              step: "3. Internal Factor Audit",
              detail: "Check for new code releases, tracking bugs, pricing changes, broken third-party APIs, or UX redesigns.",
            },
            {
              step: "4. External Factor Audit",
              detail: "Check for seasonality, competitor promotions, regulatory shifts, ad channel fatigue, or macroeconomic events.",
            },
          ],
          rulesOfThumb: [
            "A healthy product has a retention curve that flattens out (asymptote above 0). A curve heading to zero means no product-market fit.",
            "LTV / CAC ratio should be > 3x, with CAC payback period < 12 months for consumer, < 18 months for B2B SaaS.",
            "Never pick a vanity metric (e.g. total signups) as your North Star; pick a metric measuring core value delivered (e.g. weekly active teams completing tasks).",
          ],
          commonPitfalls: [
            "Assuming a metric drop is a marketing problem when the issue is in-product activation.",
            "Overlooking tracking/logging bugs as the cause of sudden step-function metric shifts.",
            "Optimizing for short-term conversion at the expense of 90-day retention.",
          ],
        },
        checkpoints: [
          "I can systematically debug any metric drop across internal and external factors.",
          "I can construct a complete North Star metric hierarchy with leading inputs.",
          "I calculate LTV, CAC, and payback periods from first principles.",
        ],
        recommendedCases: [
          {
            slug: "retention-diagnosis-1",
            title: "Halcyon Bank: Users Sign Up and Disappear",
            companyTrack: "Bain",
            difficulty: "hard",
            estimatedMinutes: 45,
            focus: "Cohort retention diagnosis and habit-loop formation",
          },
          {
            slug: "retention-diagnosis-2",
            title: "Lumen Learning: Users Sign Up and Disappear",
            companyTrack: "McKinsey",
            difficulty: "hard",
            estimatedMinutes: 45,
            focus: "SaaS engagement decay and churn root-cause analysis",
          },
        ],
      },
      {
        id: "product-mod-3",
        order: 3,
        title: "Feature Prioritization & Trade-Off Roadmapping",
        durationMinutes: 105,
        summary: "Make disciplined feature trade-offs under fixed engineering capacity using RICE scoring, Kano classification, and MVP scoping.",
        keyConcepts: [
          "RICE Framework (Reach, Impact, Confidence, Effort)",
          "The Kano Model (Must-Haves, Performance, Delighters)",
          "Technical Debt vs. Feature Development Trade-offs",
          "MVP Definition & Phase 1 Scope Reductions",
        ],
        studyGuide: {
          overview:
            "Product management is the art of saying 'no'. With engineering resources constrained, you must evaluate candidate features transparently, quantify trade-offs, and align technical complexity with strategic business goals.",
          frameworkTitle: "RICE Prioritization Architecture",
          frameworkSteps: [
            {
              step: "Reach (R)",
              detail: "How many users will this feature impact within a defined time period (e.g. users per month)?",
            },
            {
              step: "Impact (I)",
              detail: "How much will this feature increase value for individual users? (3 = massive, 2 = high, 1 = medium, 0.5 = low).",
            },
            {
              step: "Confidence (C)",
              detail: "How confident are you in your estimates based on customer research or data? (100% = high, 80% = medium, 50% = low).",
            },
            {
              step: "Effort (E)",
              detail: "Total person-months of engineering, design, and QA required (e.g. 3 person-months).",
            },
          ],
          rulesOfThumb: [
            "RICE Score = (Reach × Impact × Confidence) ÷ Effort. Rank features to balance quick wins with strategic bets.",
            "Always reserve 20%–25% of engineering capacity for bug fixes, infrastructure stability, and technical debt.",
            "A Minimum Viable Product (MVP) should be minimum in scope, but complete in quality for the target use case.",
          ],
          commonPitfalls: [
            "Inflating Confidence scores without user research or data to back them up.",
            "Prioritizing solely based on highest revenue requests without considering implementation effort.",
            "Building an MVP that does 5 things poorly instead of 1 core workflow exceptionally well.",
          ],
        },
        checkpoints: [
          "I score and rank feature backlogs using RICE and Kano frameworks.",
          "I articulate strategic trade-offs when denying high-profile stakeholder requests.",
          "I define crisp MVP feature boundaries and launch criteria.",
        ],
        recommendedCases: [
          {
            slug: "prioritization-1",
            title: "Bluepeak Logistics: One Quarter, Five Demands",
            companyTrack: "McKinsey",
            difficulty: "medium",
            estimatedMinutes: 40,
            focus: "Engineering capacity budgeting and high-stakes feature trade-offs",
          },
          {
            slug: "prioritization-2",
            title: "Pallas Pharma: One Quarter, Five Demands",
            companyTrack: "BCG",
            difficulty: "medium",
            estimatedMinutes: 40,
            focus: "Stakeholder management, regulatory compliance, and roadmap cuts",
          },
        ],
      },
      {
        id: "product-mod-4",
        order: 4,
        title: "Go-To-Market (GTM), Pricing & Launch Strategy",
        durationMinutes: 90,
        summary: "Execute product launches across channel selection, positioning messaging, pricing tier design, and early adoption loops.",
        keyConcepts: [
          "Value Proposition Canvas & Positioning Messaging",
          "Distribution Channels (Organic, Paid, Virality, Sales-Led)",
          "Pricing Architecture: Freemium, Usage-Based, Tiered Plans",
          "Phased Rollout Strategy & Launch Risk Mitigation",
        ],
        studyGuide: {
          overview:
            "A product launch fails when great software meets poor distribution. A comprehensive GTM plan coordinates target audience positioning, pricing incentives, sales enablement, and rollout phases to maximize initial adoption velocity.",
          frameworkTitle: "Comprehensive Go-To-Market Blueprint",
          frameworkSteps: [
            {
              step: "1. Positioning & Value Prop",
              detail: "For [target customer], who [statement of need], our product is a [category] that [key benefit]. Unlike [alternative], our product [differentiator].",
            },
            {
              step: "2. Channel Strategy",
              detail: "Select primary and secondary distribution channels based on where the target audience congregates (e.g. content SEO, developer communities, direct enterprise sales).",
            },
            {
              step: "3. Pricing & Packaging",
              detail: "Design tiers aligned to value metrics (e.g. seats, storage, API calls). Ensure pricing communicates product tier quality.",
            },
            {
              step: "4. Phased Rollout Plan",
              detail: "Alpha (internal) -> Closed Beta (design partners) -> Public Beta / Soft Launch -> Full Global Availability.",
            },
          ],
          rulesOfThumb: [
            "Always include rollback criteria: if server latency exceeds 500ms or error rate exceeds 1%, halt the staged rollout.",
            "Ensure the pricing metric scales with customer value (as the customer grows, their usage and spending scale naturally).",
            "Pair qualitative feedback loops (customer interviews) with quantitative metrics (activation rates) during the first 14 days post-launch.",
          ],
          commonPitfalls: [
            "Launching to 100% of the user base on Day 1 without a canary / percentage rollout.",
            "Focusing exclusively on marketing buzz rather than customer onboarding activation.",
            "Failing to train support, documentation, and sales teams prior to public announcement.",
          ],
        },
        checkpoints: [
          "I can author a complete GTM plan spanning positioning, pricing, and distribution.",
          "I define staged canary rollout schedules with clear rollback triggers.",
          "I design sustainable viral loops and customer referral mechanisms.",
        ],
        recommendedCases: [
          {
            slug: "product-launch-1",
            title: "Northwind Energy: Launching the New Tier",
            companyTrack: "McKinsey",
            difficulty: "medium",
            estimatedMinutes: 40,
            focus: "Premium tier launch, customer cannibalization, and GTM enablement",
          },
          {
            slug: "growth-loop-1",
            title: "Granite Materials: Paid Growth Is Getting Expensive",
            companyTrack: "Razorpay",
            difficulty: "medium",
            estimatedMinutes: 45,
            focus: "Organic growth loops, referral incentives, and CAC reduction",
          },
        ],
      },
    ],
  },
};

/** Get the course curriculum associated with an exam slug */
export function getCertCourse(examSlug: string): CertCourse | null {
  return CERT_COURSES[examSlug] ?? null;
}
