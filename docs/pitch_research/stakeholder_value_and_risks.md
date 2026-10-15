# Stakeholder value, pilot KPIs and risks — CaseCode

*Phases 9 and 10. Benefits are described as what the product enables;
none have been measured with real users yet.*

---

## 1. Value for students

| | |
|---|---|
| **Immediate** | Feedback in seconds on a case, GD, interview or written answer; practice at any hour; the rubric is visible before answering |
| **Long-term** | A record of improvement by domain (skill radar, score trend); exposure to every placement format before the real one |
| **Problems removed** | Waiting for a senior or peer to run a mock; not knowing why an answer was weak; uneven access to prep material between students |
| **Experience improvements** | One place for cases, GD, PI, aptitude, SQL/Excel; Indian company contexts and ₹ figures |
| **Why they would keep using it [Assumption]** | Assignments from faculty (external motivation), placement-season urgency, visible progress, leaderboards and streaks. **Risk:** without faculty assignments, organic use may fade outside placement season |

## 2. Value for colleges

| | |
|---|---|
| **Operational** | Run practice at scale without arranging volunteers; proctored mock assessments without a separate vendor |
| **Administrative efficiency** | AI pre-grades every submission; faculty review and mark in one screen; email-domain auto-enrolment means no data entry |
| **Visibility & reporting** | Who has never started; cohort averages; weakest domains; seat use; per-student trend; integrity flags with evidence |
| **Student outcomes [to be measured]** | Hypothesis: better-prepared students in placement processes. **No outcome data exists** |
| **Potential cost savings [to be measured]** | May replace part of external GD/PI training, aptitude-test vendors or proctoring licences. Requires each college's current spend to quantify |
| **Reasons to adopt and pay** | Placement readiness is a reputational and admissions lever *[inference]*; the faculty and placement-cell tooling is something students cannot buy for themselves |

## 3. Other stakeholders

- **Faculty:** set case assignments without writing rubrics from scratch;
  AI pre-grades; their mark stays authoritative; can author or import their
  own cases.
- **Placement cell:** early warning on disengaged students; data to plan
  remedial sessions by weak domain.
- **Recruiters (future):** an opt-in view of demonstrated performance. No recruiters use it today.

## 4. Stakeholder value matrix

| Stakeholder | Current problem | Product capability | Expected benefit | How to measure it |
|---|---|---|---|---|
| Student | Little feedback on practice; uneven access to mocks | Rubric AI grading across formats; GD rooms; AI interviewer | More, better-targeted practice | Attempts per student; repeat-attempt score change; survey usefulness score |
| Faculty | Marking case answers is slow; no time for weekly practice | Assignments + AI pre-grade + review queue | Weekly case practice without proportional marking time | Minutes per submission marked (with vs without AI); assignments set per term |
| Placement head | Doesn't know who is preparing until it's too late | Dashboard: never started, active, weak domains | Earlier intervention | Days between first and last activity; % of the batch active before placements |
| Director / Dean | Hard to evidence structured placement preparation | Usage and improvement reports; proctored mock assessments | Evidence for accreditation, rankings, admissions marketing | Reports produced; inclusion in accreditation files |
| IT / data protection | Vendor risk, student privacy | India-hosted data; on-device camera checks; 30-day photo deletion; RLS | Lower compliance risk | DPA signed; privacy questionnaire passed |

## 5. Pilot evaluation framework

| KPI | Definition | Target (hypothesis) | Source in product |
|---|---|---|---|
| Activation | % of licensed students with ≥ 1 graded attempt | ≥ 70% | `submissions`, `user_activity` |
| Engagement | % weekly active, weeks 2–8 | ≥ 40% | `user_activity` |
| Depth | Median graded attempts per active student | ≥ 6 | `submissions` |
| Improvement | Average score change between first and third attempt in the same domain | Positive, reported with its spread | `scores` |
| Grade agreement | Correlation of AI and faculty marks on double-marked answers | Report it; aim r ≥ 0.6 | `assignment_submissions` (AI vs faculty mark) |
| Faculty time | Minutes per submission marked | Lower than the institute's manual baseline | Time log (manual) |
| Integrity false positives | Reopened tests ÷ ended tests | < 20% *(to calibrate)* | `exam_lockouts` |
| Satisfaction | Student and faculty NPS | ≥ +20 | Survey |
| Commercial | Pilot → paid conversion | ≥ 50% of pilots | CRM |

---

## 6. Risk register

| Risk | Severity | Likelihood | Impact | Mitigation | Evidence needed |
|---|---|---|---|---|---|
| **No product-market proof** | High | Certain today | Investors and colleges hesitate | Run pilots with agreed metrics; publish results | Pilot data |
| **Content quality doubts** (AI-generated cases) | High | Medium | Faculty reject the library | Blind review by faculty/alumni; let faculty author and curate; label reviewed cases | Review scores on 30 cases |
| **AI grading trust** | High | Medium | Faculty ignore AI grades | AI shown as advisory; publish agreement statistics; calibrate prompts per institute | AI–faculty correlation |
| Competition (global players entering India; free AI) | Medium | Medium | Price pressure; differentiation erodes | Lean on the institutional loop and Indian formats; build faculty content lock-in | Win/loss notes |
| **Willingness to pay** | High | Unknown | No revenue | Price discovery in validation calls; paid pilots where possible | ≥ 3 price commitments |
| College procurement cycles | Medium | High | 6–12 month revenue delay | Time pilots to budget cycles; founding-partner pricing | Days to PO |
| Student adoption | High | Medium | Licences unused → no renewal | Faculty assignments; ambassadors; placement-season campaigns | Activation and weekly-active data |
| Data privacy & camera proctoring | High | Medium | Student/parent objections; DPDP exposure | Clear notice and consent; on-device processing; 30-day deletion; DPA template; option to disable camera per institute *(not built)* | Privacy review by one college's IT/legal |
| Regulation (DPDP Rules, core duties ~May 2027) | Medium | Certain to apply | Compliance work | Privacy notice, data-processing agreements, retention policy, breach process | Legal review |
| Integration gaps (no LMS/SSO) | Low–Medium | Medium | Some colleges require it | Email-domain enrolment now; CSV export; LMS integration on demand | Count of colleges asking |
| **AI operating cost** (Gemini prices double 1 Jan 2027) | High | Certain | Margin squeeze at heavy usage | Tier quotas; Flash-Lite for grading after quality test; caching; cost cap (built) | Usage per seat in pilots; model comparison |
| Retention | High | Unknown | No recurring revenue | Faculty embedding; termly reports; renewal readouts | Renewal rate |
| Platform dependence (Google AI, Supabase, Vercel, Google OAuth) | Medium | Low–Medium | Outage or price change | Provider-switchable AI layer (built); encrypted backups (turn on); documented rebuild (Oct 2026 proved it works) | Backup restore drill |
| **Operational fragility** (all earlier users lost in Oct 2026) | High | Happened once | Reputational damage if it recurs with a client | Schedule backups now (needs 3 GitHub secrets); monthly restore drill; second admin | Backup logs |
| GD on campus networks without TURN | Medium | High on strict Wi-Fi | Live GDs fail in demos | Configure TURN before any demo | Test from a college network |
| Proctoring false positives | Medium | Medium | Unfair test endings; complaints | Faculty reopen (built); evidence photos; `?camera-debug` tuning; threshold calibration | Reopen rate in pilots |

---

## 7. The ten questions to answer before pitching this as a viable business

1. Do placement heads rank "students not preparing / no visibility" as a top-3 problem, and what do they do about it today?
2. What do target institutes currently **spend** on placement preparation (GD/PI vendors, aptitude, proctoring, career tools), and from which budget?
3. Who signs, and when in the year is the budget committed?
4. Will students use it **without** faculty assignments? What is the organic weekly-active rate?
5. Do AI grades agree with faculty marks closely enough for faculty to trust them?
6. Are the AI-generated cases realistic enough for faculty and alumni to endorse?
7. Is ₹500–₹800 per student per year acceptable, and is the contract minimum (₹70k–₹1.5L) affordable for the ICP?
8. Will students, parents and college IT accept webcam proctoring, and with what notice and consent?
9. Can AI cost per seat stay below ~15% of price after the 2027 price change, without hurting grading quality?
10. What is the venture-scale expansion path (UG management, engineering placements, recruiter assessments, international), and how big is each?
