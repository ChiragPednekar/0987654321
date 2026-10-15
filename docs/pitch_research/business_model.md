# Business model and pricing — CaseCode

*Phase 5. **Every price in this document is a hypothesis**, not an
established or tested market price. Benchmarks are cited from `sources.md`;
unit costs come from the codebase and Google's official price list.*

---

## 1. What the product already assumes [Fact]

The codebase is built for a campus licence:
- `institutions` holds seats, licence dates, price and email domain (migrations `…019`, `…022`).
- Students with the college's email domain are enrolled automatically.
- The licence grants "Pro" (AI interviewer, role-plays); expiry or suspension cuts access automatically.
- A per-student annual fair-use quota (250 graded answers + 50 AI interview sessions on Pro) bounds AI cost per seat (`src/lib/constants.ts`).
- The owner console computes contract value, AI cost per licence, and margin (flagged below 30%) (`/admin/licences`).
- Retail Pro (₹499/yr) was coded but never switched on, and the pricing page was removed on 12 Oct 2026 to focus on licensing.

The research supports keeping that direction (see §2).

---

## 2. Evaluation of monetisation models

| Model | Fit | Verdict |
|---|---|---|
| **B2B SaaS licence to colleges** | Colleges already pay for career tools (VMock) and assessments (Mettl) through the institution [S15][S18]; product is built for it | **Primary** |
| Per-student (per-seat) pricing | Matches how colleges budget placement training (e.g. FACE Prep priced per student [S22]); scales with batch size | **Primary pricing unit** (with a minimum) |
| Tiered institutional plans | Lets a college start with one batch and expand | **Yes** — three tiers below |
| Free student access, institution pays | Removes friction for students; matches the product's design | **Yes** — core principle |
| Freemium for individuals | B2C case prep is crowded (PrepLounge, Road to Offer, RocketBlocks) and price-anchored by free AI | **Optional top-of-funnel only:** browse free, no grading |
| Paid premium features to students | Splits the student body, angers colleges | **No** for licensed campuses |
| Enterprise / multi-campus contracts | Several Indian education groups run multiple B-schools | **Later** (Enterprise tier) |
| Setup / onboarding / customisation fees | Custom case sets, faculty training, content import are real work | **Secondary revenue stream #1** |
| Paid integrations / additional services | No integrations exist yet; services (custom case writing, mock-assessment days) plausible | **Secondary revenue stream #2** (services) |
| Retail B2C subscription | Low price ceiling (₹499–₹1,999 anchors [S16]); payments not live | **Deprioritised**; revisit after institutional traction |

**Recommendation:** an **institutional annual licence priced per enrolled
student, with a minimum contract**, with optional paid onboarding and
custom-content services. Students never pay.

---

## 3. The recommended model in detail

| Question | Answer |
|---|---|
| **Who pays?** | The institution: the Director's or Dean's office, often from the placement/training budget. In private institutes, management or trustees approve the spend. *(Budget owner to be confirmed in discovery calls.)* |
| **What for?** | Placement-ready students: practice across every placement format, faculty tools, the placement dashboard, and integrity controls that make practice usable as graded coursework |
| **Why would they pay?** | Placement statistics drive admissions demand **[Inference — validate]**; faculty time is scarce; current prep is manual and unmeasured; colleges already pay for GD/PI training, aptitude vendors and proctoring separately |
| **Pricing unit** | Per enrolled student per academic year ("seat"), annual contract, invoiced (PO + bank transfer; GST invoice) |
| **Scaling** | Lower per-seat price at higher volume; contract minimum to cover onboarding cost |
| **Free for students** | Everything in the licence; individuals outside licensed colleges can browse cases free but not submit for grading (`can_solve` gate) |
| **First customers** | Design-partner pilots at 3–5 private PGDM/MBA institutes, converted to paid for the next academic year (see `go_to_market.md`) |
| **Retention / expansion** | Faculty-authored content and assignment history create switching costs; expand from one batch to the full programme, then to sister campuses; add services |
| **Sales-cycle challenges** | Academic-year budget timing, committee decisions, need for references, faculty scepticism of AI grading, privacy review of camera use |
| **Why sustainable** | Software gross margin is high at realistic usage (see `financial_scenarios.md`), and AI cost per seat is capped by quota. **But** the 1 Jan 2027 doubling of Gemini prices makes the worst case unprofitable at low prices (§5) |

---

## 4. Illustrative pricing tiers (hypotheses for Indian B-schools)

| | **Starter** | **Professional** | **Enterprise** |
|---|---|---|---|
| **Target customer** | One batch or one programme at a smaller institute | Whole MBA/PGDM programme (both years) | Multi-campus groups, universities |
| **Illustrative price** | **₹700 per student / year**, minimum ₹70,000 (100 students) | **₹600 per student / year**, minimum ₹1,50,000 (250 students) | **₹450–₹500 per student / year**, from 1,000 students; custom |
| **Billing** | Annual, upfront | Annual, upfront (or 50/50 by semester) | Annual or multi-year |
| **Student limit** | Up to 200 | 200–1,000 | 1,000+ |
| **AI fair use / student / year** | 150 graded answers, 20 AI interview / role-play sessions | 250 graded answers, 50 sessions | Contract-defined |
| **Included** | Case library, all practice formats, AI grading, aptitude/SQL/Excel, exam-mode proctoring, placement dashboard, up to 5 faculty accounts | Everything in Starter + unlimited faculty, faculty-authored and imported cases, assignment and marking workflow, GD rooms, cohort reports | Everything + custom case sets, multi-campus reporting, data-processing agreement, priority roadmap input |
| **Support** | Email; onboarding webinar | Named contact; on-site or live faculty training session | Dedicated success manager; SLA |
| **Upsells** | Move to Professional; custom case pack | Mock placement-assessment days; custom case writing; placement-week GD marathons | Integrations (once built); white-label content |

**Pilot offer (hypothesis):** 8–10 weeks free for one batch of up to 120
students, in exchange for usage data, faculty time logs and a
reference/testimonial if outcomes are positive. Conversion is priced at
Starter or Professional for the next academic year.

### Why these numbers (reasoning, not proof)

| Benchmark | Figure | Source | What it implies |
|---|---|---|---|
| Big Interview institutional (50 / 100 / 200 learners) | $975 / $1,500 / $2,200 per year → ≈ ₹1,716 / ₹1,320 / ₹968 per learner | Official [S13] | A global B2B interview tool lands at ₹1,000–1,700 per learner. ₹450–700 is a deliberate India discount |
| Unstop Pro (individual) | ₹1,999 / year | [S16] | Indian students pay up to ~₹2,000 themselves for prep subscriptions |
| IMS GDPI programme | ₹6,000 + GST (PI-only ₹2,500 + GST) | Official [S20] | Students value GD/PI prep at several thousand rupees per season |
| PrepLounge Premium | ~$69–79 / yr (≈ ₹6,000–7,000) | Third-party [S9] | International B2C anchor is ~10× our per-seat price |
| Road to Offer | $249 / yr | Own blog [S11] | AI case grading sells B2C at ~₹22,000 / yr internationally |
| FACE Prep (2018 university contract) | ₹33 per student-hour + GST | [S22] | Colleges buy placement training per student; a 20-hour module ≈ ₹780 / student |
| Our AI cost per seat (realistic usage, 2027 prices) | ~₹69 | `financial_scenarios.md` | Price must stay well above ~₹100 to protect margin |

**Value argument [Assumption to validate]:** a college paying ₹600 per student
per year is spending less than one GD/PI coaching course per student, to cover
every student, every placement format, and give faculty and the placement
cell oversight.

---

## 5. The pricing risk the code reveals

Unit costs, from tokens measured in the codebase × Google's official prices [S6]:

| Action | Today (to 31 Dec 2026) | From 1 Jan 2027 (prices double) | With Gemini 3.1 Flash-Lite instead (if quality holds) |
|---|---|---|---|
| One graded answer (worst case: 20,000-char answer; 5,271 input + 1,126 output tokens) | ₹0.72 | **₹1.44** | ₹0.26 |
| One AI interview (≈9 turns) | ₹2.16 | **₹4.32** | not measured |
| Worst case per student at the full Pro quota (250 + 50) | ₹288 | **₹576** | — |

**Implication:** at ₹450–600 per seat, a student who uses the full Pro quota
in 2027 costs more in AI than they pay. The safeguards already in code
(quota, platform-wide daily cap) bound the damage, but pricing must assume:
1. **Lower default quotas** in Starter (150 + 20 → worst case ≈ ₹303 per seat in 2027), or
2. **A cheaper model for grading** (Flash-Lite cuts grading cost ~5×; needs a quality comparison — `scripts/compare-providers.ts` exists for this), and/or
3. **Context caching**, since 84% of a grading prompt is identical across a batch (`src/lib/constants.ts` comment); cached input is billed at 10% [S6].

Realistic average usage is far below the cap (see scenarios), but a contract
must be priced for the worst case it can be held to.

---

## 6. Secondary revenue streams

1. **Onboarding and customisation (one-time):** faculty training, importing
   the college's existing case material, custom case packs by specialisation.
   *Hypothesis:* ₹25,000–₹1,00,000 per engagement.
2. **Assessment services:** running proctored mock placement assessments or GD
   marathons in placement week, with a report to the placement cell.
   *Hypothesis:* ₹200–₹400 per student per event.

Not recommended yet: selling student data or recruiter access (privacy risk,
DPDP), advertising, or a B2C paywall on licensed campuses.
