# CaseCode

**LeetCode, but for MBA case interviews.**

Students preparing for consulting, finance and product roles are hired on a *case
interview* — someone hands them a business problem and watches how they think.
The only way to get good is repetition with feedback. Repetition is easy to find;
feedback is not. Most students practise alone, can't tell how they did, and repeat
the same mistakes for months.

CaseCode gives them the repetition **and** the feedback, and gives their college a
way to see whether any of it is working.

---

## Contents

- [The problem](#the-problem)
- [What a student does](#what-a-student-does)
- [The five practice formats](#the-five-practice-formats)
- [The live interviewer](#the-live-interviewer)
- [Tracking improvement](#tracking-improvement)
- [What a faculty member does](#what-a-faculty-member-does)
- [What a placement cell sees](#what-a-placement-cell-sees)
- [What the platform owner controls](#what-the-platform-owner-controls)
- [Recruiters](#recruiters)
- [How grading works](#how-grading-works)
- [Privacy](#privacy)
- [Commercial model](#commercial-model)
- [What exists today](#what-exists-today)

---

## The problem

A case interview is unlike an exam. There is no answer key to memorise. You are
judged on how you structure an ambiguous problem, whether your arithmetic holds
up under questioning, and whether you can commit to a recommendation and defend
it.

Getting good at that needs three things at once:

1. **Volume** — fifty cases, not five.
2. **Honest feedback** — on each one, against a consistent standard.
3. **Pressure** — someone pushing back while you think.

A study partner gives you the third, occasionally. Coordination kills the first
two. A book gives you none of them.

---

## What a student does

**1. Pick a case.** 508 of them, across six areas — Consulting, Finance, Product
Management, Marketing, Strategy and Operations. Filter by difficulty, domain, or
the firm style they're targeting.

**2. Read the brief.** A realistic scenario with real numbers: a SaaS company
weighing a funding round, a retailer losing margin, a factory at capacity.

**3. Write an answer.** Structure, analysis, recommendation. A timer runs, but
only so they can see it.

**4. Get graded in about fifteen seconds.** Not a bare score — a breakdown
against the rubric that case was written with:

> **Financial analysis** 19/30 · **Risk assessment** 17/25
> **Recommendation** 18/25 · **Market analysis** 15/20
>
> *Strong on the runway calculation and the burn multiple. You asserted the
> valuation was fair without testing it against a comparable. Next time,
> benchmark the multiple before you accept it.*

Every student attempting that case is judged against the same rubric, so two
scores of 62% mean the same thing.

**5. Try again.** See where the points went, rewrite, resubmit. That loop is the
entire product.

**Stuck?** Every case carries hints, revealed one at a time. Each costs a slice of
the score — so a student finds out what they didn't know, and the number stays
honest about it.

---

## The five practice formats

Interviews test different things, so practice comes in different shapes.

| Format | What it is | Graded by |
|---|---|---|
| **Full case** | The classic end-to-end problem | AI, against a rubric |
| **Debug** | A flawed analysis with an error buried in it — find it | AI, against a rubric |
| **Drill** | Timed mental-maths sprints: market sizing, unit economics | Arithmetic, instantly |
| **Model** | A spreadsheet built cell by cell — CAC, LTV, payback | Arithmetic, within a tolerance band |
| **Framework** | Structure only: build the issue tree | AI, against a rubric |

Drills and models are checked against a tolerance band rather than by a language
model. A market-sizing answer has one right number, and arithmetic verifies it
better, faster and more cheaply than any model can.

---

## The live interviewer

The feature that most resembles the real thing, and the hardest to practise
alone.

An AI interviewer walks a student through a case **one question at a time** and
pushes back:

> **Student:** *Runway is 14 months, so the raise is voluntary — that's a strong
> negotiating position.*
>
> **Interviewer:** *That calculation is accurate. But before concluding how
> strong our position is — how would you evaluate how efficiently this company is
> currently growing? What would you look at next?*

It behaves like an interviewer, not a tutor:

- Asks one question and waits.
- Won't say whether an answer is right until the end.
- Won't do the arithmetic.
- Offers one narrow nudge after two stuck turns — the next sub-question, never
  the answer.
- Closes after eight to ten exchanges with three sentences: one thing done well,
  one to improve, one concrete next step.

Available at 2am the night before an interview, which is exactly when a study
partner is not.

---

## Tracking improvement

- **Skill radar** — average score by domain. The dents are the homework.
- **Score trend** — actually improving, or just doing more?
- **Streak and activity heatmap** — the green-squares pattern.
- **CE and levels** — points for solving, more for harder cases, badges at
  milestones.
- **Learning paths** — 29 curated sequences for when a student doesn't know what
  to do next.

The point of all of it: after a month, *"am I ready?"* has an answer backed by
evidence instead of a feeling.

---

## What a faculty member does

A professor creates a **batch**, shares a six-character join code, and sets cases
as assignments with a due date and marks.

**Students don't hand in twice.** They solve the case the normal way; it attaches
itself to the assignment automatically. The AI grades it in seconds; the faculty
mark is the one that counts for the course. Two readers, one submission.

The teaching dashboard shows, per assignment:

- how many have submitted, out of the batch
- **who hasn't started** — listed explicitly, because those are the students who
  need a nudge
- each answer, with the AI's grade alongside
- fields for marks and written remarks

Saving notifies the student. Resubmitting reopens the review and clears the old
mark, so a stale verdict is never left attached to a newer answer.

---

## What a placement cell sees

A separate view for the people responsible for placement outcomes:

- **Seats used** against seats licensed, and the licence countdown
- **Active in the last 14 days**, and who has **never started**
- **Cohort average** across everyone graded
- **Which domains the batch is weakest in**, ordered weakest first — the list
  revision sessions get built around
- A sortable, searchable roster with each student's solved count, average and
  trend

They see cohort statistics and individual scores. **They do not read student
answers.**

---

## What the platform owner controls

The commercial side, separate from anything a college can touch:

- **Create and edit campus licences** — seats, dates, price, email domain
- **Revenue** — annual contract value across live licences
- **Cost** — AI spend per licence, computed from actual usage
- **Margin per contract**, flagged when it falls below 30%
- **Worst case** — what a contract would cost if every seat used its full
  allowance, which is the number that decides whether a price is safe
- **Renewals** due within 60 days
- **Suspend** a licence immediately on non-payment, independent of its dates
- Manage the case library, rubrics and which cases are Pro

---

## Recruiters

Students can switch on **"open to opportunities"** — off by default. Recruiters
then see their name, university, solved count and score trend, ranked by CE.
Performance is demonstrated on graded cases rather than self-reported.

Answers stay private regardless.

---

## How grading works

Worth being explicit, because a score nobody understands is a score nobody can
learn from.

1. **Every case has a rubric**, written before the case is published — criteria
   and weights, identical for everyone attempting it.
2. **The model sees the case, the rubric and the answer**, and returns points per
   criterion plus written feedback.
3. **The platform does the arithmetic, not the model.** Every criterion is
   clamped to its maximum, negatives floored at zero, invented criteria
   discarded, and the total recomputed by summing the clamped criteria. Models
   are unreliable at arithmetic, and this number decides leaderboard position.

**Where it's weak**, stated plainly on the site itself: an AI grader rewards
explicit reasoning, so an answer that shows its working scores better than an
equally good one that states conclusions tersely. It can miss creative arguments
that don't match the rubric's expectations. Scores vary slightly between runs.
It is a training partner, not a judge — three attempts across three cases say far
more than one score on one case.

---

## Privacy

- **Answers are private by default.** They become visible to others only if the
  student explicitly shares them.
- **Faculty see their own batch's submissions.** Placement staff see cohort
  statistics, not answers.
- **Students see only their own marks.** A batchmate's marks and answers are not
  readable, by design and enforced at the database level.
- **Answers are sent to a third-party AI provider for grading.** The site says so
  and names the provider, and tells students not to put confidential employer
  information into a case answer.
- **Recruiter visibility is opt-in**, off by default, and reversible.

---

## Commercial model

**Colleges buy seats; students use it free.**

A licence carries a seat count, a date range and a price. Students signing up
with an address on the college's email domain are enrolled automatically — no
join codes for a thousand people, no data entry for the placement cell. Past the
seat cap the account still works, but it isn't licensed and gets no Pro.

The licence itself grants Pro access. When it expires, access stops on its own —
there is no renewal script to remember to run.

**Fair-use allowance:** 250 graded answers and 50 mock interviews per student per
year, roughly four times what an engaged student uses. It exists to bound the
tail, not to ration normal use, and it is what makes a fixed-price contract safe
to sign. Individual licences can carry a higher allowance as a contract term.

**Retail Pro** exists alongside for individual buyers at ₹499/year, which unlocks
the live interviewer. Every case stays free to solve and get graded.

---

## What exists today

Honest state of the product.

**Content**

| | |
|---|---|
| Published cases | **508** |
| Rubrics | 504 |
| Hints | 900 |
| Learning paths | 29 |
| Badges | 17 |

**By domain**

| Domain | Cases |
|---|---|
| Consulting | 117 |
| Finance | 110 |
| Product Management | 101 |
| Marketing | 60 |
| Strategy | 60 |
| Operations | 60 |

**By format**

| Format | Cases |
|---|---|
| Full case | 480 |
| Debug | 24 |
| Drill | 3 |
| Model | 1 |
| Framework | 0 |

**The library is heavily weighted to full cases.** Drills, models and frameworks
all work end to end — they simply need more content written. That is the clearest
gap between what the platform can do and what it currently offers.

**Built and working:** case library and filtering, AI grading with per-criterion
feedback, hints with score penalties, the live interviewer, the spreadsheet
workspace, timed drills, learning paths, weekly contests, global and campus
leaderboards, discussion and shared solutions, study groups, classrooms with the
full assignment-and-marking loop, the placement dashboard, campus licensing with
domain auto-enrolment, the fair-use quota, and the owner's revenue and margin
view.

**Not yet connected:** payment collection for retail Pro. Campus licences are
invoiced directly, so this does not block institutional sales.
