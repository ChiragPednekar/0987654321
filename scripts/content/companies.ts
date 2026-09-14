import type { CompanyRound, CompanySector, PracticeLink } from "../../src/lib/companies";

/**
 * Company profiles.
 *
 * Written as guidance, and deliberately cautious. Every process here is the
 * widely reported shape of a firm's campus hiring, and every firm varies it by
 * year, campus, office and role — so rounds say "typically" and "in some
 * years", and nothing states a cut-off, a salary, a seat count or a test's
 * exact format, all of which change and would be wrong by next season.
 *
 * What is certain is the practice link: that is this platform's own content,
 * and the seeder checks every href resolves to a real section.
 *
 * Questions actually asked are not written here. They come only from students,
 * through company_question_reports, and only once approved.
 */

export interface CompanySeed {
  slug: string;
  name: string;
  sector: CompanySector;
  roles: string[];
  summary: string;
  rounds: CompanyRound[];
  lookFor: string[];
  practice: PracticeLink[];
}

const MBB_CASES: PracticeLink = {
  label: "MBB-style cases",
  href: "/cases?firm=MBB-style",
  why: "Interviewer-led and candidate-led cases in the style these firms are known for.",
};
const GUESSTIMATES: PracticeLink = {
  label: "Guesstimates",
  href: "/cases?format=guesstimate",
  why: "Market sizing turns up inside cases and on its own.",
};
const DRILLS: PracticeLink = {
  label: "Math drills",
  href: "/cases?format=drill",
  why: "Case math is done out loud and fast; a slip is noticed.",
};
const HR_INTERVIEW: PracticeLink = {
  label: "HR & personal interview",
  href: "/interview",
  why: "Leadership and fit stories, with follow-ups that dig into what you personally did.",
};
const RESUME: PracticeLink = {
  label: "Resume critique",
  href: "/resume",
  why: "Shortlists are made from the CV before anyone speaks to you.",
};
const GD: PracticeLink = {
  label: "Group discussions",
  href: "/gd",
  why: "Many campus processes still open with a GD or a group exercise.",
};
const APTITUDE: PracticeLink = {
  label: "Aptitude",
  href: "/practice",
  why: "Online tests screen before interviews in many campus processes.",
};
const DAILY: PracticeLink = {
  label: "Daily current affairs",
  href: "/daily",
  why: "Banking and policy news comes up in interviews and GDs.",
};
const PM_CASES: PracticeLink = {
  label: "Big Tech PM-style cases",
  href: "/cases?firm=Big%20Tech%20PM-style",
  why: "Product sense, design and strategy questions in the style these firms use.",
};
const RCA: PracticeLink = {
  label: "Root cause analysis",
  href: "/cases?format=rca",
  why: "\"A metric dropped — why?\" is a staple of product and analytics rounds.",
};
const MARKETING: PracticeLink = {
  label: "Marketing cases",
  href: "/cases?domain=marketing",
  why: "Brand, pricing and go-to-market problems.",
};
const BRAND_TEARDOWN: PracticeLink = {
  label: "Brand teardowns",
  href: "/cases?format=brand_teardown",
  why: "Taking apart a brand's positioning is a common marketing-interview exercise.",
};
const IB_CASES: PracticeLink = {
  label: "Investment Banking-style cases",
  href: "/cases?firm=Investment%20Banking-style",
  why: "Valuation, deal and markets problems.",
};
const FINANCE_CONCEPTS: PracticeLink = {
  label: "Finance concepts",
  href: "/practice/finance_concepts",
  why: "Short technical questions on valuation, markets and corporate finance.",
};
const ACCOUNTING: PracticeLink = {
  label: "Accounting",
  href: "/practice/accounting",
  why: "The three statements and how they link are asked directly.",
};
const STOCK_PITCH: PracticeLink = {
  label: "Stock pitches",
  href: "/cases?format=stock_pitch",
  why: "\"Pitch me a stock\" is common for markets and research roles.",
};
const OPERATIONS: PracticeLink = {
  label: "Operations cases",
  href: "/cases?domain=operations",
  why: "Supply chain, capacity and cost problems.",
};
const SQL: PracticeLink = {
  label: "SQL",
  href: "/sql",
  why: "Analytical and product roles increasingly test data skills.",
};
const EXCEL: PracticeLink = {
  label: "Excel",
  href: "/excel",
  why: "Lookups and conditional sums are tested at the desk.",
};
const STRATEGY: PracticeLink = {
  label: "Strategy cases",
  href: "/cases?domain=strategy",
  why: "Growth, entry and portfolio questions for general-management tracks.",
};
const SIMULATION: PracticeLink = {
  label: "Business simulation",
  href: "/simulation",
  why: "Running a P&L over several quarters builds the commercial instinct GM panels probe.",
};

const PRODUCT_SENSE: PracticeLink = {
  label: "Product sense",
  href: "/cases?format=product_sense",
  why: "Choose a user, find the need, design and prioritise — the core product round.",
};
const METRICS: PracticeLink = {
  label: "Metrics",
  href: "/cases?format=metrics",
  why: "North-star and guardrail questions are standard in product interviews.",
};
const RESEARCH_NOTE: PracticeLink = {
  label: "Research notes",
  href: "/cases?format=research_note",
  why: "A rating, a target price and the thesis, with the valuation shown.",
};
const VALUATION_MODELS: PracticeLink = {
  label: "Valuation models",
  href: "/cases?format=model",
  why: "Build a DCF and trading comps cell by cell, graded on the numbers.",
};
const GTM: PracticeLink = {
  label: "Go-to-market plans",
  href: "/cases?format=gtm_plan",
  why: "Launching a product to a chosen segment through the right channels.",
};
const CAMPAIGN: PracticeLink = {
  label: "Campaign critiques",
  href: "/cases?format=campaign_critique",
  why: "Reading a campaign's real results, beyond reach and impressions.",
};

export const COMPANIES: CompanySeed[] = [
  // ---- Consulting ---------------------------------------------------------
  {
    slug: "mckinsey",
    name: "McKinsey & Company",
    sector: "Consulting",
    roles: ["Associate", "Summer Associate"],
    summary:
      "Hires generalist consultants through a CV shortlist and several rounds of case interviews. Each interview usually pairs a case with questions about your own experiences.",
    rounds: [
      { name: "CV shortlist", detail: "Academic record, work experience and evidence of leadership and impact." },
      { name: "Problem-solving assessment", detail: "In some years and offices, a digital assessment before interviews." },
      { name: "Case interviews", detail: "Typically several rounds. Cases are often interviewer-led: you are taken through a sequence of questions on structure, data and a recommendation." },
      { name: "Experience questions", detail: "Inside the same interviews, detailed probing of a few stories — leading others, having an impact, pushing something through." },
    ],
    lookFor: [
      "A clear, hypothesis-driven structure you can adapt as data arrives",
      "Accurate arithmetic spoken out loud",
      "Synthesis: a recommendation, not a summary",
      "Stories where your personal role and the outcome are specific",
    ],
    practice: [MBB_CASES, DRILLS, GUESSTIMATES, HR_INTERVIEW, RESUME],
  },
  {
    slug: "bcg",
    name: "Boston Consulting Group",
    sector: "Consulting",
    roles: ["Consultant", "Summer Associate"],
    summary:
      "Recruits through a CV shortlist and multiple case interview rounds. Cases are often more open and conversational, expecting you to drive the structure.",
    rounds: [
      { name: "CV shortlist", detail: "Academic and professional record, with weight on distinctive achievements." },
      { name: "Online case or test", detail: "In some processes, an online case-style assessment before the interviews." },
      { name: "Case interviews", detail: "Typically several rounds, often candidate-led, with room for creative ideas alongside the analysis." },
      { name: "Fit questions", detail: "Why consulting, why this firm, and examples from your past." },
    ],
    lookFor: [
      "Driving the case yourself rather than waiting for prompts",
      "Creative but defensible ideas",
      "Comfort with charts and numbers under time pressure",
      "A convincing reason for consulting",
    ],
    practice: [MBB_CASES, GUESSTIMATES, DRILLS, HR_INTERVIEW, RESUME],
  },
  {
    slug: "bain",
    name: "Bain & Company",
    sector: "Consulting",
    roles: ["Associate Consultant", "Consultant", "Summer Associate"],
    summary:
      "Case interviews with a strong emphasis on practical, results-oriented recommendations, and a well-known focus on fit — whether the team would want to work with you.",
    rounds: [
      { name: "CV shortlist", detail: "Academic record and leadership outside the classroom." },
      { name: "Case interviews", detail: "Typically several rounds. Market sizing and profitability problems are common." },
      { name: "Written or presentation case", detail: "Some offices use one in later rounds." },
      { name: "Fit", detail: "Conversational questions about you, your teams and why Bain." },
    ],
    lookFor: [
      "Getting to an answer, with the \"so what\" stated",
      "Estimation with sensible, stated assumptions",
      "Warmth and collaboration in how you work through the problem",
    ],
    practice: [MBB_CASES, GUESSTIMATES, HR_INTERVIEW, RESUME],
  },
  {
    slug: "kearney",
    name: "Kearney",
    sector: "Consulting",
    roles: ["Business Analyst", "Associate"],
    summary:
      "A strategy and operations consulting firm. Its cases often have an operations, supply chain or cost flavour alongside classic strategy problems.",
    rounds: [
      { name: "CV shortlist", detail: "Academic and work record." },
      { name: "Case interviews", detail: "Typically two or more rounds; operations and cost problems appear often." },
      { name: "Fit", detail: "Experience-based questions and motivation for consulting." },
    ],
    lookFor: [
      "Operational common sense: where cost and capacity actually sit",
      "Structured thinking and clear arithmetic",
      "Industry experience you can explain crisply",
    ],
    practice: [MBB_CASES, OPERATIONS, DRILLS, HR_INTERVIEW],
  },
  {
    slug: "accenture-strategy",
    name: "Accenture Strategy & Consulting",
    sector: "Consulting",
    roles: ["Management Consultant", "Business Analyst"],
    summary:
      "Recruits in volume on Indian campuses. Processes vary by campus but commonly combine a screen, a case or business discussion, and interviews that probe your specialisation.",
    rounds: [
      { name: "Screen", detail: "A CV shortlist, and on some campuses an online test or a group discussion." },
      { name: "Case or business discussion", detail: "A business problem, often tied to technology or transformation." },
      { name: "Personal and domain interview", detail: "Your prior work, your MBA specialisation and why consulting." },
    ],
    lookFor: [
      "Structured answers to business problems",
      "Awareness of how technology changes a business",
      "Depth in your own specialisation and past role",
    ],
    practice: [GD, MBB_CASES, GUESSTIMATES, HR_INTERVIEW, APTITUDE],
  },
  {
    slug: "deloitte-consulting",
    name: "Deloitte (Consulting)",
    sector: "Consulting",
    roles: ["Consultant", "Business Analyst"],
    summary:
      "Consulting roles across strategy, operations and technology. Campus processes commonly mix a screen, case-style questions and personal interviews.",
    rounds: [
      { name: "Screen", detail: "A CV shortlist, and on some campuses an aptitude test or group discussion." },
      { name: "Case interview", detail: "A business case or a guesstimate." },
      { name: "Personal and HR interview", detail: "Past experience, motivation and fit." },
    ],
    lookFor: [
      "A clear approach to an unfamiliar business problem",
      "Communication that stays structured",
      "Specific examples from past work",
    ],
    practice: [MBB_CASES, GUESSTIMATES, GD, HR_INTERVIEW, APTITUDE],
  },

  // ---- FMCG ---------------------------------------------------------------
  {
    slug: "hul",
    name: "Hindustan Unilever",
    sector: "FMCG",
    roles: ["Management Trainee"],
    summary:
      "Its management trainee programme is among the most sought-after on Indian campuses. The process leans heavily on leadership, ownership and consumer understanding.",
    rounds: [
      { name: "Shortlist", detail: "CV, and in some years an application or online assessment." },
      { name: "Group round", detail: "A group discussion or group business exercise is common." },
      { name: "Interviews", detail: "Typically several, including with senior leaders, built around your experiences and business judgement." },
    ],
    lookFor: [
      "Leadership and ownership shown through specific stories",
      "Consumer insight: why people buy what they buy",
      "Comfort with sales and on-ground execution",
    ],
    practice: [GD, MARKETING, GTM, BRAND_TEARDOWN, HR_INTERVIEW, RESUME],
  },
  {
    slug: "procter-and-gamble",
    name: "Procter & Gamble",
    sector: "FMCG",
    roles: ["Assistant Brand Manager", "Management roles across functions"],
    summary:
      "Known for structured assessments and behavioural interviews that ask for detailed past examples of leading, solving problems and working with others.",
    rounds: [
      { name: "Online assessment", detail: "Reasoning and work-style assessments are commonly used before interviews." },
      { name: "Behavioural interviews", detail: "Typically more than one, each asking for specific situations you handled and what you did." },
      { name: "Functional discussion", detail: "Depending on the role, a business or brand problem." },
    ],
    lookFor: [
      "Examples told with situation, your action and the result",
      "Initiative taken without being asked",
      "Analytical reasoning about consumers and brands",
    ],
    practice: [APTITUDE, HR_INTERVIEW, BRAND_TEARDOWN, CAMPAIGN, MARKETING, RESUME],
  },
  {
    slug: "itc",
    name: "ITC",
    sector: "FMCG",
    roles: ["Management Trainee"],
    summary:
      "A diversified company spanning FMCG, hotels, agri-business and more, hiring trainees across functions. Processes commonly include group and personal rounds.",
    rounds: [
      { name: "Shortlist", detail: "CV-based." },
      { name: "Group discussion", detail: "Common in campus processes." },
      { name: "Interviews", detail: "Personal and functional interviews, often exploring interest in the business and in field roles." },
    ],
    lookFor: [
      "Genuine interest in the business and its breadth",
      "Willingness for field and distribution roles",
      "Clear thinking in group settings",
    ],
    practice: [GD, MARKETING, OPERATIONS, HR_INTERVIEW],
  },
  {
    slug: "nestle-india",
    name: "Nestlé India",
    sector: "FMCG",
    roles: ["Management Trainee"],
    summary:
      "Hires trainees for sales, marketing and other functions. Campus processes commonly include group and personal interview rounds with a sales and distribution grounding.",
    rounds: [
      { name: "Shortlist", detail: "CV-based." },
      { name: "Group round", detail: "A group discussion is common." },
      { name: "Interviews", detail: "Personal and functional interviews." },
    ],
    lookFor: [
      "Understanding of distribution and retail in India",
      "Energy for sales and field work",
      "Structured answers to marketing problems",
    ],
    practice: [GD, MARKETING, HR_INTERVIEW, RESUME],
  },

  // ---- Banking & finance --------------------------------------------------
  {
    slug: "goldman-sachs",
    name: "Goldman Sachs",
    sector: "Banking & finance",
    roles: ["Investment Banking Analyst / Associate", "Global Markets", "Strategy & risk roles"],
    summary:
      "Hires across divisions with processes that test technical finance knowledge and fit. What is asked depends heavily on the division.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and in some processes an online test or recorded interview." },
      { name: "Technical interviews", detail: "Valuation, accounting and markets, weighted by division." },
      { name: "Fit interviews", detail: "Why the division, why the firm, and your experiences." },
    ],
    lookFor: [
      "Accurate technical fundamentals: statements, valuation, markets",
      "A view on markets you can defend",
      "Precision and composure under questioning",
    ],
    practice: [VALUATION_MODELS, IB_CASES, FINANCE_CONCEPTS, ACCOUNTING, STOCK_PITCH, RESEARCH_NOTE],
  },
  {
    slug: "jp-morgan",
    name: "J.P. Morgan",
    sector: "Banking & finance",
    roles: ["Investment Banking", "Markets", "Corporate & other programmes"],
    summary:
      "Runs multiple programmes with processes that combine technical finance questions, behavioural interviews and, in some programmes, assessment days.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and in some programmes an online assessment." },
      { name: "Interviews", detail: "Technical and behavioural, depending on the programme." },
      { name: "Assessment day", detail: "Some programmes use a day of back-to-back interviews or exercises." },
    ],
    lookFor: [
      "Finance fundamentals explained simply",
      "Awareness of current market and macro developments",
      "Specific, well-structured behavioural examples",
    ],
    practice: [FINANCE_CONCEPTS, VALUATION_MODELS, ACCOUNTING, RESEARCH_NOTE, DAILY, HR_INTERVIEW],
  },
  {
    slug: "hdfc-bank",
    name: "HDFC Bank",
    sector: "Banking & finance",
    roles: ["Management Trainee", "Relationship and product roles"],
    summary:
      "Recruits for banking roles where awareness of the banking system, regulation and customers matters as much as finance theory.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and on some campuses a test or group discussion." },
      { name: "Interviews", detail: "Personal and banking-awareness interviews." },
    ],
    lookFor: [
      "Awareness of RBI policy and banking developments",
      "Basics of lending, deposits and risk",
      "Customer orientation and sales aptitude",
    ],
    practice: [DAILY, FINANCE_CONCEPTS, GD, HR_INTERVIEW],
  },

  // ---- Technology ---------------------------------------------------------
  {
    slug: "amazon",
    name: "Amazon",
    sector: "Technology",
    roles: ["Product Manager", "Program Manager", "Business and finance roles"],
    summary:
      "Its interviews are organised around its published Leadership Principles: most questions ask for specific past examples, alongside role-specific product or business problems.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and for some roles an online assessment." },
      { name: "Behavioural interviews", detail: "Detailed examples mapped to the Leadership Principles, with deep follow-up on your decisions and data." },
      { name: "Role-specific rounds", detail: "Product sense, metrics, estimation or a business case, depending on the role." },
    ],
    lookFor: [
      "Examples with your own decisions, the data you used and the result",
      "Customer obsession shown, not claimed",
      "Metric-driven thinking about products",
    ],
    practice: [HR_INTERVIEW, PRODUCT_SENSE, METRICS, RCA, GUESSTIMATES, SQL],
  },
  {
    slug: "google",
    name: "Google",
    sector: "Technology",
    roles: ["Associate Product Manager", "Product Manager", "Business roles"],
    summary:
      "Product interviews typically span product design, strategy, estimation and analytical questions, alongside behavioural questions about how you work.",
    rounds: [
      { name: "Screen", detail: "CV shortlist and initial conversations." },
      { name: "Product interviews", detail: "Designing or improving a product, product strategy, estimation and metrics." },
      { name: "Behavioural", detail: "Collaboration, ambiguity and how you have handled difficult situations." },
    ],
    lookFor: [
      "User-centred reasoning before solutions",
      "Structured estimation with stated assumptions",
      "Clear prioritisation and trade-offs",
    ],
    practice: [PRODUCT_SENSE, PM_CASES, METRICS, GUESSTIMATES, RCA, HR_INTERVIEW],
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    sector: "Technology",
    roles: ["Product Manager", "Business roles"],
    summary:
      "Product manager interviews commonly cover product design, customer empathy, estimation and behavioural questions.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and for some roles an initial interview." },
      { name: "Product and design interviews", detail: "Designing for a user, improving a product, estimation." },
      { name: "Behavioural", detail: "Teamwork, influence without authority and learning from failure." },
    ],
    lookFor: [
      "Empathy for a specific user",
      "Structured product thinking",
      "Examples of influencing without authority",
    ],
    practice: [PRODUCT_SENSE, PM_CASES, GUESSTIMATES, HR_INTERVIEW, RESUME],
  },
  {
    slug: "flipkart",
    name: "Flipkart",
    sector: "Technology",
    roles: ["Associate Product Manager", "Product Manager", "Business and analytics roles"],
    summary:
      "An Indian e-commerce company. Product and business interviews commonly test product sense, metrics and root-cause analysis, and case-style problem solving.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and on some campuses a test." },
      { name: "Product and case rounds", detail: "Product improvement, metric diagnosis, guesstimates or business cases." },
      { name: "Leadership or HR round", detail: "Motivation and past experience." },
    ],
    lookFor: [
      "Understanding of Indian consumers and e-commerce economics",
      "Diagnosing why a metric moved",
      "Comfort with data",
    ],
    practice: [RCA, METRICS, PRODUCT_SENSE, GUESSTIMATES, SQL, EXCEL],
  },

  // ---- Conglomerates ------------------------------------------------------
  {
    slug: "tata-administrative-services",
    name: "Tata Administrative Services (TAS)",
    sector: "Conglomerate",
    roles: ["TAS Officer"],
    summary:
      "The Tata group's general-management leadership programme. Its selection is known for being multi-stage, with strong weight on leadership and values.",
    rounds: [
      { name: "Application and screen", detail: "An application and, in many years, a test or assessment." },
      { name: "Group round", detail: "A group discussion or group exercise is common." },
      { name: "Interviews", detail: "Several rounds, commonly ending with a panel of senior leaders." },
    ],
    lookFor: [
      "General-management breadth over narrow specialism",
      "Leadership and integrity shown through specific stories",
      "A considered view of business in India",
    ],
    practice: [GD, STRATEGY, SIMULATION, HR_INTERVIEW, DAILY],
  },
  {
    slug: "aditya-birla-group",
    name: "Aditya Birla Group",
    sector: "Conglomerate",
    roles: ["Young leaders / management programmes"],
    summary:
      "A diversified group hiring for leadership programmes across its businesses. Processes commonly combine assessments, group exercises and interviews.",
    rounds: [
      { name: "Screen", detail: "CV shortlist, and in some years an assessment." },
      { name: "Group round", detail: "A case discussion or GD is common." },
      { name: "Interviews", detail: "Personal and leadership interviews." },
    ],
    lookFor: [
      "Leadership potential across businesses",
      "Structured thinking on strategy and operations",
      "Clear career motivation",
    ],
    practice: [GD, STRATEGY, OPERATIONS, HR_INTERVIEW],
  },
  {
    slug: "mahindra-group",
    name: "Mahindra Group",
    sector: "Conglomerate",
    roles: ["Management and leadership programmes"],
    summary:
      "A diversified group spanning automotive, farm equipment, financial services and more. Campus processes commonly include group and interview rounds.",
    rounds: [
      { name: "Screen", detail: "CV shortlist." },
      { name: "Group round", detail: "A GD or case discussion is common." },
      { name: "Interviews", detail: "Personal and functional interviews." },
    ],
    lookFor: [
      "Interest in the group's businesses, including rural markets",
      "Practical problem solving",
      "Leadership examples",
    ],
    practice: [GD, STRATEGY, OPERATIONS, HR_INTERVIEW],
  },
];
