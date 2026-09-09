# Market research prompt — CaseCode

Paste everything below the line into an AI with web search (ChatGPT with
browsing, Perplexity, Claude with search, or Gemini). Works best in a model with
real-time search; without it you will get a confident answer built from stale
training data, which is the failure mode this prompt is written to prevent.

---

You are a market research analyst. I need a rigorous, evidence-based competitive
landscape for a product I am building. Use web search throughout. Do not rely on
your training data for anything checkable.

## The product

**CaseCode** — "LeetCode, but for business decisions." A web platform where MBA
students and consulting/finance/product candidates practise realistic business
cases and get graded by AI against an explicit rubric.

Specifics that matter for comparison:

- **886 original business cases** across six domains: Finance, Consulting,
  Product Management, Marketing, Strategy, Operations. Cases are generated from
  analytical archetypes (capital raising, DCF/comps valuation, NPV, market entry,
  profitability decline, cost of capital, working capital, safety stock, CAC
  payback, attribution, marketplace liquidity, due diligence, post-merger
  synergies, and so on) crossed with fictional company profiles, so every case
  carries computable numbers rather than discussion prompts.
- **Rubric-based AI grading.** Each case has weighted criteria (e.g. Financial
  Analysis 25, Market Analysis 15, Risk Assessment 20, Recommendation 20). The
  model returns points per criterion plus strengths, where marks were lost, and
  what to do next time. The total is recomputed server-side and clamped to the
  rubric — the model never decides the final number.
- **Structured answers.** Students write in three sections — Framework, Analysis,
  Recommendation — rather than free text or multiple choice.
- **AI mock interviewer** (paid tier) that conducts a live case conversation.
- **Teacher tooling**: professors create batches, set cases as assignments,
  see a score distribution, and mark student work themselves — with the AI grade
  shown as advisory beside their own mark, which is authoritative.
- **Campus licensing is the actual business model.** Colleges buy seats;
  students at a licensed institution's email domain get access. Individuals can
  browse the whole library free but cannot submit an answer without a licence.
  A retail tier exists at ₹499/year.
- **India-first.** Rupee pricing, Indian MBA placement market, cases set in
  Indian and Asian company contexts alongside US/Europe.
- Progress mechanics: learning paths, streaks, skill radar by domain,
  leaderboards, study groups, classrooms.

## What I need

### 1. Landscape

Find who else does this. Search deliberately across these categories rather than
only the obvious one:

- **Case interview prep platforms** (global) — the direct comparison
- **Indian MBA / CAT / placement prep** — the direct market
- **AI-graded practice platforms in adjacent skills** — technical interviews,
  data science, product management, consulting
- **University-licensed courseware** sold to business schools B2B
- **Casebooks and free resources** — MBA consulting club casebooks, YouTube,
  Reddit communities, which are the real substitute for a student with no budget
- **General AI tutors** being used for this purpose even if not built for it

For each competitor found, report:

| Field | Detail |
|---|---|
| Name and URL | |
| What it actually is | one sentence, no marketing language |
| Content volume | number of cases/questions, if stated publicly |
| Grading | human coach, peer, AI, self-assessed, or none |
| Structured rubric? | per-criterion scoring, or a single score, or qualitative |
| Pricing | exact figures and currency, with the page you found them on |
| Business model | B2C subscription, B2B campus licence, marketplace, one-off |
| Geography | where its users and pricing are centred |
| Institutional product? | does it sell to universities, and what does that include |
| Founded / funding / scale | if publicly known |
| Evidence | the URL you took this from, and the date you accessed it |

### 2. Direct versus adjacent

Sort them. Which are genuinely competing for the same buyer and budget, and
which merely look similar? Be explicit about the distinction — a peer-practice
marketplace and an AI grader solve different problems for the same student.

Pay particular attention to **who the buyer is**. A platform selling
subscriptions to individual students is not competing with CaseCode for the same
purchase decision as one selling seats to a placement cell, even if the content
overlaps entirely.

### 3. Where CaseCode is genuinely different — and where it is not

This is the part I care most about, and the part where I most want you to
resist flattering me.

- Which CaseCode features are actually rare in this market? Name the competitors
  that lack them.
- Which features I think are differentiators are in fact table stakes?
- Is anyone else doing **rubric-based per-criterion AI grading with a
  server-recomputed score**? If so, who, and how does theirs work?
- Is anyone else combining **student practice with instructor marking tools** in
  one product? That combination is my hypothesis for the moat — test it.
- How defensible is a library of AI-generated original cases against a
  competitor with human-written cases from ex-consultants, or against a student
  simply using ChatGPT directly?

**Answer this directly: what stops a motivated student from pasting a case into
ChatGPT and asking it to grade them against a rubric?** If the honest answer is
"very little", say so and explain what would change it.

### 4. The India question

- Who specifically serves Indian MBA students for case-interview and placement
  preparation? Name them.
- What do Indian B-schools currently buy for placement preparation, and at what
  price per student per year? Find actual procurement figures if you can.
- Who sells software to Indian college placement cells today, and how does that
  sale usually happen?
- Is rupee pricing at ₹499/year individual and campus-seat licensing consistent
  with what this market pays, or badly mispriced in either direction?

### 5. Risks and honest weaknesses

- What would a well-funded incumbent do to make CaseCode irrelevant, and how
  quickly?
- Where is CaseCode weakest relative to what already exists?
- Which competitor is closest, and what do they do better?
- Is this market growing or is AI collapsing it — i.e. does a general-purpose
  model make purpose-built practice platforms redundant within two years?

### 6. Whitespace

Where is nobody serving demand well? Prioritise gaps that fit a small team with
an existing 886-case library and instructor tooling, not gaps that would require
a sales force of forty people.

## How to answer

- **Cite everything.** Every factual claim gets a URL and the date you accessed
  it. A claim you cannot source, say so explicitly.
- **Distinguish verified from inferred.** Mark each as one or the other. Pricing
  changes constantly and much of it sits behind "contact sales".
- **Say when you cannot find something.** "No Indian competitor with rubric-based
  AI grading was found in this search" is a genuinely useful finding. Inventing
  a plausible-sounding company is worse than useless.
- **No encouragement.** I am not looking for validation. If CaseCode is
  undifferentiated, the useful answer is that it is undifferentiated, with the
  evidence.
- Finish with a one-page summary: the five closest competitors, the three real
  differentiators, and the single largest threat.

Start with searches, not with what you already believe.
