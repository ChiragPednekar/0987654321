# Deploying CaseCode

Roughly 30 minutes end to end.

---

## 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then from
**Project Settings → API** collect:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> The service-role key bypasses RLS entirely. It belongs in server environment
> variables only — never in a `NEXT_PUBLIC_*` variable, never in the browser.

## 2. Apply the schema

**Option A — Supabase CLI (recommended).**

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

**Option B — SQL editor.** Paste each file from `supabase/migrations/` into the
Supabase SQL editor and run them **in filename order**:

1. `20250101000000_schema.sql` — tables, enums, indexes, views
2. `20250101000001_functions.sql` — triggers, XP, streaks, badges, leaderboards
3. `20250101000002_policies.sql` — row level security
4. `20250101000003_reference_data.sql` — categories, paths, badges
5. `20250101000004_column_privileges.sql` — **column-level grants; do not skip**
6. `20250101000005_function_hardening.sql` — **closes the RPC surface; do not skip**

> Steps 5 and 6 are not optional.
>
> Without step 5, RLS is row-level only: a student can update their own row's
> `role` column and make themselves an admin with nothing but the public anon
> key.
>
> Without step 6, every `public` function is exposed as a PostgREST endpoint at
> `/rest/v1/rpc/<name>` — including `sync_contest_statuses()`, which an
> anonymous visitor could POST to in order to move every contest between
> scheduled, live and grading.

After applying, check **Advisors → Security** in the dashboard. Three warnings
are expected and deliberate: `citext` living in the `public` schema, and
`is_admin()` being callable by `anon`/`authenticated` (the RLS policies invoke
it, and it only ever reports on the caller's own row).

Verify:

```sql
select count(*) from public.case_categories;  -- 24
select count(*) from public.badges;           -- 17
select count(*) from public.learning_paths;   -- 3
```

## 3. Authentication

**Authentication → URL Configuration**

- Site URL: your production URL (`http://localhost:3000` while developing)
- Redirect URLs: add `https://your-domain.com/auth/callback` and
  `http://localhost:3000/auth/callback`

**Google login.** Create an OAuth client in the Google Cloud console, set the
authorised redirect URI to
`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`, then paste the client
ID and secret into **Authentication → Providers → Google**.

Email confirmation is on by default. For local development you may want to turn
it off under **Authentication → Providers → Email** so signups log in
immediately.

## 4. Seed the case library

```bash
cp .env.example .env.local     # fill in the Supabase values
npm install
npm run seed:dry               # generate + validate, writes nothing
npm run seed                   # 300 cases, rubrics, and learning path steps
```

Expected output:

```
Generated 100 Finance cases
Generated 100 Consulting cases
Generated 100 Product Management cases
Validated 300 cases with no problems.
Difficulty spread: { easy: 63, medium: 174, hard: 63 }
```

## 5. Make yourself an admin

Sign up through the UI first, then in the SQL editor:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

`/admin` is now reachable. Note the middleware checks the role on every admin
request, and the RLS policies check it again in the database.

## 6. Deploy to Vercel

```bash
npx vercel
```

Add every variable from the table in the README under **Settings → Environment
Variables**. Generate the cron secret with:

```bash
openssl rand -base64 32
```

Redeploy after adding variables — Vercel does not apply them retroactively.

## 7. Cron jobs

`vercel.json` registers two schedules:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/refresh-leaderboards` | every 10 min | Rebuild rankings, sync contest statuses |
| `/api/cron/weekly-contest` | Fridays 06:00 UTC | Finalise the closed contest, open the next |

Vercel sends `Authorization: Bearer $CRON_SECRET`; the routes compare it in
constant time and reject anything else. Verify manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/refresh-leaderboards
```

> Vercel Cron requires a Pro plan. On Hobby, call the same endpoints from any
> external scheduler (GitHub Actions, cron-job.org) with the same header.

## 8. Function timeouts

Evaluation takes 15-40 seconds, so `/api/submissions` declares
`maxDuration = 120`. Hobby plans cap functions at 60s — either upgrade, or
switch to a faster model via `OPENAI_MODEL`.

---

## Verifying the database logic

All scoring, XP, streak, badge, leaderboard and contest logic lives in Postgres.
To exercise it against a throwaway database rather than production:

```bash
# a scratch cluster
initdb -D /tmp/ccpg -U postgres --auth=trust
pg_ctl -D /tmp/ccpg -o "-p 55432" -l /tmp/ccpg.log start
createdb -h 127.0.0.1 -p 55432 -U postgres casecode_test
```

Supabase's `auth` schema does not exist locally, so create a stand-in with an
`auth.users` table and an `auth.uid()` function, apply the four migrations in
order, then insert a user, a case, a rubric, a submission and a score and check
that the derived columns move as expected. The suite used during development
covers 41 assertions across:

- profile creation from `auth.users`
- attempt numbering and per-case counters
- XP by difficulty, retry discounting, and partial credit on a fail
- solved-once semantics (re-solving must not double-count)
- streak continuation, same-day no-op, and reset after a gap
- badge criteria and grant idempotency
- leaderboard ranking and refresh idempotency
- speed-bonus decay, contest finalisation and ranking
- learning-path progress
- vote counter sync

---

## Cost

The dominant variable cost is evaluation. With `gpt-4o-mini` at roughly
3-5k tokens per evaluation, 10,000 evaluations a month costs a few dollars.
Larger models cost meaningfully more per evaluation — worth measuring against
grading quality before committing.

`scores.tokens_used` records per-evaluation usage:

```sql
select model, count(*), avg(tokens_used)::int, sum(tokens_used)
from public.scores group by model;
```

## Production checklist

- [ ] All six migrations applied, in order (including column privileges and function hardening)
- [ ] RLS confirmed enabled (Supabase flags unprotected tables in **Advisors**)
- [ ] Service-role key set as a server-only variable
- [ ] Auth redirect URLs match the deployed domain
- [ ] `npm run seed` completed
- [ ] At least one admin promoted
- [ ] `CRON_SECRET` set and both cron endpoints returning 200
- [ ] A real submission graded end to end
