export interface FacultyResource {
  id: string;
  title: string;
  instructor: string;
  instructorRole: string;
  category: "Framework" | "Fast Math" | "Synthesis" | "Industry Primer";
  readingTime: string;
  summary: string;
  content: string;
  keyTakeaways: string[];
  recommendedCases: { title: string; slug: string }[];
}

export const FACULTY_RESOURCES: FacultyResource[] = [
  {
    id: "profitability-diagnostic-engine",
    title: "The Comprehensive Profitability Diagnostic Engine",
    instructor: "Prof. Sarah Lin",
    instructorRole: "Former McKinsey & Company Associate Partner",
    category: "Framework",
    readingTime: "5 min read",
    summary:
      "A systematic MECE framework for isolating top-line decline vs margin compression in consulting case interviews.",
    keyTakeaways: [
      "Always segment revenue into Price × Volume and decompose across product lines, regions, or customer channels before hypothesizing.",
      "Cost breakdown must distinguish Fixed vs Variable and identify whether cost increases are industry-wide (macro/commodities) or firm-specific (inefficiencies).",
      "Benchmark capacity utilization, breakeven quantity, and gross contribution margin.",
    ],
    recommendedCases: [
      { title: "Airline Route Profitability Diagnostic", slug: "airline-route-profitability-diagnostic" },
      { title: "Retail Margin Turnaround", slug: "retail-margin-turnaround" },
    ],
    content: `## 1. Problem Clarification & Scoping
When presented with a profitability decline:
- Clarify the magnitude: Has profit fallen in absolute terms, percentage margin, or both?
- Clarify the timeline: Is this a sudden cliff or a multi-quarter structural decay?
- Benchmark against the industry: Are competitors also hurting, or is our client uniquely bleeding?

## 2. Revenue Decomposition (Top-Line)
Profit = Revenue - Cost
Decompose Revenue into:
\`\`\`
Revenue = (Price × Volume)
\`\`\`
Segment Volume by:
- Customer Segments (B2B vs B2C, Enterprise vs SMB, Repeat vs New)
- Product Lines / SKUs (High margin flagships vs commoditized legacy units)
- Geographies & Distribution Channels (Direct-to-consumer, Retail distributors, Wholesale)

## 3. Cost Decomposition (Bottom-Line)
Decompose total costs into:
1. **Fixed Costs**: Overheads, SG&A, Plant & Machinery leases, IT infrastructure, R&D amortizations.
2. **Variable Costs**: Raw materials, direct labor, freight/shipping, per-unit packaging, merchant processing fees.

Determine whether variable costs increased per unit (inflation, supplier leverage, inefficiency) or fixed costs grew while capacity utilization plunged.

## 4. Synthesis & Strategic Levers
- **Revenue Levers**: Price optimization, cross-selling, renegotiating contract terms, churning low-margin accounts.
- **Cost Levers**: Supplier consolidation, labor scheduling optimization, automation, divestment of unprofitable facilities.`,
  },
  {
    id: "market-entry-feasibility-matrix",
    title: "Market Entry & International Expansion Playbook",
    instructor: "Dr. Michael Sterling",
    instructorRole: "Director of Case Practicum, Wharton & ex-BCG",
    category: "Framework",
    readingTime: "6 min read",
    summary:
      "The definitive 4-pillar playbook for evaluating new markets, geography expansions, and digital adjacencies.",
    keyTakeaways: [
      "Evaluate Market Attractiveness, Competitive Dynamics, Internal Capabilities, and Financial Viability.",
      "Compare 3 primary entry modes: Greenfield (organic build), Acquisition (M&A), and Strategic Joint Venture / Partnership.",
      "Always assess barrier-to-exit and regulatory compliance hurdles.",
    ],
    recommendedCases: [
      { title: "EV Battery Market Entry", slug: "ev-battery-market-entry" },
      { title: "Southeast Asia Fintech Expansion", slug: "southeast-asia-fintech-expansion" },
    ],
    content: `## The 4-Pillar Decision Matrix

### Pillar 1: Market Attractiveness
- Total Addressable Market (TAM), Serviceable Addressable Market (SAM), Serviceable Obtainable Market (SOM).
- Growth rate (CAGR over 5 years) and macroeconomic tailwinds.
- Customer willingness-to-pay and unmet consumer pain points.

### Pillar 2: Competitive Dynamics
- Number and market share of existing incumbents (fragmented vs oligopoly).
- Barriers to entry: Patent moats, distribution network monopolies, brand loyalty, switching costs.
- Expected competitor retaliation (price wars, exclusive retailer deals).

### Pillar 3: Capability Fit & Operational Feasibility
- Does the client have the supply chain, sales force, and brand equity to win?
- Local regulatory requirements, tariffs, licensing, data privacy laws.

### Pillar 4: Financial Payback & Entry Vehicle
1. **Build (Organic)**: Slowest, highest initial risk, full control, zero cultural friction.
2. **Buy (M&A)**: Instant scale, immediate customer base, expensive premium, high integration risk.
3. **Partner / JV**: Shared capital expenditure, local market knowledge, split profits, governance tension.`,
  },
  {
    id: "fast-consulting-math-shortcuts",
    title: "Fast Consulting Math: Mental Arithmetic & Sanity Checks",
    instructor: "Prof. Priya Sharma",
    instructorRole: "Bain & Company Principal & Interview Coach",
    category: "Fast Math",
    readingTime: "4 min read",
    summary:
      "Essential mental shortcuts for case interview math, percentages, compound growth, and market sizing sanity checks.",
    keyTakeaways: [
      "Use the Rule of 72 to immediately compute doubling periods at any compound growth rate.",
      "Convert messy division into nearby benchmark fractions (e.g. 1/7 ≈ 14.3%, 1/8 = 12.5%, 1/6 ≈ 16.7%).",
      "Round numbers thoughtfully, state your assumption out loud, and calibrate with order-of-magnitude bounds.",
    ],
    recommendedCases: [
      { title: "Cloud Data Center Capacity Sizing", slug: "cloud-data-center-capacity-sizing" },
      { title: "Quick-Commerce Dark Store Unit Economics", slug: "quick-commerce-dark-store-unit-economics" },
    ],
    content: `## 1. The Rule of 72 (Doubling Time)
To find how many years it takes for an investment, market, or company revenue to double:
\`\`\`
Years to double ≈ 72 / (Growth Rate %)
\`\`\`
- At 6% CAGR: Doubling time = 72 / 6 = 12 years.
- At 10% CAGR: Doubling time = 72 / 10 = 7.2 years.
- At 24% CAGR: Doubling time = 72 / 24 = 3 years.

## 2. Standard Demographic Benchmarks
Keep these figures memorized for rapid market estimations:
- **US Population**: ~340 million (~130M households; ~2.6 people per household).
- **Life Expectancy**: ~80 years (uniform age distribution ≈ 4.25M people per year of age).
- **Europe Population**: ~500 million (EU + UK).
- **India Population**: ~1.4 billion (300M urban middle-class consumers).
- **Global Population**: ~8 billion.

## 3. Margin & Markup Relationship
- Margin = (Price - Cost) / Price
- Markup = (Price - Cost) / Cost
- 50% Markup = 33.3% Margin.
- 100% Markup = 50% Margin.
- 25% Margin = 33.3% Markup.`,
  },
  {
    id: "pyramid-principle-synthesis",
    title: "The Pyramid Principle: Executive Case Synthesis",
    instructor: "Prof. Sarah Lin",
    instructorRole: "Former McKinsey & Company Associate Partner",
    category: "Synthesis",
    readingTime: "4 min read",
    summary:
      "How to deliver a crisp, top-down, answer-first recommendation that earns strong-hire ratings in partner interviews.",
    keyTakeaways: [
      "Lead with the punchline: Never walk the interviewer through chronological steps. State your direct recommendation in sentence one.",
      "Group supporting arguments into 3 MECE buckets: Financial returns, Strategic fit, and Operational feasibility.",
      "End proactively with Next Steps and 2-3 prominent Risks with concrete mitigations.",
    ],
    recommendedCases: [
      { title: "Hospital Diagnostic Automation Case", slug: "hospital-diagnostic-automation" },
      { title: "Luxury Fashion DTC Pivot", slug: "luxury-fashion-dtc-pivot" },
    ],
    content: `## The Answer-First (SCR) Architecture

### Structure of an Executive Recommendation:
1. **Direct Recommendation (Sentence 1)**:
   "We recommend that Client X proceed with the acquisition of Target Y for $450M."
2. **Key Supporting Reasons (The 'Because' - 3 Pillars)**:
   - **Financial Value**: "First, this acquisition generates $85M in annual EBITDA synergies within 24 months, delivering an IRR of 22%."
   - **Market Leadership**: "Second, it instantly secures a #1 position in the Pacific Northwest market with 42% combined market share."
   - **Defensive Moat**: "Third, it prevents Competitor B from securing Target Y's proprietary automated cold-chain logistics platform."
3. **Risks & Mitigations**:
   - "The primary risk is customer churn during the CRM transition; we recommend establishing a dedicated retention taskforce with contractual rebate guarantees for the top 50 accounts."
4. **Immediate Next Steps**:
   - "Next steps should focus on concluding commercial due diligence on supplier contracts and drafting the Day-1 integration roadmap."`,
  },
  {
    id: "saas-unit-economics-primer",
    title: "SaaS & Subscription Business Model Primer",
    instructor: "Dr. Michael Sterling",
    instructorRole: "Director of Case Practicum, Wharton & ex-BCG",
    category: "Industry Primer",
    readingTime: "5 min read",
    summary:
      "Core metrics, valuation drivers, and operating levers for tech, cloud, and subscription recurring revenue business cases.",
    keyTakeaways: [
      "Key formulas: CAC, LTV, LTV:CAC Ratio (> 3x healthy), CAC Payback Period (< 12 months).",
      "Net Revenue Retention (NRR): Over 110% indicates strong expansion and product-market fit.",
      "Rule of 40: Revenue Growth Rate + Free Cash Flow Margin should exceed 40%.",
    ],
    recommendedCases: [
      { title: "Enterprise SaaS Pricing Optimization", slug: "enterprise-saas-pricing-optimization" },
      { title: "Cloud Cybersecurity Growth Strategy", slug: "cloud-cybersecurity-growth-strategy" },
    ],
    content: `## 1. Core SaaS Formulas
\`\`\`
ARR = Monthly Recurring Revenue (MRR) × 12
CAC = (Total Sales & Marketing Costs) / (New Customers Acquired)
LTV = (Average Revenue Per User × Gross Margin %) / (Customer Churn Rate %)
CAC Payback = CAC / (Monthly ARPU × Gross Margin %)
\`\`\`

## 2. Health Thresholds
- **LTV : CAC**: 3x is standard. 5x+ may indicate under-investing in marketing. <2x is unsustainable.
- **CAC Payback Period**: 8-12 months for SMB SaaS; 14-18 months for Enterprise.
- **Net Revenue Retention (NRR)**:
  - Top quartile B2B SaaS: 120% - 140%.
  - < 100% means churn is eating away expansion revenue.

## 3. The Rule of 40
A key investor benchmark:
\`\`\`
Annual Revenue Growth (%) + Profit / FCF Margin (%) >= 40%
\`\`\`
High-growth startups might grow at 60% with -20% margin (40% sum), while mature companies might grow 15% with 25% margin.`,
  },
];
