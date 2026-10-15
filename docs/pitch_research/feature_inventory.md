# Feature inventory — CaseCode

*Phase 3. Every row comes from the repository or the production database
(13 October 2026). Status labels:*

- **Verified** — implemented and exercised end to end in October 2026.
- **Implemented** — code, routes and data present; not re-tested in October 2026.
- **Partial** — built, but missing content or configuration.
- **Planned** — mentioned in product copy; not built.

*"Diff." = likely differentiator; "Std." = standard capability competitors also offer.*

---

## 1. Core product

| Feature | What it does | User | Problem solved | Status | Evidence | Diff./Std. | Business value | Next improvement |
|---|---|---|---|---|---|---|---|---|
| Case library | 969 published cases; 6 domains (Finance 226, Consulting 208, PM 162, Marketing 143, Operations 125, Strategy 105); easy 139 / medium 627 / hard 203; tagged to 10 target employers | Student | Not enough realistic practice material | Implemented | `cases` table; `src/app/(app)/cases` | Std. (volume above most competitors' published counts) | Core content asset | Expert review of a sample; Indian-context audit |
| 20 answer formats | Full case (840), debug (30), guesstimate, behavioural, WAT, memo, RCA, metrics, prioritisation, GTM plan, product sense, stock pitch, research note, brand teardown, campaign critique, marketing mix, drill, model | Student | Placement rounds use many formats, not only cases | Implemented | `cases.format` distribution; migrations `…038`, `…051` | **Diff.** (breadth across Indian MBA formats) | One licence covers many test types | Fill thin formats (drill 3, model 2) |
| Rubric-based AI grading | Model scores each rubric criterion; the server clamps and re-adds the total; strengths, lost marks, next step | Student, faculty | Feedback is slow, inconsistent or absent | **Verified** (live graded submissions, 12 Oct 2026) | `src/lib/ai/evaluate.ts`, `prompts.ts`, `src/app/api/submissions/route.ts` | Diff. in combination; per-criterion AI scoring itself exists elsewhere (Road to Offer: 7-dimension rubric [S11]) | The engine everything else rests on | Calibrate against faculty marks in a pilot |
| Structured answer editor | Framework → Analysis → Recommendation sections with minimum lengths; drafts saved locally | Student | One-line answers; lost work | Implemented | `src/components/case/answer-editor.tsx` | Std. | Better answers, better grading | — |
| Hints with score penalty | Progressive hints, each costing marks | Student | Stuck students quit | **Partial: 0 hints in DB** | `case_hints` table (0 rows); `src/app/api/hints` | Diff. (cost-bearing hints rare) | Engagement | **Reseed before any pilot** |
| Learning paths | Ordered case sequences | Student | "What do I do next?" | **Partial: 3 paths, 34 steps** (was 29) | `learning_paths` | Std. | Retention | Restore the paths |

## 2. Student-facing practice beyond cases

| Feature | What it does | Status | Evidence | Diff./Std. |
|---|---|---|---|---|
| AI case interviewer | Live, one-question-at-a-time case conversation; closes with feedback after 8–10 turns (Pro) | Implemented | `src/lib/ai/chat.ts`, `src/app/api/chat/route.ts` | Std. among AI case tools (Road to Offer, PrepBuddy, CaseStudyPrep.AI [S29]) |
| Group discussion (GD) room | 2+ students join a live audio/video room, speak on a topic; speech transcribed in-browser; AI scores each participant | **Verified** (AI scoring run on a real session, Oct 2026) | `src/components/gd/gd-room.tsx`, `src/lib/ai/gd-evaluate.ts`; 20 topics | **Diff.** (no reviewed competitor offers multi-student AI-scored GD) |
| Personal interview (PI) | AI HR interviewer using the student's background; scored at the end | Implemented | `src/lib/ai/pi-interview.ts`, `/interview` | Std. (Big Interview, Yoodli, Amrita's tool [S13][S14][S24]) |
| Negotiation role-play | AI counterparty with private payoffs; scored | Implemented (3 scenarios) | `src/lib/ai/negotiate.ts`, `/negotiation` | Diff. (not found in reviewed competitors) |
| Sales role-play | AI buyer; meeting debrief on a rubric | Implemented (3 scenarios) | `src/lib/ai/sales.ts`, `/sales` | Diff. for MBA prep; Yoodli does sales role-play for corporates [S14] |
| Business simulation | 8-quarter market simulation against two AI-run rivals; AI debrief | Implemented | `src/lib/sim`, `src/lib/ai/sim-debrief.ts` | Diff. |
| WAT / written formats | Essay and business-writing tasks graded on rubrics | Implemented (9 WAT + other written formats) | `cases.format = wat, memo…` | Std. vs coaching institutes (IMS/CL GDPI programmes [S20][S21]) |
| Aptitude practice | 314 questions in 10 tracks (quant 55, stats 42, LR 41, verbal 37, DI 31, finance 28, accounting 24, marketing 24, operations 20, current affairs 12) | Implemented | `objective_questions`; `/practice` | Std. |
| Daily current-affairs quiz | Generated daily from RBI publications | Implemented (cron-driven) | `src/lib/current-affairs`, `/api/cron/current-affairs` | Std. |
| SQL practice | 15 exercises run against a real SQLite engine, auto-checked | Implemented | `src/lib/sql/runner.ts`, `/sql` | Std. (StrataScratch-style; uncommon in MBA prep) |
| Excel practice | 21 exercises with a formula engine, auto-checked | Implemented | `src/lib/excel`, `/excel` | Diff. for MBA prep |
| Drills and model builds | Timed arithmetic and cell-by-cell financial models checked to a tolerance | Implemented (thin content) | `src/app/api/drills`, `src/app/api/model` | Std. (RocketBlocks/CaseCoach drills [S10][S7]) |
| Resume critique | AI review of resume bullets for target role | Implemented | `src/lib/ai/resume-critique.ts` | Std. (VMock is the established player [S15]) |
| Deck review | AI critique of an uploaded PDF presentation | Implemented | `src/lib/ai/deck-critique.ts` | Diff. (not found in reviewed competitors) |
| Company prep pages | 20 recruiters (McKinsey, BCG, TAS, HUL, ITC, HDFC Bank…) with 49 first-party links | Implemented | `companies` table | Std. |
| Case competitions | 3 competitions with AI-graded entries | Implemented | `/competitions` | Std. (Unstop dominates listings [S16]) |
| Peer video interviews | Two students, in-product video; the interviewer sees the model answer, the candidate does not; peer marks on the same rubric | Implemented | migration `…033_peer_interviews.sql`, `/peer` | Diff. in design; peer practice itself is PrepLounge's core [S9] |

## 3. Progress, motivation and community

| Feature | Status | Evidence | Diff./Std. |
|---|---|---|---|
| Skill radar by domain, score trend, heatmap, streaks | Implemented | `src/components/skill-radar.tsx`, `score-trend.tsx`, `year-heatmap.tsx` | Std. |
| CE points, levels, 17 badges | Implemented | `badges` table | Std. |
| Leaderboards (global and per campus; weekly/monthly/all time) | Implemented | `/leaderboard` | Std. |
| Study groups, discussions, published solutions with votes | Implemented | `/groups`, `comments` | Std. |
| Privacy controls (leaderboard opt-out, hide college, hide history) | Implemented | migration `…028_privacy_preferences.sql` | Std. |
| Recruiter view (opt-in students only) | Implemented, **no recruiters** | `/recruiter` | Diff. idea, unproven |

## 4. College / institution-facing

| Feature | What it does | Status | Evidence | Diff./Std. | Business value |
|---|---|---|---|---|---|
| Campus licence | Seats, start/end dates, price, suspension; Pro granted by licence | Implemented, **0 institutions** | migrations `…019`, `…022`; `/admin/licences` | Std. for B2B | The revenue mechanism |
| Email-domain auto-enrolment | Students signing up with the college domain are enrolled automatically | Implemented | `institutions.email_domain` | Diff. vs join codes; Std. vs SSO | Zero data entry for the placement cell |
| Placement dashboard | Seats used, active in 14 days, never started, cohort average, weakest domains, roster | Implemented | `src/app/(app)/institution/page.tsx` | Diff. (CaseCoach shows time on platform and completed activities [S7]) | Visibility before recruiters arrive |
| Fair-use quota per student | 250 gradings + 50 interviews/yr on Pro; licence can override | Implemented | `src/lib/quota.ts`, `QUOTA` | Std. | Makes fixed-price contracts safe |

## 5. Faculty-facing

| Feature | Status | Evidence | Diff./Std. |
|---|---|---|---|
| Batches with join codes | Implemented | `/teacher/batches` | Std. |
| Set any case as an assignment (due date, max marks) | Implemented | `/teacher/assignments` | **Diff.** (not found in reviewed case-prep products) |
| Author own questions; import from Word/Markdown | Implemented | `/teacher/questions`, `src/lib/parse-question.ts` | Diff. |
| Review queue: answer + AI grade (advisory) + faculty mark (authoritative) + remarks | **Verified** (Oct 2026, with camera photos) | `src/components/teach/review-queue.tsx` | **Diff.** |
| "Not started" list, score distribution, weakest domains | Implemented | `/teacher/batches/[id]` | Diff. |
| Reopen a test the proctoring ended | **Verified** | `/api/proctor/lockout/reopen` | Diff. |

## 6. Exam integrity (proctoring) — applies to every graded surface

| Feature | Status | Evidence | Diff./Std. |
|---|---|---|---|
| Mandatory exam mode: fullscreen, paste blocked, keystroke telemetry | Verified | `src/hooks/use-proctor.ts` | Std. in assessment tools (Talview, Mettl [S18][S19]) |
| Leaving the window ends the test (hidden tab: immediately; other window: after 2 s) | Verified (12 Oct 2026) | `src/hooks/use-proctor.ts` | Std. in assessment tools; **rare in prep tools** |
| On-device camera checks: phone, second person, covered or switched-off camera, a minute out of frame → test ends | **Verified** (phone frame replayed, ended in 3.7 s; 13 Oct 2026) | `src/lib/camera-proctor.ts`, `use-camera-proctor.ts` | **Diff.** for a practice platform; runs in the browser, so no video upload or per-minute fee |
| Camera required to start a test | Verified | `src/components/case/proctor-overlay.tsx` | — |
| Server-side lock: an ended test cannot be resubmitted until faculty reopen it | Verified | `src/lib/exam-lockouts.ts`, migration `…064` | Diff. |
| Evidence photos, private, deleted after 30 days | Verified | `src/lib/proctor-evidence.ts` | Std. |
| Integrity scoring: paste, typing ratio, speed, AI-style (advisory only), strikes and suspension | Implemented | `src/lib/integrity.ts` | Diff. ("AI-likeness never deducts a mark on its own") |

## 7. Platform owner (internal) — operational, not customer-facing

| Feature | Status | Evidence |
|---|---|---|
| Revenue, AI cost per licence, margin flag below 30%, worst-case cost, renewals | Implemented | `/admin`, `/admin/licences`, `/admin/renewals`, `institution_commercials()` |
| Case CMS, rubric editor, Pro flagging | Implemented | `/admin/cases` |
| Usage dashboard; measured AI cost per call | Implemented | `/admin/usage`, `usage_events` |
| Access allow-list, role grants, user deactivation, audit log | Implemented | `/admin/access`, `/admin/users`, `audit_log` |

## 8. Integrations

| Integration | Status | Note |
|---|---|---|
| Google sign-in | Implemented | — |
| Google Gemini (AI) | Implemented | Price doubles 1 Jan 2027 [S6] |
| Supabase, Vercel | Implemented | Mumbai region |
| MediaPipe (on-device) | Implemented | No data leaves the device except counters and evidence photos |
| Razorpay | Partial (no keys) | Retail only; campus deals invoiced |
| TURN relay for GD | **Not configured** | GD may fail on restrictive campus Wi-Fi |
| LMS (Moodle, Canvas), SIS, ERP, placement portals (Superset) | **Not built** | Common college ask; a roadmap item |
| SSO (SAML / Microsoft) | **Not built** | Email-domain enrolment covers most needs |

## 9. Security and access control

| Capability | Status | Evidence |
|---|---|---|
| Row-level security on every table; least-privilege grants | Verified (Oct 2026) | migration `…066_least_privilege.sql` |
| Roles from the database only; invite-only accounts | Verified | `src/lib/authz.ts`, `…060` |
| CSP, HSTS, Permissions-Policy, cross-site request refusal | Verified on production | `next.config.ts`, `src/proxy.ts` |
| Prompt-injection guards on AI features | Implemented + unit-tested | `src/lib/ai/untrusted.ts`, `tests/untrusted.test.ts` |
| Rate limits, per-student quota, platform-wide daily AI cap | Implemented | `src/lib/ai/providers.ts` |
| Data in India (Mumbai) | Fact | Supabase `ap-south-1` |
| Encrypted backups with account restore | Built and tested locally; **not scheduled** | `scripts/backup-db.ts` |
| Audit log of privileged actions | Implemented | `audit_log` |
| Certifications (ISO 27001, SOC 2), DPDP privacy notice | **None / not written** | — |

## 10. Planned roadmap (not built — never present as existing)

- Fresh case variants on re-attempt *(old pricing page: "planned")*
- Pattern analytics across a student's submissions *(old pricing page: "planned")*
- Rubrics reviewed by former consultants and bankers *(old pricing page: "planned")*
- *Recommended by this research, not yet planned:* LMS export, faculty–AI grade calibration reports, placement-outcome tracking, TURN relay, DPDP consent flows.

---

## The 3–5 strongest features for the pitch

Chosen for being demonstrable today, hard to get elsewhere in one product,
and relevant to a college buyer:

1. **Practice → assignment → marking in one product.** A faculty member sets a
   case; students solve it; AI pre-grades it per criterion; the faculty mark is
   final. *Not found* in the case-prep competitors reviewed (CaseCoach,
   PrepLounge, RocketBlocks, Road to Offer). Demo: the review queue.
2. **The Indian placement format set under one licence:** cases, GD (live,
   multi-student, AI-scored), PI, WAT, aptitude, SQL/Excel, negotiation and
   sales role-plays. Competitors cover one or two of these.
3. **Exam-grade integrity for practice and coursework:** camera checks run on
   the student's laptop (no video uploaded, no per-minute proctoring fee), tab
   switching ends the test, the lock is enforced on the server. This lets a
   college use the platform for graded internal assessments, not only practice.
4. **Placement-cell visibility:** who has never started, cohort weak domains,
   seat use, without reading student answers.
5. **Transparent, bounded AI grading:** a visible rubric, per-criterion
   points, a server-recomputed total, and AI-likeness never deducting marks on
   its own. This is a trust argument for faculty.

Avoid leading with: case count (competitors also claim large libraries, and
ours are AI-generated), gamification (table stakes), recruiter view (no
recruiters), payments (not live).
