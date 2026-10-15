# Pitch deck blueprint — CaseCode

*Phase 11. A 12-slide structure. The story arc:*
**Problem → Solution → Evidence → Differentiation → Customers → Revenue → Growth.**

Two versions share one spine:
- **College version** (Directors, placement heads, faculty): replace slides 6 and 10 with "Pilot plan and what we need from you" and "Data protection and integrity".
- **Investor/partner version**: as below.

**Rule for every slide:** the honest state is "built and ready to pilot",
not "proven". Never show user counts, testimonials, logos or outcomes until
they exist.

---

### Slide 1 — Title
- **Main message:** CaseCode — placement practice that faculty can assign, mark and trust.
- **Content:** name, one-line pitch, presenter, date. One product screenshot (the graded-feedback screen).
- **Evidence:** none needed.
- **Visual:** screenshot of per-criterion feedback.
- **Source:** product.
- **Validate:** none.

### Slide 2 — The problem
- **Main message:** students prepare for case/GD/PI rounds with little feedback, and colleges can't see who is preparing until placements expose it.
- **Content:** three student pains (volume, consistent feedback, pressure); three college pains (manual mocks, no visibility, scarce faculty marking time).
- **Metrics:** 4.2 lakh approved management seats / 2.85 lakh enrolled per year [S1] — the scale of the student base.
- **Visual:** two-column "Student | College" pain table.
- **Source:** `PRODUCT.md` (thesis); [S1].
- **Validate:** **problem severity has not been tested.** Add 2–3 quotes from discovery calls before using this slide externally.

### Slide 3 — Our solution
- **Main message:** one platform for every placement format, with AI feedback for students and control for faculty and placement cells.
- **Content:** a loop diagram — Student practises → AI grades per criterion → Faculty reviews and marks → Placement cell sees readiness → Faculty assigns next practice.
- **Visual:** circular flow diagram.
- **Source:** `feature_inventory.md` §1, §4–5.
- **Validate:** none (describes built capability).

### Slide 4 — Product (demo or screenshots)
- **Main message:** it works today.
- **Content:** 4 screenshots: (1) case with rubric feedback, (2) live GD room with AI scores, (3) faculty review queue (AI grade + faculty mark), (4) placement dashboard. Optional fifth: the "test has ended" screen.
- **Metrics:** 969 cases · 6 domains · 20 formats · 314 aptitude questions · 21 Excel / 15 SQL exercises · 20 GD topics (production DB, 13 Oct 2026).
- **Visual:** 2×2 screenshot grid; live demo if possible.
- **Source:** production DB; `feature_inventory.md`.
- **Validate:** say clearly that cases are AI-generated from analytical archetypes; mention the expert-review plan.

### Slide 5 — Who it's for
- **Main message:** students use it; colleges buy it.
- **Content:** users vs buyer table (student, faculty, placement head, Director/management); the ICP (private PGDM/MBA, 120–360 intake, one metro cluster).
- **Visual:** stakeholder value matrix (condensed from `stakeholder_value_and_risks.md` §4).
- **Source:** `market_analysis.md` §5–6.
- **Validate:** budget owner and decision process per institute.

### Slide 6 — Market opportunity
- **Main message:** a focused beachhead with a clear expansion path.
- **Content:** TAM ≈ ₹34–63 Cr/yr (Indian MBA/PGDM); SAM ≈ ₹16 Cr/yr (~900 placement-focused institutes); SOM ≈ ₹0.5–1.1 Cr ARR in 3 years (30–60 institutes). Expansion: UG management, engineering placement readiness, recruiter assessments, international B-schools.
- **Visual:** concentric TAM/SAM/SOM circles + expansion arrows. **Label the arrows "to be sized".**
- **Source:** `market_analysis.md` §2–4; [S1][S2][S3][S5].
- **Validate:** institution counts (AICTE annual report; NIRF list); size the expansion segments before an investor meeting.

### Slide 7 — Competition and differentiation
- **Main message:** others do parts; nobody reviewed does the college-facing loop for Indian placement formats.
- **Content:** a condensed comparison of CaseCode vs CaseCoach, PrepLounge, Road to Offer, Big Interview, Unstop, Mettl/Talview, and coaching GDPI programmes on: Indian placement formats, faculty marking, institution dashboard, proctoring, price.
- **Visual:** the positioning map + a 5-row checkmark table.
- **Source:** `competitor_analysis.md` §3–4.
- **Validate:** confirm every ✖ in a demo or trial; "not found" ≠ "doesn't exist" — say "in our review".

### Slide 8 — Business model and pricing
- **Main message:** an annual institutional licence per student; students never pay.
- **Content:** Starter ₹700 / Professional ₹600 / Enterprise ₹450–500 per student per year (with minimums), plus onboarding and assessment services. Benchmarks: Big Interview ≈ ₹970–1,700/learner/yr [S13]; IMS GDPI ₹6,000 + GST per student [S20]; Unstop Pro ₹1,999 [S16].
- **Visual:** three-column tier table; benchmark bar chart.
- **Source:** `business_model.md`.
- **Validate:** **label all prices as proposed**; test in discovery calls.

### Slide 9 — Go-to-market
- **Main message:** founder-led pilots with placement heads in one city, converted to paid for the next academic year.
- **Content:** pilot design (8–10 weeks, one batch, agreed KPIs); channels (direct placement-head outreach, faculty-first entry, ambassadors, case competitions on Unstop); conversion path.
- **Visual:** funnel: discovery calls → pilots → paid → referrals.
- **Source:** `go_to_market.md`.
- **Validate:** pilot interest (number of institutes agreeing).

### Slide 10 — Economics
- **Main message:** strong unit economics at ₹1.5L+ contracts; contract size is the lever.
- **Content:** base case: ACV ₹1.8L, ~77% gross margin, break-even ≈ 18 institutions at ₹25L fixed costs; ARR at 5/20/50/100 institutions = ₹9L / ₹36L / ₹90L / ₹1.8 Cr. Show the low and high cases alongside. Note the 2027 AI price doubling and its mitigation.
- **Visual:** ARR bar chart by scenario; one-line break-even callout.
- **Source:** `financial_scenarios.md`.
- **Validate:** **title it "Illustrative scenarios", not "Forecast"**; replace the fixed-cost assumption with the real team plan.

### Slide 11 — Roadmap, validation and milestones
- **Main message:** what we'll prove next and how we'll know.
- **Content:** six phases (Validation → MVP readiness → Pilots → First paid → Expansion → Growth) with exit criteria; pilot KPIs (activation ≥ 70%, weekly active ≥ 40%, AI–faculty agreement reported, conversion ≥ 50%).
- **Visual:** timeline with gates.
- **Source:** `go_to_market.md` §7; `stakeholder_value_and_risks.md` §5.
- **Validate:** dates depend on the team's capacity and college calendars.

### Slide 12 — Close: why us, and the ask
- **Main message:** built, ready to pilot, and here is exactly what we need.
- **Content (college):** "Pilot with one batch this term: 60–120 students, one faculty champion, 10 weeks, a readout with your data." **(Investor):** amount, use of funds (pilots, content review, first sales/support hire, AI cost runway), 12-month milestones.
- **Visual:** three-item ask list.
- **Source:** team decision.
- **Validate:** the team slide is missing — **team background is not in the repository** and must be added.

---

## Recommended changes to the suggested structure

- **Add a short "Trust and integrity" slide in the college version**
  (data in Mumbai, on-device camera checks, 30-day photo deletion, AI grades
  advisory, faculty reopen). College IT and faculty will block a deal on these
  questions, not on features.
- **Merge "Product demo" and "Solution"** if time is short; a live
  10-minute demo beats four screenshots.
- **Add a "Team" slide** for investors (missing information).
- **Do not include a traction slide** until pilots produce data. Replace it with "Validation plan and success criteria".
