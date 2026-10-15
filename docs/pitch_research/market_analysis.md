# Market analysis — CaseCode

*Phase 7. Sourced statistics and our own assumptions are kept in separate
tables. Market-research headline figures are deliberately **not** used for
sizing: published estimates for "India test preparation" range from about
USD 244 million to USD 11.6 billion depending on definition [S28]. That
spread makes them useless for a placement-prep pitch. The sizing below is
bottom-up.*

---

## 1. Market category

**Placement-readiness software for Indian management education** —
practice, assessment and oversight tools licensed by business schools for
their MBA/PGDM students. Adjacent categories: case-interview prep (global),
career-services software (VMock, Big Interview), and assessment/proctoring
(Mettl, Talview).

## 2. Sourced statistics

| Statistic | Figure | Source | Reliability |
|---|---|---|---|
| AICTE-approved management intake (MBA/PGDM seats), 2022-23 | **4,22,628 seats** | AICTE portal data via Careers360 [S1] | Good (official data, secondary report) |
| Management enrolment, 2022-23 | **2,85,367 students** (67.5% of seats filled) | [S1] | Good |
| Trend | Seats 3.72L (2019-20) → 4.23L (2022-23); occupancy 65.5% → 67.5% | [S1] | Good |
| Management institutions approved, 2024-25 | ~3,500 institutions; 3,47,644 seats *(reported for 2024-25 approvals)* | Secondary blog citing AICTE Annual Report 2024-25 [S2] | **Weak — verify against the AICTE annual report** |
| AICTE-approved MBA/PGDM colleges listed | 3,643 | Collegedunia listing [S3] | Weak (commercial aggregator) |
| NIRF 2025 management institutions in the data | ~909 (530 with no publications, 58.3%) | Careers360 table [S5] | **Weak — garbled table; confirm on nirfindia.org** |
| CAT 2025 | 2.95 lakh registered; ~2.58 lakh appeared | Careers360 [S4] | Good |
| DPDP Rules 2025 | Notified Nov 2025; core obligations from ~May 2027; educational-institution exemptions are conditional | EY, ORF [S27] | Good (secondary legal summaries) |
| Indian B-schools already buying AI career tools | Jaipuria uses VMock, Rezi and others in an "AI placement lab"; Amrita launched an AI mock-interview platform (Mar 2026) | [S24][S25] | Good (institutional sources) |

## 3. Our assumptions (not sourced)

| # | Assumption | Value | Why |
|---|---|---|---|
| M1 | MBA/PGDM programmes are mostly 2 years, so students enrolled at any time ≈ 2 × annual enrolment | ~5.7 lakh students | Ignores 1-year programmes and attrition; **may overstate** |
| M2 | Average price per student per year | ₹600 | Base-case hypothesis (`business_model.md`) |
| M3 | Average contract per institution | ₹1.8L | Base case (`financial_scenarios.md`) |
| M4 | Institutions able and willing to buy external placement tools ≈ NIRF-participating management institutions | ~900 | Proxy for "organised, placement-focused, budget-holding" institutes; **unvalidated** |

## 4. Market sizing (bottom-up)

| | Method | Result | Note |
|---|---|---|---|
| **TAM** — every Indian MBA/PGDM student licensed | 5.7L students (M1) × ₹600 (M2) | **≈ ₹34 Cr / year** (~US$3.9M) | Student-based |
| TAM (cross-check) | ~3,500 institutions [S2] × ₹1.8L (M3) | ≈ ₹63 Cr / year | Institution-based; small institutes would pay less |
| **SAM** — placement-focused institutes (M4) | ~900 × ₹1.8L | **≈ ₹16 Cr / year** | Same if computed as ~2.7L students × ₹600 |
| **SOM** — 3-year obtainable | 30–60 institutions × ₹1.8L | **≈ ₹54L – ₹1.1 Cr ARR** | 3–7% of SAM; founder-led sales |

### The honest investor point
**The core Indian B-school market is small in rupee terms: roughly ₹34–63
crore a year if every institution bought.** That is enough for a profitable,
focused business, but **not a venture-scale market on its own.** A
venture-scale story needs one or more expansions, each still to be sized
and validated:

1. **Undergraduate management programmes** (BBA/BMS). AICTE now regulates BBA/BMS approvals from 2024-25 [S2], which suggests a large, newly organised segment. Size not yet sourced.
2. **Placement readiness beyond MBA**: aptitude, GD, PI and SQL/Excel for engineering and commerce graduates (the FACE Prep market [S22]).
3. **Recruiter-side assessments**: the proctored-assessment engine is already built (the Mettl/Talview market [S18][S19]).
4. **International B-schools** in South and Southeast Asia, the Middle East and Africa, at Big Interview-like prices [S13].

Pitch to colleges with the focused market. Pitch to investors with the
focused beachhead **plus** a named, sized expansion path. Size expansion 1 and 2 before an investor meeting.

---

## 5. Ideal customer profile (ICP)

| Attribute | Initial ICP |
|---|---|
| Type | Private, AICTE-approved PGDM or MBA institute; **not** IIMs or top-10 schools (they have alumni networks and global vendors) |
| Size | 120–360 students per year; 2-year programme (250–700 students on campus) |
| Placement pressure | Publishes placement reports; competes on placements in admissions marketing **[inference — validate]** |
| Ranking stage | NIRF-participating or aspiring; accredited (NBA/AACSB/SAQS) or seeking it — needs evidence of structured student development |
| Current prep | Manual: club casebooks, guest mock interviews, a GD/PI training vendor for a few weeks a year |
| Geography | One metro cluster dense in private B-schools, chosen for the founding team's reach — e.g. Pune–Mumbai, Bengaluru, Delhi NCR, Hyderabad *(choose one; this is an assumption)* |
| Tech readiness | Students use their own laptops with webcams; college email domain exists (needed for auto-enrolment) |

**Narrow initial segment (recommended):** 20–30 private PGDM/MBA institutes
in one metro cluster, intake 120–360, with an active placement cell. Win 3–5
design partners there before expanding.

## 6. Decision-makers and budget owners (to confirm in discovery)

| Role | Part in the decision | What they care about |
|---|---|---|
| Director / Dean | Final decision; academic sign-off | Placement outcomes, rankings/accreditation evidence, reputation |
| Chairman / Trustee / Management (private institutes) | **Budget owner** for new spend | Cost per student, admissions impact |
| Head of Placements / Corporate Relations | **Champion**; day-to-day owner | Student readiness, who isn't preparing, recruiter feedback |
| Area chairs / faculty (strategy, finance, marketing) | Users; can block | Grading credibility, workload, control over marks |
| Student placement committee | Influencer | Peer adoption, perceived usefulness |
| Admin / IT / Data protection | Procurement gate | Data location, privacy, camera use, DPDP |

## 7. Adoption barriers

1. **Budget timing:** spend is typically planned around the academic year *[inference]*; a mid-year purchase needs discretionary funds.
2. **Trust in AI grading:** faculty must see agreement with their own marks.
3. **Privacy pushback** on camera proctoring from students or parents; DPDP compliance obligations from ~May 2027 [S27].
4. **Incumbent vendors:** GD/PI trainers, VMock, Mettl or a placement portal already under contract.
5. **No references:** colleges ask "who else uses it?"; today the answer is nobody.
6. **Infrastructure:** campus Wi-Fi may block peer-to-peer video for GDs until a TURN relay is set up.
7. **Student fatigue:** another platform among many; engagement is not guaranteed.
