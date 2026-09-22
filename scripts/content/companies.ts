import type {
  CompanyRound,
  CompanySector,
  CompanySource,
  OfficialLink,
  PracticeLink,
} from "../../src/lib/companies";

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
 *
 * NONE OF THESE HAS BEEN VERIFIED YET
 *
 * The text was written from general knowledge of how these firms hire, not
 * read off an official source, and every page says so. To verify a profile,
 * read it against a real source — the firm's careers page, your placement
 * cell's record of last season's process — correct anything that differs, and
 * add that source to `sources` with the day you checked it:
 *
 *   sources: [
 *     { label: "Bain India careers — campus hiring", url: "https://…", checked_on: "2026-10-02" },
 *   ],
 *
 * Only list a source you actually read against this profile. The page shows
 * the profile as checked, with that date, as soon as one is listed.
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
  /** What this profile was checked against. Leave out until someone has. */
  sources?: CompanySource[];
  /** The firm's own domain. Every officialLinks entry must sit on it. */
  officialDomain?: string;
  /**
   * What the firm publishes itself for candidates.
   *
   * Not the same claim as `sources`. A source is something a human read
   * against this profile; a link is a pointer at first-party material that is
   * usually better than anything a third party recollects, and was simply
   * never surfaced here.
   */
  officialLinks?: OfficialLink[];
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
      { name: "Solve", detail: "McKinsey's own assessment game, used in many offices before interviews. The firm says it tests intrinsic problem-solving and that no preparation is required or expected for it." },
      { name: "Personal experience interview (PEI)", detail: "McKinsey describes this as its own interview, not a segment of the case. Its guidance is to bring TWO personal examples for EACH of four themes it names, focusing on your specific role and the actions that were critical to the outcome." },
      { name: "Problem-solving interview", detail: "The case — McKinsey notes it is sometimes called that. It presents a business case to evaluate analytical thinking. It publishes four full sample cases with suggested answers: Beautify, Diconsa, Electro-Light and Talbot Trucks." },
      { name: "Expertise interview", detail: "For some roles only. For technical roles this becomes a tailored assessment, which may include coding challenges." },
    ],
    lookFor: [
      "A clear, hypothesis-driven structure you can adapt as data arrives",
      "Accurate arithmetic spoken out loud",
      "Synthesis: a recommendation, not a summary",
      "Stories where your personal role and the outcome are specific",
    ],
    practice: [MBB_CASES, DRILLS, GUESSTIMATES, HR_INTERVIEW, RESUME],
    sources: [
      { label: "McKinsey & Company — interviewing at McKinsey", url: "https://www.mckinsey.com/careers/interviewing", checked_on: "2026-09-22" },
    ],
    officialDomain: "mckinsey.com",
    officialLinks: [
      {
        label: "Interviewing at McKinsey",
        url: "https://www.mckinsey.com/careers/interviewing",
        note: "The firm's own description of the PEI, the problem-solving interview and the expertise interview.",
      },
      {
        label: "Beautify — a McKinsey sample case",
        url: "https://www.mckinsey.com/careers/interviewing/beautify",
        note: "Whether a beauty company should train in-store consultants to use virtual channels. Published with suggested answers.",
      },
      {
        label: "Diconsa — a McKinsey sample case",
        url: "https://www.mckinsey.com/careers/interviewing/diconsa",
        note: "Using Mexico's Diconsa network to bring basic financial services to the rural poor, for the Gates Foundation.",
      },
      {
        label: "Electro-Light — a McKinsey sample case",
        url: "https://www.mckinsey.com/careers/interviewing/electrolight",
        note: "Launching a reduced-sugar electrolyte sports drink for a major beverage company.",
      },
      {
        label: "Talbot Trucks — a McKinsey sample case",
        url: "https://www.mckinsey.com/careers/interviewing/talbot-trucks",
        note: "Whether a European truck maker should invest in producing electric trucks.",
      },
      {
        label: "Assessment integrity expectations",
        url: "https://www.mckinsey.com/careers/assessment-integrity-expectations",
        note: "READ THIS ONE. McKinsey sets out where AI is welcome in your preparation and where it is not: practising questions and having concepts explained are encouraged, generating answers during an interview or using AI in an assessment is not.",
      },
      {
        label: "Solve, McKinsey's assessment game",
        url: "https://www.mckinsey.com/careers/mckinsey-digital-assessment",
        note: "What Solve is and what McKinsey says about preparing for it, which is that you do not need to.",
      },
    ],
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
      { name: "Skills interview", detail: "BCG's own name for it: a conversation about your experience, skills and motivation." },
      { name: "Case interview", detail: "BCG says this assesses problem-solving and analytical skills for client-facing roles. Often candidate-led, with room for creative ideas alongside the analysis." },
      { name: "Team interview", detail: "BCG names this as a distinct round, assessing problem-solving, analytical AND communication skills." },
    ],
    lookFor: [
      "Driving the case yourself rather than waiting for prompts",
      "Creative but defensible ideas",
      "Comfort with charts and numbers under time pressure",
      "A convincing reason for consulting",
    ],
    practice: [MBB_CASES, GUESSTIMATES, DRILLS, HR_INTERVIEW, RESUME],
    sources: [
      { label: "BCG Careers — interview process", url: "https://careers.bcg.com/global/en/interview-process", checked_on: "2026-09-22" },
    ],
    officialDomain: "bcg.com",
    officialLinks: [
      {
        label: "Interview process",
        url: "https://careers.bcg.com/interview-process",
        note: "BCG's own account of the rounds and what a case interview is testing.",
      },
      {
        label: "Case interview preparation",
        url: "https://careers.bcg.com/case-interview-preparation",
        note: "BCG's published case preparation material.",
      },
    ],
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
      { name: "Recruiter call", detail: "Bain says you MIGHT have a call with a recruiter after the application review — it is described as possible, not guaranteed." },
      { name: "Interview rounds", detail: "Bain describes several rounds of interviews, which it says might include a questionnaire among other components." },
      { name: "Case interview", detail: "Bain scopes this to role: for a role such as consultant you MAY also have a case interview where you work through a problem. Market sizing and profitability problems are common." },
      { name: "Written or presentation case", detail: "Some offices use one in later rounds." },
      { name: "Fit", detail: "Conversational questions about you, your teams and why Bain." },
    ],
    lookFor: [
      "Getting to an answer, with the \"so what\" stated",
      "Estimation with sensible, stated assumptions",
      "Warmth and collaboration in how you work through the problem",
    ],
    practice: [MBB_CASES, GUESSTIMATES, HR_INTERVIEW, RESUME],
    sources: [
      { label: "Bain & Company — our hiring process", url: "https://www.bain.com/careers/hiring-process/", checked_on: "2026-09-22" },
    ],
    officialDomain: "bain.com",
    officialLinks: [
      {
        label: "Our hiring process",
        url: "https://www.bain.com/careers/hiring-process/",
        note: "Bain sets out a digital assessment followed by case interviews.",
      },
      {
        label: "Case interview preparation",
        url: "https://www.bain.com/careers/hiring-process/case-interview/",
        note: "Bain's own guidance on opening a case and working through it.",
      },
      {
        label: "FashionCo. — a Bain practice case",
        url: "https://www.bain.com/careers/hiring-process/interviewing/fashion-case-study/",
        note: "A full case Bain wrote and published: a fashion player with declining revenues.",
      },
      {
        label: "Associate Consultant mock interview",
        url: "https://www.bain.com/careers/hiring-process/interviewing/associate-consultant-practice-case-interview",
        note: "Video of a Bain interviewer running a case end to end.",
      },
    ],
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
      { name: "Four to five interviews", detail: "Kearney states its general consulting process is typically FOUR TO FIVE interviews, blending behavioural and case rounds. They are conducted by consultants rather than recruiters, so you meet the people you would work with from the first round." },
      { name: "Behavioural interview", detail: "Kearney describes it as a get-to-know-you conversation about the setting, people and influences that shaped your decisions." },
      { name: "Case interview", detail: "Operations and cost problems appear often. Kearney says plainly it wants the solution you genuinely believe is best, not the one you think it wants to hear." },
      { name: "Competency assessment", detail: "Depending on the role, Kearney says you may also be asked to complete an additional competency assessment." },
    ],
    lookFor: [
      "Operational common sense: where cost and capacity actually sit",
      "Structured thinking and clear arithmetic",
      "Industry experience you can explain crisply",
    ],
    practice: [MBB_CASES, OPERATIONS, DRILLS, HR_INTERVIEW],
    sources: [
      { label: "Kearney — our recruiting process", url: "https://www.kearney.com/careers/interviewing/recruiting-process", checked_on: "2026-09-22" },
    ],
    officialDomain: "kearney.com",
    officialLinks: [
      {
        label: "Interviewing at Kearney",
        url: "https://www.kearney.com/careers/interviewing",
        note: "Kearney's own pages on its recruiting process and what it assesses.",
      },
      {
        label: "Crack the case",
        url: "https://www.kearney.com/careers/interviewing/crack-the-case",
        note: "Kearney's case guidance, including its case flowchart.",
      },
      {
        label: "Case example: promotional planning",
        url: "https://www.kearney.com/careers/interviewing/crack-the-case/case-example-promotion-planning",
        note: "A worked case Kearney published, in the operations and pricing flavour it is known for.",
      },
    ],
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
      { name: "Assessment", detail: "Accenture describes online activities assessing problem-solving, logical reasoning and applied technical knowledge, built to simulate real work. Two rules from its own India page are worth knowing before you apply: you may hold only ONE ACTIVE APPLICATION in India at a time, and a failed assessment cannot be retaken for 90 DAYS — that wait attaches to the assessment itself, so it blocks other roles using the same one." },
      { name: "Case or business discussion", detail: "A business problem, often tied to technology or transformation." },
      { name: "Personal and domain interview", detail: "Your prior work, your MBA specialisation and why consulting." },
    ],
    lookFor: [
      "Structured answers to business problems",
      "Awareness of how technology changes a business",
      "Depth in your own specialisation and past role",
    ],
    practice: [GD, MBB_CASES, GUESSTIMATES, HR_INTERVIEW, APTITUDE],
    sources: [
      { label: "Accenture India — your journey to Accenture", url: "https://www.accenture.com/in-en/careers/explore-careers/area-of-interest/journey-to-accenture", checked_on: "2026-09-22" },
    ],
    officialDomain: "accenture.com",
    officialLinks: [
      {
        label: "Your journey to Accenture",
        url: "https://www.accenture.com/in-en/careers/explore-careers/area-of-interest/journey-to-accenture",
        note: "Accenture India's own description of the assessment and interview stages, including its retake and single-application rules.",
      },
    ],
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
      { name: "Case and scenario interview", detail: "Deloitte's own name for the round. It publishes a five-step approach it wants to see: clarify the issue, identify the assumptions, summarise the issues and findings, state a recommendation, then outline next steps and expected results. It says explicitly you are not expected to produce the 'right' answer — the logic is what is marked. Separate prep tools exist for Consultative Offerings and for Audit & Assurance." },
      { name: "Personal and HR interview", detail: "Past experience, motivation and fit." },
    ],
    lookFor: [
      "A clear approach to an unfamiliar business problem",
      "Communication that stays structured",
      "Specific examples from past work",
    ],
    practice: [MBB_CASES, GUESSTIMATES, GD, HR_INTERVIEW, APTITUDE],
    sources: [
      { label: "Deloitte — preparing for the case and scenario interview", url: "https://www.deloitte.com/us/en/careers/join-deloitte/recruiting-tips/case-and-scenario-interview-tips.html", checked_on: "2026-09-22" },
    ],
    officialDomain: "deloitte.com",
    officialLinks: [
      {
        label: "Preparing for the case and scenario interview",
        url: "https://www.deloitte.com/us/en/careers/join-deloitte/recruiting-tips/case-and-scenario-interview-tips.html",
        note: "Deloitte's own case guidance. Note it calls the round a case AND scenario interview.",
      },
      {
        label: "Preparing for an interview — Deloitte India",
        url: "https://www2.deloitte.com/in/en/pages/careers/articles/preparing-for-an-interview.html",
        note: "The India careers team's own interview advice.",
      },
    ],
  },

  // ---- FMCG ---------------------------------------------------------------
  {
    slug: "hul",
    name: "Hindustan Unilever",
    sector: "FMCG",
    roles: ["Management Trainee"],
    summary:
      "Hires management trainees largely through the Unilever Future Leaders Programme (UFLP), a stint-based rotation across a chosen function. The process leans heavily on leadership, ownership and consumer understanding.",
    rounds: [
      { name: "Shortlist", detail: "CV, and in some years an application or online assessment." },
      { name: "Assessments", detail: "Unilever's published UFLP process runs an online application into motivation, personality and cognitive assessments, then a digital interview." },
      { name: "Group round", detail: "A group discussion or group business exercise is common." },
      { name: "Discovery day", detail: "Unilever describes a final in-person day combining business challenges, a team exercise with Unilever colleagues, and an interview." },
    ],
    lookFor: [
      "Leadership and ownership shown through specific stories",
      "Consumer insight: why people buy what they buy",
      "Comfort with sales and on-ground execution",
    ],
    practice: [GD, MARKETING, GTM, BRAND_TEARDOWN, HR_INTERVIEW, RESUME],
    officialDomain: "hul.co.in",
    officialLinks: [
      {
        label: "Unilever Future Leaders Programme (UFLP)",
        url: "https://www.hul.co.in/careers/student-opportunities/uflp/",
        note: "HUL's own page for the programme most campus hiring runs through, including how to apply.",
      },
    ],
  },
  {
    slug: "procter-and-gamble",
    name: "Procter & Gamble",
    sector: "FMCG",
    roles: ["Assistant Brand Manager", "Management roles across functions"],
    summary:
      "Known for structured assessments and behavioural interviews that ask for detailed past examples of leading, solving problems and working with others.",
    rounds: [
      { name: "Online assessment", detail: "P&G's own hiring pages say assessments are mandatory, and that for most roles the assessment result alone decides whether an application moves forward — the rest of your application is not weighed against it. Treat it as the gate, not a formality." },
      { name: "PEAK Performance Assessment", detail: "P&G describes it as roughly 20 minutes across four sections, with no right or wrong answers, and no going back once a section is submitted." },
      { name: "Behavioural interviews", detail: "P&G says there can be up to three, one-on-one or panel, each asking for specific situations you handled and what you did." },
      { name: "Functional discussion", detail: "Depending on the role, a business or brand problem." },
    ],
    lookFor: [
      "Examples told with situation, your action and the result",
      "Initiative taken without being asked",
      "Analytical reasoning about consumers and brands",
    ],
    practice: [APTITUDE, HR_INTERVIEW, BRAND_TEARDOWN, CAMPAIGN, MARKETING, RESUME],
    officialDomain: "pgcareers.com",
    officialLinks: [
      {
        label: "P&G hiring process",
        url: "https://www.pgcareers.com/global/en/hiring-process",
        note: "P&G's own stage-by-stage account, including that up to three interviews follow the assessment.",
      },
      {
        label: "PEAK Performance Assessment",
        url: "https://www.pgcareers.com/global/en/peak-performance-assessment",
        note: "The assessment itself: four sections, no going back once a section is submitted, and no right answers.",
      },
      {
        label: "Assessment overviews",
        url: "https://www.pgcareers.com/global/en/assesment-overviews",
        note: "P&G walks through each assessment it uses, which is rare and worth reading before you sit one.",
      },
    ],
  },
  {
    slug: "itc",
    name: "ITC",
    sector: "FMCG",
    roles: ["Management Trainee"],
    summary:
      "A diversified company spanning FMCG, hotels, agri-business and more. Management trainees enter as Assistants Under Training (AUTs), and its KITES summer internship carries pre-placement offers. Processes commonly include group and personal rounds.",
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
    officialDomain: "itcportal.com",
    officialLinks: [
      {
        label: "Careers at ITC",
        url: "https://www.itcportal.com/careers.html",
        note: "ITC's own careers pages, including how Management Trainees enter as Assistants Under Training.",
      },
      {
        label: "KITES — ITC's summer internship",
        url: "https://www.itcportal.com/careers/kites.aspx",
        note: "The internship that carries pre-placement offers, described by ITC.",
      },
    ],
  },
  {
    slug: "nestle-india",
    name: "Nestlé India",
    sector: "FMCG",
    roles: ["Management Trainee"],
    summary:
      "Hires trainees for sales, marketing and other functions. Campus processes commonly include group and personal interview rounds with a sales and distribution grounding.",
    rounds: [
      { name: "Campus case competition", detail: "Nestlé describes its campus route as beginning with a live case competition or a real-time business project, rather than a CV screen alone." },
      { name: "Summer internship", detail: "A two-month internship follows, and performance in it decides who is absorbed." },
      { name: "Interviews", detail: "Personal and functional interviews, including with HR and the line manager." },
    ],
    lookFor: [
      "Understanding of distribution and retail in India",
      "Energy for sales and field work",
      "Structured answers to marketing problems",
    ],
    practice: [GD, MARKETING, HR_INTERVIEW, RESUME],
    officialDomain: "nestle.in",
    officialLinks: [
      {
        label: "Students and graduates",
        url: "https://www.nestle.in/jobs/students-graduates",
        note: "Nestlé India's own page for campus entry routes.",
      },
      {
        label: "Start your Nestlé journey",
        url: "https://www.nestle.in/jobs/recruitment-journey",
        note: "The recruitment journey as Nestlé describes it, stage by stage.",
      },
    ],
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
    officialDomain: "goldmansachs.com",
    officialLinks: [
      {
        label: "Process for students — India",
        url: "https://www.goldmansachs.com/worldwide/india/careers/process-for-students",
        note: "The India-specific process, which is the one that applies on an Indian campus.",
      },
      {
        label: "Prepare",
        url: "https://www.goldmansachs.com/careers/students/prepare",
        note: "Goldman's own preparation material for students.",
      },
      {
        label: "Virtual interview preparation",
        url: "https://www.goldmansachs.com/careers/discover/virtual-interview-prep.pdf",
        note: "A PDF Goldman publishes on its recorded video interview, which comes before the final rounds.",
      },
    ],
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
    officialDomain: "jpmorganchase.com",
    officialLinks: [
      {
        label: "How we hire",
        url: "https://www.jpmorganchase.com/careers/how-we-hire",
        note: "The firm's own account of its stages, including the recorded video interview.",
      },
      {
        label: "How we hire — FAQ",
        url: "https://www.jpmorganchase.com/careers/how-we-hire/faqs",
        note: "Answers to the process questions candidates actually ask.",
      },
    ],
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
    officialDomain: "hdfcbank.com",
    officialLinks: [
      {
        label: "Careers at HDFC Bank",
        url: "https://www.hdfcbank.com/personal/about-us/careers",
        note: "The bank's own careers page. It also states plainly that it never charges candidates a fee — worth knowing, given how many banking recruitment scams use its name.",
      },
    ],
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
      { name: "Interview loop", detail: "Amazon's own term: several interviewers in sequence, each assessing a different dimension. Expect two or three behavioural questions from each." },
      { name: "Behavioural interviews", detail: "Examples mapped to the Leadership Principles, answered in STAR shape. Amazon asks specifically for metrics in the answers — it describes itself as data-driven and marks accordingly." },
      { name: "Role-specific rounds", detail: "Product sense, metrics, estimation or a business case, depending on the role." },
    ],
    lookFor: [
      "Examples with your own decisions, the data you used and the result",
      "Customer obsession shown, not claimed",
      "Metric-driven thinking about products",
    ],
    practice: [HR_INTERVIEW, PRODUCT_SENSE, METRICS, RCA, GUESSTIMATES, SQL],
    officialDomain: "amazon.jobs",
    officialLinks: [
      {
        label: "The interview loop",
        url: "https://www.amazon.jobs/content/en/how-we-hire/interview-loop",
        note: "Amazon's own description of the loop: several interviewers, each assessing a different dimension.",
      },
      {
        label: "Leadership Principles",
        url: "https://www.amazon.jobs/content/en/our-workplace/leadership-principles",
        note: "The list your behavioural answers are scored against. Read it before writing a single story.",
      },
      {
        label: "Interview prep FAQ",
        url: "https://www.amazon.jobs/content/en/faq/interview-prep",
        note: "Amazon asks for STAR-shaped answers with real metrics in them, and says so itself.",
      },
    ],
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
    officialDomain: "google.com",
    officialLinks: [
      {
        label: "Our hiring process",
        url: "https://www.google.com/about/careers/applications/how-we-hire",
        note: "Google's own account of its stages.",
      },
      {
        label: "Interviewing at Google",
        url: "https://www.google.com/about/careers/applications/interview-tips",
        note: "Google's published interview advice, written for candidates.",
      },
    ],
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
    officialDomain: "microsoft.com",
    officialLinks: [
      {
        label: "Student interviewing",
        url: "https://careers.microsoft.com/v2/global/en/hiring-tips/student-interviewing",
        note: "Microsoft's guidance written specifically for students.",
      },
      {
        label: "Interview tips",
        url: "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips.html",
        note: "What Microsoft says it asks and how it wants problems talked through.",
      },
    ],
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
    officialDomain: "flipkartcareers.com",
    officialLinks: [
      {
        label: "Campus at Flipkart",
        url: "https://www.flipkartcareers.com/students",
        note: "Flipkart's own campus and internship pages.",
      },
      {
        label: "Data Scientist interview guide",
        url: "https://www.flipkartcareers.com/flipkart/assets/flipkart_pdf/Data_Scientist.pdf",
        note: "A preparation guide Flipkart publishes for one of its analytics tracks.",
      },
    ],
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
      { name: "Application form", detail: "The TAS application form itself, which the group treats as a substantive stage rather than a formality." },
      { name: "Gamified assessment", detail: "Tata describes a gamified assessment for the finals track." },
      { name: "Leadership group discussion", detail: "Known as the Chairman's GD." },
      { name: "Presentation round", detail: "Shortlisted candidates present their SUMMER INTERNSHIP PROJECT. Worth knowing well before finals season: the work you do in your summer internship becomes the material for this round." },
      { name: "Final interview", detail: "With senior Tata leaders. The first year after joining is three business stints and one community stint." },
    ],
    lookFor: [
      "General-management breadth over narrow specialism",
      "Leadership and integrity shown through specific stories",
      "A considered view of business in India",
    ],
    practice: [GD, STRATEGY, SIMULATION, HR_INTERVIEW, DAILY],
    officialDomain: "tata.com",
    officialLinks: [
      {
        label: "TAS leadership programme",
        url: "https://www.tata.com/careers/programs/tas",
        note: "What TAS is, from the group itself.",
      },
      {
        label: "TAS campus hiring",
        url: "https://www.tata.com/careers/programs/tas/tas-campus-tata-group",
        note: "The campus process: application form, gamified assessment, the leadership group discussion known as the Chairman's GD, a presentation round on your summer project, then final interviews.",
      },
    ],
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
    officialDomain: "adityabirla.com",
    officialLinks: [
      {
        label: "Aditya Birla Group Leadership Programme",
        url: "https://www.abglp.adityabirla.com/",
        note: "ABGLP is the route most B-school hiring runs through.",
      },
      {
        label: "LEAP — the general management track",
        url: "https://www.abglp.adityabirla.com/programs/leadership_associate_program",
        note: "The programme itself: a year of training across three four-month stints in different functions and businesses.",
      },
    ],
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
    officialDomain: "mahindra.com",
    officialLinks: [
      {
        label: "Mahindra recruitment programmes",
        url: "https://www.mahindra.com/careers/mahindra-recruitment-programmes",
        note: "The group's campus programmes, including the Group Management Cadre.",
      },
      {
        label: "Mahindra Leaders Programme",
        url: "https://www.mahindra.com/mahindra-leaders-program",
        note: "The B-school entry route, described by Mahindra.",
      },
    ],
  },
];
