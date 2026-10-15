# Product analysis — CaseCode

*Phase 1 of the pitch research. Prepared 13 October 2026 from the repository
(`main` at `df7b723`), the production database (Supabase project
`hhjxvnrjnyugepnsuafi`, read-only queries) and the project's own documents.*

**How to read this document.** Every statement is tagged:

| Tag | Meaning |
|---|---|
| **[Fact]** | Read directly from code, the database, or a document in the repo |
| **[Verified]** | A fact that was also exercised end to end in a running build during October 2026 |
| **[Inference]** | A conclusion drawn from the facts, not stated anywhere |
| **[Assumption]** | Something we have to believe for the argument to work; not yet tested |

---

## 1. What the product is

**Name:** CaseCode. **[Fact]** (`package.json`, `PRODUCT.md`)

**Description:** A web platform where MBA and PGDM students practise the
assessments used in placements: business cases, group discussions, personal
interviews, written-ability tests, aptitude, SQL/Excel and role-plays. Each
attempt gets AI-generated, rubric-based feedback. Colleges get tools to
assign the same practice as coursework, mark it, run it under exam
conditions, and see which students are falling behind. **[Fact]**

**Self-description in the repo:** "LeetCode, but for MBA case interviews." **[Fact]** (`PRODUCT.md`)

**Elevator pitch (proposed):**
> CaseCode is a placement-preparation platform for Indian business schools.
> Students practise real interview formats — cases, GDs, interviews, aptitude
> — and get instant rubric-based feedback. The college sees who is
> preparing, who isn't, and where the batch is weak.

---

## 2. The problem it is designed to solve

From the product's own framing (`PRODUCT.md`) **[Fact]**, a case interview is
learned only through three things at once:

1. **Volume** — dozens of cases, not five.
2. **Consistent feedback** — against the same standard every time.
3. **Pressure** — someone pushing back while you think.

Students usually get the third occasionally, from a study partner, and rarely
get the first two. **[Fact, as stated by the product]**

The repository adds a second problem, on the college side. The teacher and
placement tooling exists because faculty and placement cells cannot easily
see whether students are preparing, or mark practice at scale. **[Inference]**
(`src/app/(app)/teacher/*`, `src/app/(app)/institution/page.tsx`)

> **Gap:** there is no user research, interview notes or survey data in the
> repository to confirm either problem from real students or colleges. The
> problem statement is the founder's thesis, not yet validated evidence.

---

## 3. Who experiences the problem, who uses it, who pays

| Role | Who | Uses it? | Pays? | Evidence |
|---|---|---|---|---|
| **Primary user** | MBA/PGDM students preparing for summer and final placements | Yes, daily practice | No (under the campus model) | Student routes; `PRODUCT.md` "Colleges buy seats; students use it free" |
| **Secondary user** | Faculty teaching strategy, finance, marketing etc. | Assign, mark and review | No | `src/app/(app)/teacher/*` |
| **Secondary user** | Placement cell / corporate relations office | Roster, cohort weak spots, seat usage | Influences the purchase | `src/app/(app)/institution/page.tsx` |
| **Economic buyer** | The institution (Director, Dean, or management of a private institute) | Rarely logs in | **Yes**: campus licence | `institutions` table, `src/app/(app)/admin/licences/*` |
| **Optional** | Individual students outside a licensed college | Practice | Retail Pro was ₹499/yr; payment never went live and the pricing page was removed on 12 Oct 2026 | `src/lib/billing/razorpay.ts`, commit `ef1c16a` |
| **Optional** | Recruiters | Opt-in view of student performance | Not monetised | `src/app/(app)/recruiter/page.tsx` |

**Users ≠ payers.** The student uses it; the college pays. That shapes the
whole pitch: students must want it for it to be used, and the college must
see evidence of use to renew. **[Inference]**

---

## 4. Core value proposition

- **For students:** unlimited, realistic placement practice with feedback in
  seconds, against an explicit rubric, at 2 a.m. when no peer or senior is
  available. **[Fact: capability]** **[Assumption: that students value it enough to keep using it]**
- **For faculty:** set a case as an assignment, get every submission
  pre-graded by AI with per-criterion feedback, and give the authoritative
  mark in one screen. **[Fact]** (`src/components/teach/review-queue.tsx`)
- **For the placement cell:** see who has never started, cohort averages, and
  the batch's weakest domains before recruiters do. **[Fact]**
- **For the institution:** one licence covers the formats that usually need
  several vendors or coaching programmes (case prep, GD/PI, aptitude,
  proctored assessments). **[Inference]** It also comes with exam-condition
  proctoring that keeps practice grades credible. **[Fact]**

---

## 5. Current development status

### Maturity — what is true today

| Dimension | State | Evidence |
|---|---|---|
| Codebase | ~54,900 lines of TypeScript; 84 pages; 90 API routes; 66 database migrations; 121 UI components; 22 test files (381 tests passing) | Repository counts, 13 Oct 2026 |
| Content | **969 published cases** in 6 domains, 20 formats; 964 rubrics; 314 aptitude questions; 21 Excel and 15 SQL exercises; 20 GD topics; 20 company prep pages; 3 negotiation, 3 sales and 3 competition scenarios; 3 learning paths | Production DB, 13 Oct 2026 |
| Live deployment | Live at `casecode-ebon.vercel.app` | Vercel deployment `df7b723`, Ready |
| Access | **Invite-only.** Only allow-listed emails can create accounts | Migration `…060_invite_only_access.sql` |
| **Users** | **2 accounts** (both the founder's). The October 2026 rebuild permanently deleted all earlier registered users | DB count; `docs/recovery-2026-10.md` |
| **Usage** | **0 submissions, 0 institutions, 0 classrooms** in the current database | DB count |
| Revenue | **None.** No institution licensed; retail payments never configured | DB; `docs/feature-inventory.md` §8.9 |
| Content authorship | Cases are **AI-generated from analytical archetypes**, not written by former consultants | `docs/feature-inventory.md` "Where we are weak" |

**Readiness verdict [Inference]:** a feature-complete, technically mature
**pre-launch** product. It can run a pilot tomorrow. It has no users, no
outcomes data and no paying customer. The pitch must be "built, ready to
pilot", not "proven".

### Content counts changed after the October rebuild — use these, not the older docs

`PRODUCT.md` (August 2026) says 508 cases, 900 hints and 29 learning paths.
`docs/feature-inventory.md` (September) says 886 cases and 901 hints.
**Production today:** 969 cases, **0 hints**, **3 learning paths**. The hint and
learning-path content was not reseeded after the October 2026 rebuild.
**[Fact]** Hints and paths are built; their content must be restored before a pilot.

---

## 6. Technology stack and infrastructure

| Layer | Technology | Evidence |
|---|---|---|
| Web framework | Next.js 16.4 (App Router, Turbopack), React 19.1, TypeScript | `package.json` |
| UI | Tailwind CSS, Radix UI primitives, lucide icons | `package.json`, `src/components/ui` |
| Database, auth, storage, realtime | Supabase (PostgreSQL 17), row-level security on every table | `get_project`; migrations |
| Database region | **ap-south-1 (Mumbai)**, so student data stays in India | Supabase project metadata |
| Hosting | Vercel, Mumbai region (`bom1`) | `vercel.json`, `docs/recovery-2026-10.md` |
| AI model | Google **Gemini 3.6 Flash** via API (provider-switchable: OpenAI-compatible, Anthropic) | `src/lib/ai/providers.ts` |
| On-device vision | MediaPipe (face detection + EfficientDet object detection) running **in the student's browser**; no video uploaded | `src/hooks/use-camera-proctor.ts` |
| Live audio/video | WebRTC peer-to-peer with Google STUN; Supabase realtime for signalling (TURN relay not yet configured) | `src/components/gd/gd-room.tsx` |
| Speech-to-text | Browser Web Speech API (en-IN) | `src/hooks/use-own-speech.ts` |
| SQL practice engine | sql.js (SQLite compiled to WebAssembly), server-side | `src/lib/sql/runner.ts` |
| Spreadsheet engine | formula parsers (`fast-formula-parser`, `@formulajs`) | `package.json`, `src/lib/excel` |
| Sign-in | Google OAuth and email/password | `src/components/auth`, `docs/recovery-2026-10.md` |
| Backups | AES-256-GCM encrypted nightly backup via GitHub Actions (**inactive until 3 repository secrets are added**) | `scripts/backup-db.ts`, `.github/workflows/backup.yml` |
| Payments | Razorpay integration coded, **not configured** | `src/lib/billing/razorpay.ts` |

**Measured operating cost [Fact, from code constants]:** infrastructure is
budgeted at about ₹47,520/year (Vercel Pro + Supabase Pro at ₹88/USD)
(`PLATFORM_INFRA_INR_PER_YEAR` in `src/lib/constants.ts`). The Supabase
project is currently on the free tier (`docs/recovery-2026-10.md`), so the
real current spend is lower.

---

## 7. Implemented vs partial vs planned vs unvalidated

Full detail is in `feature_inventory.md`. Summary:

**Implemented and verified end to end (October 2026):**
- AI case grading against a per-case rubric (graded live submissions on 12 Oct)
- Group discussion: live multi-student room with AI scoring ("End and mark" run with a real AI call)
- Exam mode: fullscreen, paste blocking, tab-switch ending, camera proctoring (phone, second person, covered or switched-off camera), server-side lockouts, teacher reopening
- Faculty review of submissions with camera evidence photos
- Invite-only access, role separation, encrypted backup and restore of accounts
- Security hardening (CSP, HSTS, CSRF checks, least-privilege database grants, AI cost cap)

**Implemented in code, not re-tested in October 2026** (code and data
present; behaviour assumed from earlier sessions): AI case interviewer, PI
interview, negotiation and sales role-plays, business simulation, SQL and
Excel practice, aptitude practice, daily current-affairs quiz, resume and
deck critique, peer video interviews, study groups, leaderboards, progress
analytics, campus licensing with email-domain auto-enrolment, placement
dashboard, owner revenue and margin views.

**Partially implemented:**
- Hints: feature built, **0 hints** in the current database
- Learning paths: built, 3 of the former 29 restored
- Weekly contests: built, 0 scheduled
- Drill and model-build formats: built, 3 drills and 2 models of content
- GD on restrictive (college) networks: needs a TURN relay, not configured
- Retail Pro payments: coded, no keys; public pricing page removed
- Backups: built, not scheduled until GitHub secrets are added

**Planned (stated in old product copy, not built):** fresh case variants for
re-attempts, pattern analytics across submissions, rubrics reviewed by former
consultants and bankers. *(These appeared as "planned" on the removed pricing page.)*

**Not built, and not claimed anywhere:** LMS/SIS integration (Moodle, etc.),
single sign-on beyond Google, mobile apps, human coaching marketplace,
placement-outcome tracking, security certifications (ISO 27001/SOC 2).

---

## 8. Open gaps a pitch audience will ask about

1. **No traction.** No users, pilots, testimonials or outcome data exist. Do not imply otherwise.
2. **Content quality is unvalidated.** The cases are AI-generated. A
   faculty or alumni review of a sample is the fastest credibility fix.
3. **Team, entity and funding** are not documented in the repository.
4. **Privacy notice** for the camera and tab tracking is not yet written to DPDP standard.
5. **Operational to-dos:** the TURN relay, backup secrets, rotating the Google OAuth secret, and the first admin sign-in.
