# CaseCode — hand-off, 17 Oct 2026

Everything below is committed on `main` (remote `chirag`, repo `ChiragPednekar/0987654321`), applied to the production Supabase project `hhjxvnrjnyugepnsuafi`, and deployed on Vercel. Read `AGENTS.md` first: this Next.js (16) differs from older versions. Its docs are in `node_modules/next/dist/docs/`.

## The business model now

- **Sign-up is open.** Anyone can create an account with any email. Supabase still requires email confirmation.
- **Viewing is free; solving is paid.** Any signed-in, non-deactivated account can open every page and see the full menu. Solving needs a **plan or a campus-licence seat**: submitting answers, AI grading, interviews, drills, SQL/Excel, aptitude and contests.
- **Who counts as entitled:** `public.can_solve()`. That means a role grant (admin/teacher/recruiter), `solve_allowlist`, `users.plan='pro'` (hand-granted), a live subscription period, or a live campus licence. Server code uses `canSolve()` in `src/lib/entitlement.ts`, which fails closed.

### Individual plans (`src/lib/pricing.ts`, the single source of truth)

| Plan | Price (GST incl.) | Length | Allowance |
|---|---|---|---|
| Monthly | ₹299 | 30 days | 50 graded answers + 10 interviews |
| Placement Season Pass | ₹799 | 90 days | 160 + 35 |
| Annual | ₹2,499 | 365 days | 500 + 100 |

- Each plan stays profitable even at full use after Gemini doubles its prices on 1 Jan 2027. `tests/subscription.test.ts` pins this.
- Plans don't auto-renew. Buying in the renewal window (5/14/30 days) queues the next period to start when the current one ends. Logic is in `src/lib/subscription.ts`; subscriptions have `plan_code` and `period_start`.
- **5-hour limit, like Claude's:** 8 graded answers + 3 interviews per window. The window opens at the first use and resets 5 hours later. This sits on top of the plan allowance.
- **Top-up packs:** ₹99 for 25 answers, ₹149 for 10 interviews, ₹299 for 50 + 15. They last 12 months, keep working past both limits, and require practise access.
- The usage maths is in `src/lib/quota.ts`:
  - `buildQuotaStatus()` is pure and unit-tested.
  - `chargeQuota()` spends one top-up credit, atomically through the `consume_usage_credit` database function, only right before a model call. All 9 AI routes call it.
- **Campus licences** still use `QUOTA` in `src/lib/constants.ts` (250 + 50 over a rolling 365 days, with per-licence overrides), plus the 5-hour limit.

### Sold separately: pay as you go, no plan needed

- **Certificate exams, ₹399 an attempt** (pass or fail). Three are seeded: consulting, finance, product & marketing.
  - Each is 2 cases in 90 minutes on a server clock, fully proctored.
  - The cases are sent to the browser only after the clock starts.
  - A proctor lockout voids the attempt.
  - A score of 60% or more issues a public page at `/certificate/CC-XXXXX-XXXXX` with a LinkedIn "Add to profile" link.
  - Code: `src/lib/certificates.ts`, `src/app/(app)/certificates/**`, `src/app/api/certificates/**`, `src/components/certificates/exam-room.tsx`.
- **Expert mock interviews: removed** (owner's decision, 17 Oct). The pages, API routes, components, `src/lib/experts.ts` and the checkout item were deleted. The empty database tables (`experts`, `expert_slots`, `expert_bookings`) were left in place; recover the code from commit `da6c47d` to bring it back.

### Payments

- **One order table:** every sale goes through `purchases`. `src/lib/billing/purchases.ts` prices items on the server and fulfils each one exactly once, whether the verify call or the webhook arrives first.
- **Routes:** `POST /api/billing/checkout` takes an item and creates a Razorpay order, or completes immediately in demo mode. `/api/billing/verify` and `/api/billing/webhook` handle Razorpay.
- **Client:** one component, `src/components/billing/checkout-button.tsx`.
- **Razorpay is not connected yet.** Until `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are set in Vercel, a **demo checkout** completes purchases without taking money; those rows have `source='demo'`.
- **Demo checkout is restricted on production:** only addresses on `access_allowlist` and admins can use it, so strangers can't take free Pro. Everyone else sees "Payments open soon". Locally it's open to all. Setting `DEMO_CHECKOUT=off` disables it. Logic: `src/lib/billing/checkout-mode.ts`.
- **At launch:** add the keys (webhook URL `/api/billing/webhook`, events `payment.captured` and `payment.failed`), then clear the demo data. Delete the subscriptions first, because their `purchase_id` has no foreign key to cascade:
  `delete from subscriptions where source='demo'; delete from purchases where source='demo';`

### Pages

- `/pricing` (public): plans, top-ups, the pay-as-you-go package, the campus licence and an FAQ.
- `/upgrade`: the store for signed-in students, with the current plan and usage.
- `/purchases/[id]`: receipts.
- Settings: plan, next period and payment history.
- Usage card (`src/components/quota-card.tsx`): plan allowance, the 5-hour window with its reset time, and top-up balance.
- Admin: Users (grant/end Pro), Sales (`/admin/sales`: revenue by product and the latest purchases).
- The locked-case panel is `src/components/case/licence-gate.tsx`.

## Database migrations added today (all applied to production)

| Migration | What it does |
|---|---|
| `069_subscription_entitlement` | Subscription periods feed `has_pro` and `can_solve`; payments no longer set `users.plan`. |
| `070_subscription_demo_source` | Allows `source='demo'`. |
| `071_open_signup_and_paid_products` | Drops the invite-only sign-up trigger. Adds plan columns, `purchases`, `usage_credits`/`usage_credit_debits`, `consume_usage_credit()`, `ai_usage_since()`, exams (`cert_*`, 3 seeded) and experts (`experts`, `expert_slots`, `expert_bookings`). All new tables are service-role only. |
| `072_paywall_everything` | Added `app_gate()`, which reports for the caller only whether the account is live and entitled; still used by the middleware. 072 also hid all content from unpaid accounts; that was **reverted by 073** at the owner's request. |
| `073_view_open_solve_paid` | `has_access()` again means "live account", so every page is visible. |
| `074_complimentary_access` | The `complimentary_access` table and `is_complimentary()`; `has_pro` and `can_solve` include it. The owner's account was added. |

After applying a migration with the Supabase MCP tool, rename its ledger version to match the file name: `update supabase_migrations.schema_migrations set version='2025010100007X' where name='...'`.

## Commits today

- `87aa00c` Proctoring: voice and gaze detection accuracy fixes; suspension now happens on the strike the counter shows.
- `10c63e3` SQL and Excel stop handing questions to accounts without access.
- `2df41b4` Individual subscriptions, first version.
- `0ca3dc0` Demo Upgrade checkout.
- `da6c47d` Open sign-up, the plans, the 5-hour limit, top-ups, exams and expert mocks.
- `8ce3ae2` Full paywall (later reverted).
- `71a08ff` Exams and experts sellable without a plan.
- `5f4176a` **Current behaviour:** see everything, only solving needs a plan. Also added access checks to `attempts/start`, `contests/[id]/start` and `practice/objective/submit`.

Earlier the same day: the editorial redesign of the teacher pages, dashboards, cases and login. See `casecode-visual-identity` in Claude's memory: paper and ink, a Bodoni serif, no boxed card grids.

## Complimentary access (owner's account) — keep this working for future features

`chiragpednekar3@gmail.com` is on `public.complimentary_access` (migration 074). That gives it every premium feature, now and in future: free, with no plan, allowance or 5-hour limit, and certificate exam attempts at no charge.

**Rule for every new premium feature:** gate it on `public.has_pro()` / `public.can_solve()` (in code: `canSolve()`, `getAccess()`, `getQuotaStatus()`), and treat `is_complimentary()` (or `QuotaStatus.exempt`) as "unlimited, never charge". Then complimentary accounts get the feature automatically. A feature that invents its own entitlement check, or charges for something CaseCode itself provides, must add a complimentary bypass.

## Test accounts

- `chiragpednekar7@gmail.com`: the owner's **no-plan test account**. It is on `access_allowlist`, so it can use the demo checkout on production. Keep it without a plan unless the owner says otherwise. To reset it:
  `delete from subscriptions where user_id=(select id from users where email='chiragpednekar7@gmail.com');`
- `chiragpednekar3@gmail.com`: the owner, with complimentary access (see above).

## Open work and known gaps (suggested next steps)

1. **Unpaid users need a clear in-page prompt on every solve surface.** Cases show the locked-case panel. The other features (SQL, Excel, aptitude, interviews, drills, simulation, negotiation, sales, resume, deck, GD, contests) currently only get a 403 response with a toast saying "Practising needs CaseCode access…". Each should show an upgrade panel in place of its start/submit button, like `LicenceGate`.
2. **Follow-up routes for an existing session don't re-check entitlement.** These are the interview turn/reply/say/end routes, `sim/runs/[id]/round` and `sales .../debrief`. A plan that lapses mid-session can finish that session. Add `canSolve` if that matters.
3. **Razorpay keys and launch clean-up**, as described above. Razorpay's KYC also needs Terms, Privacy, Refund/Cancellation and Contact pages.
4. **Group-discussion usage** is charged one credit when the session is created, but counted once per model call. This is a minor mismatch.
5. **Proctoring threshold tweaks** (`camera-preview.tsx`, `use-camera-proctor.ts`, `gaze-tracker.ts`, `proctor-config.ts`) were committed in `db1a8dc`, not by Claude. Review them if proctoring misbehaves.
6. **Production storage bucket `smartcart`:** empty, left by another project's migrations (`smartcart_*`). Not deleted.
7. **Vercel deploys sometimes lag:** `71a08ff` sat "pending" for a long time. Check with `gh api repos/ChiragPednekar/0987654321/commits/<sha>/status`.

## How to verify

- Before every commit: `npx tsc --noEmit`, `npx eslint src tests --quiet`, `npx vitest run`. At hand-off: 488 passed, 20 skipped.
- **Database changes:** test on the local Supabase first. Run `open -a Docker`, `supabase start` (or `supabase stop --no-backup` and then `supabase start` to rebuild); Postgres is at `127.0.0.1:54322`.
  - To point the dev server at the local database, export `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from `supabase status -o env` before `npx next dev`. Process environment variables override `.env.local`.
- **Signed-in behaviour:** create a throwaway user through the admin API, mint an `@supabase/ssr` cookie (`sb-<project-ref>-auth-token=base64-…`), and call routes with `Sec-Fetch-Site: same-origin` and `Origin` headers. Delete the throwaway users afterwards.
