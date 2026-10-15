# CaseCode — executive summary

*One page. 13 October 2026. Figures from the repository, the production
database and sources in `sources.md`. Prices and projections are hypotheses.*

**What are we building?**
CaseCode is a web platform for Indian business schools where MBA/PGDM
students practise every placement format — business cases (969 published, 6
domains, 20 formats), live group discussions, personal interviews, written
tests, aptitude, SQL/Excel, negotiation and sales role-plays. Each attempt
gets instant AI feedback against an explicit rubric. Faculty can set the same
practice as coursework, review the AI's grade and give the final mark. Tests
run under exam conditions: tab switching, a phone on camera or a covered
camera ends the test, checked on the student's own laptop. The placement cell
sees who has never started and where the batch is weak. The product is built
and live (Next.js, Supabase in Mumbai, Google Gemini). **It has no users,
pilots or revenue yet.**

**Who needs it?**
Students preparing for case, GD and interview rounds with little feedback; the
faculty who cannot mark weekly practice at scale; and the placement heads
accountable for outcomes. The buyer is the institution, initially private
PGDM/MBA institutes with 120–360 students a year, in one metro cluster.

**What problem does it solve?**
Placement preparation at most colleges is manual (casebooks, volunteer mocks,
short coaching stints), unmeasured, and uneven across students. Students lack
volume and consistent feedback; colleges lack visibility and faculty time.
*This is our thesis; it has not been validated with users yet.*

**Why is it different?**
Competitors cover parts of this: CaseCoach (case prep for global
universities), PrepLounge, RocketBlocks and Road to Offer (B2C case prep, some
with AI rubric grading), Big Interview, Yoodli and VMock (generic interview and
resume AI), Mettl and Talview (assessment proctoring), and coaching institutes
(GD/PI). In our review, **none combines the Indian placement format set, a
faculty assign-and-mark loop, a placement dashboard and exam-grade integrity in
one institutional licence.** Free general AI is the biggest substitute for
individual students; it is not a substitute for a college that needs
consistency, oversight and integrity.

**Who pays us?**
The institution. Students never pay.

**How do we make money?**
An annual licence per enrolled student, with a contract minimum (proposed
₹450–₹700 per student per year across three tiers), plus onboarding and
assessment-day services. For comparison: Big Interview's published
institutional price works out at ~₹970–1,700 per learner a year [S13]; IMS
charges students ₹6,000 + GST for a GD/PI programme [S20]. Base case: ₹1.8 lakh
per institution per year, ~77% gross margin, break-even near 18 institutions
on a ₹25 lakh/year cost base. AI cost per seat is ~₹69 at realistic usage, but
Gemini prices double on 1 January 2027 [S6], so quotas and model choice must
be set before signing fixed-price contracts.

**How large could the opportunity be?**
India approves ~4.2 lakh management seats and enrols ~2.85 lakh students a
year [S1]. Licensing every MBA/PGDM student would be worth roughly **₹34–63
crore a year**. Our serviceable segment (~900 placement-focused institutes) is
**~₹16 crore**, and a realistic 3-year target is **₹0.5–1.1 crore ARR** (30–60
institutes). That supports a focused, profitable business. A venture-scale
case needs expansion beyond MBA (UG management, engineering placement
readiness, recruiter assessments, international business schools), which we
have **not yet sized**.

**What is our next step?**
1. Fix the pilot blockers: restore hints and learning paths, set up the GD
   relay server, write a DPDP privacy notice, switch on backups.
2. Have faculty or alumni blind-review 30 cases.
3. Hold 15–20 discovery calls with placement heads to test the problem and price.
4. Run 3–5 free 8–10 week pilots with agreed KPIs (activation ≥ 70%, weekly
   active ≥ 40%, AI–faculty grade agreement reported).
5. Convert at least 2 pilots to paid contracts for the next academic year.
