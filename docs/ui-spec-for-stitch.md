# CaseCode — complete UI specification

For feeding into Google Stitch (or any UI generator). Everything below is what
the product actually is today, not what it might become.

---

## 1. What the product is

**CaseCode — "LeetCode, but for business decisions."**

MBA students and consulting/finance/PM candidates practise realistic business
cases, write a structured answer, and get graded by AI against an explicit
rubric — points per criterion, not a vague score. Teachers set those cases as
assignments to their batches and mark them. One admin (the owner) runs the
platform and sells campus licences.

- Audience: Indian MBA students and campus placement cells; consulting, finance
  and product interview prep.
- Currency ₹ (INR). Pro is ₹499/year.
- Library: **508 published cases across 6 domains**.
- Tone: direct, unsentimental, slightly blunt. Copy sounds like a good coach,
  never like a marketing site. Examples of the actual voice:
  - "Theory is not the bottleneck. Reps are."
  - "Weakest first — the list to build revision around."
  - "The dents are your homework."
  - "Consistency beats intensity. Every square is a day."
  - "Scores are indicative — argue with the feedback, that's part of the practice."
  - "Check whether the rubric is unfair before assuming students are weak."

---

## 2. Design system in place

Keep these. The redesign should improve layout and hierarchy, not re-theme.

**Type**: Geist Sans (UI), Geist Mono (all numbers, code, answer textareas,
join codes). Numbers use tabular figures.

**Radius**: `0.625rem` (10px) base.

**Dark-first.** Dark is the default; light exists. Palette in OKLCH:

| Token | Dark (default) | Light |
|---|---|---|
| background | `oklch(0.145 0.003 285)` | `oklch(0.995 0 0)` |
| foreground | `oklch(0.96 0.001 285)` | `oklch(0.16 0.004 285)` |
| card | `oklch(0.178 0.004 285)` | `oklch(1 0 0)` |
| border | `oklch(0.27 0.005 285)` | `oklch(0.918 0.004 285)` |
| primary (indigo/blue) | `oklch(0.65 0.18 264)` | `oklch(0.52 0.19 264)` |
| muted-foreground | `oklch(0.68 0.008 285)` | `oklch(0.53 0.011 285)` |
| success (green) | `oklch(0.7 0.16 149)` | `oklch(0.62 0.17 149)` |
| warning (amber) | `oklch(0.78 0.16 70)` | `oklch(0.72 0.17 70)` |
| destructive (red) | `oklch(0.66 0.2 25)` | `oklch(0.58 0.22 27)` |

**Stack**: Next.js App Router, Tailwind v4, shadcn/ui on Radix, lucide-react
icons, sonner toasts.

**Components available**: avatar, badge, button, card, dropdown-menu, input,
label, progress, select, separator, skeleton, tabs, textarea.

**Layout shell**: fixed top bar (logo left; notification bell, theme toggle,
avatar menu right) + collapsible left sidebar with grouped sections. Content
max-width ~1100px, generous whitespace, cards on a slightly lighter surface
than the page.

---

## 3. Three separate dashboards — hard walls

Roles: `student`, `teacher`, `admin`, `recruiter`.

Each role has its **own home and cannot reach the others**. Visiting another
role's home redirects to your own. This is deliberate — they must not feel like
one app with a role switcher.

| Role | Home | Sidebar sections |
|---|---|---|
| student | `/dashboard` | PRACTISE · YOU · COMMUNITY |
| teacher | `/teacher` | TEACHING · LIBRARY · COMMUNITY |
| admin | `/admin` | PLATFORM · COMMERCIAL |

**How roles are assigned**: everyone who signs up is a student. Teacher/admin
comes from an email allowlist an admin manages at `/admin/access`.

**Sidebar link sets**

- Student: Dashboard, Cases, Paths, Groups, Progress, Bookmarks, Leaderboard, Classrooms
- Teacher: Dashboard, Batches, Assignments, Question bank, Cases, Paths, Classrooms
- Admin: Overview, Users, Access, Case library, Licences, Renewals, AI usage

---

## 4. STUDENT DASHBOARD (`/dashboard`)

Greeting by first name + one line of coaching that changes with state
("Your first case is the hardest. Start with an easy one."). Primary button:
**Solve a case**.

Widgets, in current order:

1. **Daily case** — highlighted band. Case title, domain badge, difficulty,
   time estimate, CE reward, a live "Resets in HH:MM:SS" countdown, **Solve now**.
2. **Four stat cards**: Cases solved (+ attempted) · Average score · Current
   streak (+ longest) · Global rank (+ points).
3. **Points by week** — bar chart, last 8 weeks.
4. **Activity heatmap** — GitHub-style, last 8 weeks, "Less → More" legend,
   "N submissions · N active days".
5. **Your allowance** — quota meter. "60 left of 60", rolling 365 days, upsell
   to Pro (250 graded answers + 50 interviews).
6. **Skill radar** — average score per domain across all six, with solved
   counts. Empty until the first case.
7. **Level + CE progress** — "Level 1 · 0 CE · 50 to level 2".
8. **Badges** — earned badges or "No badges yet."
9. **Add your school** — prompt to enable campus leaderboard.
10. **Quote card** — rotating business quote with attribution.
11. **Recent activity** feed.
12. **Pick up where you left off** — 3 case cards with time estimates.

---

## 5. STUDENT — other screens

### `/cases` — Case library
Header "Case library / 508 cases · pick one and commit to a recommendation."
Two view modes: **List** and **By Track**, plus a **Saved** filter.
Filter row: search, All domains, Any difficulty, All companies, All formats,
All firm styles, and a sort. Table columns: **Title · Domain · Difficulty ·
Time · Solve rate**, with company badge (Amazon, McKinsey, BCG, Bain, Flipkart,
Google, Stripe, Goldman Sachs) next to the title. Paginated; "Showing all N cases".

### `/cases/[slug]` — Case detail (the core screen)
Title, then badges: domain, difficulty, time, submission count, company track,
Save button, **Next question** button (top-right).

Tabs: **Problem · My Solution · Interview · Top Solutions · Discussion · Hints ·
Report · AI Review**

- **Problem**: Scenario prose (key figures bolded), a **Supporting data** panel
  with labelled numeric groups (Financials, Derived Hints, Proposed Round…),
  "Your task" with 3 required sections, and "Ready to move forward? Up next: …".
  Right rail: **How you'll be graded** — rubric criteria with weights (e.g.
  80 points, 60% to pass; Recommendation 20, Market Analysis 20, Risk 20,
  Financial 20) and a collapsible **Hint**.
- **My Solution**: toggle **Structured** / **Free text**. Structured = three
  monospace textareas — *Framework* (how you're breaking it down), *Analysis*
  (the working, compute don't describe), *Recommendation* (commit, and say what
  would change your mind). Each shows a character count against a **minimum**,
  turning green when met. Word count + total limit at top. "Draft saved locally
  as you type." Right rail: **Your attempts**. Button: **Submit for evaluation**
  → spinner "Evaluating…" (~20s).
- **AI Review**: **Total score 63/80** with a big percentage badge, then a
  horizontal bar per criterion (colour-coded by performance), a one-paragraph
  verdict, then three lists: **Strengths**, **Where you lost points**,
  **Next time**. Footer: "Graded by <model> against this case's rubric."
  Right rail: the student's own submitted answer, section by section.
  Top banner: "Ready for the next challenge? Up next: …" + Next question.

### `/paths` — Learning paths
"Ordered sequences. Clear a step to unlock the next one." Cards per track
(Finance, Consulting, Product Management, …), each with description, progress
"0 of 20 steps", and **Start**. 29 paths × 20 steps.

### `/leaderboard`
"Ranking of all N students on the platform. Ties break on accuracy."
Toggle **Global / campus**. Period tabs: All time · This week · This month.
Sort: Points · Accuracy · Cases solved. Table: rank (crown for #1, medals #2–3,
number after) · avatar + name (own row highlighted, "You" badge) · Points ·
Solved · Accuracy. Ties share a rank.

### `/groups`
Study groups. Public groups are visible to everyone and joinable directly;
private groups are hidden and need a **6-character join code** (e.g. `BNN592`,
no confusable O/0/I/1). Create group form, join-by-code modal, group cards with
member count and a private/public indicator.

### `/classrooms`
Batches the student has joined + everything their teacher has set. Separate
subsection for **material teachers have published publicly to the whole
platform**. Join a batch by code.

### `/progress`, `/bookmarks`, `/notifications`, `/profile`, `/u/[id]`
Progress analytics; saved cases; notification list; own profile; public profile.

### `/settings`
Tabs: **Profile · Practice · Workspace · Notifications · Privacy & Data · Account**
- Profile: full name, email (read-only), university (autocomplete), career goal.
- Notifications: one real toggle — classroom & assignment activity. In-app only.
- Privacy & Data: show on leaderboard · share history with cohort · show college
  affiliation. These genuinely change what others see.

---

## 6. TEACHER DASHBOARD (`/teacher`)

Header "Dashboard / N students across N batches." Buttons: **New question**,
**New assignment**.

1. **Four stat cards**: Students (+ active in 14 days) · Awaiting review
   (+ already marked) · Active assignments (+ past due) · Class average
   (+ graded submissions).
2. **Alert band** when work is waiting: "N awaiting resubmission — You asked
   these students to try again. They reappear here once they hand in."
3. **Upcoming deadlines** — assignment, due date, submitted count.
4. **Weakest domains** — horizontal bars per domain with %. "Weakest first —
   the list to build revision around."
5. **Your batches** — name, student count, and the **join code** in monospace.

### `/teacher/assignments` and `/teacher/assignments/[id]`
List: title, status pill (**All marked** / **N to mark**), batch · due date ·
"out of N", a progress bar, and "N / N in".

Detail page: title, batch/due/max, instructions, "Open the case yourself" link.
Four stats: Submitted (N/N + not started) · Awaiting review · AI average ·
Your average. **Score distribution** — 5 histogram bands (0–19 … 80–99).
Filter chips with counts: All · Not started · Awaiting review · AI graded ·
Reviewed · Resubmission requested. Student search.

Each student row expands to: **their full answer**, the **AI grade** with
per-criterion scores, strengths, gaps, next-time — then the teacher's own
**Marks (out of N)** input and **Remarks** textarea, with **Save and notify**
and **Ask for another attempt**. The AI score is explicitly advisory:
"advisory only. Your mark is the one that counts."

### `/teacher/questions/new` — Write a question
Dropzone: "Start from a document" (Word/Markdown/text, under 2MB) that parses
headings into fields. Then: **Basics** (title, batch, format, domain,
difficulty) → **The case** (scenario, what the student must do, strong
approaches, reference answer) → **Hints** (added one at a time, each costs the
student points) → **Rubric** (criterion name + weight rows, live "totals N
points", add/remove). Actions: **Publish question** / **Save as draft**.

### `/teacher/batches`, `/teacher/batches/[id]`
Batch list and roster with join code, member management.

---

## 7. ADMIN DASHBOARD (`/admin`)

Header "Admin / Licences, revenue, usage and content." Grouped stat sections:

**PEOPLE** — Total users (breakdown: N students · N teachers · N admins) ·
Active (30 days) + % · New (30 days) · Never started ("signed up, never
attempted a case").

**ACTIVITY** — AI calls (graded/interviews) · Tokens used · Seats (used/licensed) ·
Institutions (expired/suspended).

**COMMERCIAL** — Annual contract value ₹ · AI spend to date ₹ (+ "₹47,520/yr
infra") · Gross margin · Cost per active user ₹.

Then: three counters (Cases · Students · Submissions), **Recent cases** list
(title, age, submission count, Live/Draft), and **Hardest cases** — lowest
average score, with the caution "Check whether the rubric is unfair before
assuming students are weak."

### `/admin/users`
"N accounts." Search + role filter chips (All/Student/Teacher/Admin/Recruiter).
Table: user (name + email) · Role badge · Institution · Solved · CE · Last
active · **Deactivate** action. Deactivation is reversible and never deletes.

### `/admin/access`
The email allowlist that decides who gets which dashboard. Add form: email,
role select (Teacher/Admin/Recruiter), optional note, **Grant access**. List
rows show shield icon, email, note, role badge, and a **signed up / awaiting
signup** badge, with revoke. Explanatory line: "Anyone who signs up is a
student. Listing an email here is the only way to change that."

### `/admin/usage`
"Measured per call, priced at the rates in force when it ran."
Stats: Total spend · Graded answers · Interviews · Cost per student.
Tables: **Spend by institution** (calls, students, spend, per student) and
**Spend by model** (model name, ₹, token count).

### `/admin/cases`
"510 total" + **New case**. Table: Title · Domain · Difficulty · Submissions ·
Avg · Status · Edit. Paginated (11 pages).

### `/admin/licences`, `/admin/licences/[id]`, `/admin/renewals`
Campus contracts: annual contract value, AI cost to date, gross margin, seats
used. Renewals shows contracts expiring within 60 days with the note "Low
utilisation is the strongest predictor of a lapsed renewal."

---

## 8. Signed-out / marketing

- `/` — Badge "500+ cases across 6 domains", headline "LeetCode, but for
  business decisions", sub, two CTAs (**Start solving free**, **See the case
  library**), a mock AI-review card showing a real score breakdown, four
  feature cards, a **Six domains** grid (2 rows × 3), and a closing CTA.
- `/login`, `/signup` — split screen: form left, testimonial quote + three
  stats (500+ cases · 6 domains · AI rubrics) on a dark right panel. Google
  OAuth button above an email/password form.
- `/pricing` — Free vs Pro (₹499/yr). Pro's live feature is the AI interviewer;
  "coming soon" items are marked as such rather than implied.
- `/how-grading-works`, `/terms`, `/privacy`.

---

## 9. Vocabulary and enums (use these exact words)

- **Domains** (6): Finance · Consulting · Product Management · Marketing ·
  Strategy · Operations
- **Difficulty**: Easy · Medium · Hard
- **Formats**: Framework · Full Case · Model · Drill · Debug
- **Answer sections**: Framework · Analysis · Recommendation
- **Assignment states**: Not started · Awaiting review · AI graded · Reviewed ·
  Resubmission requested
- **CE** = the XP-style points currency. **Level** derives from CE.
- **Quota**: free 60 graded answers / 365 days; Pro 250 + 50 interviews.
- British spelling throughout: practise (verb), licence (noun), analyse,
  organise, colour → *no*, colour is not used; keep "utilisation", "personalise".

---

## 10. What to improve (the actual brief)

1. **Density without clutter.** The student dashboard has 12 widgets stacked
   vertically. It needs hierarchy — what matters today vs what's reference.
2. **The case-solving screen is the product.** Problem + answer editor + rubric
   should feel like a focused workspace, not a tabbed document. Consider a
   two-pane layout: case on the left, answer on the right, rubric always visible.
3. **The AI review deserves better than lists.** Score, per-criterion bars,
   strengths/gaps/next-time — currently three bulleted lists.
4. **Teacher marking flow.** Expanding a row to reveal answer + AI grade + mark
   input works but is cramped. A dedicated marking view with keyboard
   navigation between students would be better.
5. **Admin is a wall of stat cards.** 12 numbers in three groups with no visual
   hierarchy of importance.
6. **Empty states are text-only.** Every screen has thoughtful empty copy but
   no illustration or visual anchor.
7. **Mobile.** Everything is desktop-first; the sidebar collapses but layouts
   are not designed for narrow screens.

---

## 11. Ready-to-paste Stitch prompts

**Student**
> A dark-mode SaaS practice dashboard for MBA students preparing for case
> interviews. Geist typeface, indigo `oklch(0.65 0.18 264)` accent on a near
> black `oklch(0.145 0.003 285)` background, 10px radius cards on a slightly
> lighter surface. Top bar with logo, notification bell, theme toggle, avatar.
> Collapsible left sidebar grouped PRACTISE / YOU / COMMUNITY. Main area: a
> featured "daily case" band with a live countdown and a Solve now button; a
> row of four stat cards (cases solved, average score, current streak, global
> rank); a weekly points bar chart; a GitHub-style activity heatmap; a usage
> allowance meter; and a six-axis skill radar. Numbers in monospace with
> tabular figures. Calm, dense, analytical — closer to Linear than to Duolingo.

**Teacher**
> A dark-mode teaching console. Same design language. Sidebar grouped TEACHING /
> LIBRARY / COMMUNITY. Header with New question and New assignment buttons.
> Four stat cards (students, awaiting review, active assignments, class
> average), an alert band for work awaiting resubmission, an upcoming deadlines
> list, a horizontal bar chart of weakest domains, and batch cards each showing
> a monospace join code. Then an assignment detail view with a five-band score
> histogram, filter chips with counts, and an expandable student row revealing
> their answer beside an AI grade and the teacher's own marks and remarks
> fields.

**Admin**
> A dark-mode platform operations console for the owner of an edtech product.
> Same design language. Sidebar grouped PLATFORM / COMMERCIAL. Stat cards in
> three labelled groups — PEOPLE, ACTIVITY, COMMERCIAL — with clear visual
> hierarchy so revenue and AI cost read as primary and counts as secondary.
> Indian rupee amounts. Below: a recent-cases list with status pills, a
> "hardest cases" list with average scores, and a users table with role badges
> and a deactivate action. Precise, financial, unshowy.
