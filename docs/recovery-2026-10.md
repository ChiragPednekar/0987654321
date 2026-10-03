# Rebuilding CaseCode after the October 2026 deletion

Both Supabase projects the app had ever used were deleted, along with the
Vercel project. This is what was rebuilt, how, and the two things that still
need a human.

## What was lost and what was not

| Thing | State |
| --- | --- |
| Supabase `hqnsyyhguxtnvkwearoa`, `oagurepbqtydiiiikidg` | deleted, unrecoverable (API returns "no permission" for both) |
| Vercel project + `mableetcode.vercel.app` | gone; the team's other 11 projects are untouched |
| Schema, policies, functions, content | **not lost** — all of it regenerates from this repository |
| Registered users and their passwords | **permanently gone.** Password hashes lived only in the deleted project. Nobody can restore these, including Supabase. |

The last row is the only real data loss. Everything else was reproducible
because the migrations and seeders are the source of truth, not the database.

## The new project

`casecode` / `hhjxvnrjnyugepnsuafi`, ap-south-1, free tier, $0/month.

Mumbai on purpose: functions and database have to sit in the same region, and
that co-location is what took homepage TTFB from ~990ms to ~205ms.

## How the schema was restored

All 59 migrations were replayed **byte-exact from disk**, never retyped:

```bash
jq -Rs '{query: .}' migration.sql \
  | curl -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $TOKEN" --data-binary @-
```

`$TOKEN` comes from the already-authenticated CLI:
`security find-generic-password -s "Supabase CLI" -w`.

This matters. Retyping 480KB of SQL through a model's context is exactly how a
subtle corruption enters a schema — a flipped comparison in an RLS policy, a
dropped `not`. Streaming the files through `jq` removes that failure mode
entirely, so the restored schema is identical to the committed one by
construction, not by inspection.

Result: 83 tables, 92 functions, 22 enums, 135 RLS policies, 27 triggers, and
a `supabase_migrations.schema_migrations` ledger with all 59 rows, so the CLI
treats the project as up to date.

## Content restored

Every seeder ran clean. Verified by row count, then again by fetching the
rendered pages with a real signed-in session:

- 969 rows in `cases` — 840 `full_case`, plus the written formats
  (wat, memo, rca, metrics, gtm_plan, …), 30 `debug`, 11 `guesstimate`,
  3 `drill`, 2 `model`
- 964 rubrics, 314 objective aptitude questions, 20 GD topics
- 21 Excel and 15 SQL exercises
- 20 companies carrying 49 first-party links
- 3 competitions, 3 negotiations, 3 sales scenarios, 3 learning paths

Note `cases` holds the written formats too; there is no separate
`written_exercises` table, and `official_links` is a jsonb column on
`companies`, not a table.

## Accounts

Google sign-in only, so no passwords were created. Roles attach on first
sign-in via the trigger on `role_grants`:

- `casecode01@gmail.com` → `admin` (opens the student, teacher and admin homes)
- `chiragpednekar3@gmail.com`, `chiragpednekar7@gmail.com` → Pro, role
  `student`

All three are on `solve_allowlist`, which is the separate gate for grading,
interviews and the AI routes. `has_pro()` and `can_solve()` are independent on
purpose — do not collapse them.

## Still needs a human

### 1. Paste four environment variables into Vercel, then redeploy

The project is live at **https://casecode-ebon.vercel.app**, built from the
right commit, and deployed to **bom1** — `vercel.json` carried the region
through, so that did not need setting by hand.

It is not finished, though. `/sql`, `/excel`, `/companies` and `/competitions`
all return HTTP 200 but render the `loading.tsx` skeleton and nothing else.
The RSC payload carries a server error (`9:E{"digest":...}`) while the
surrounding layout renders fine, including the signed-in profile read from the
database. That split is the whole diagnosis: the layout uses the ordinary SSR
client, those four pages call `createAdminClient()`, and it throws by design
when `SUPABASE_SERVICE_ROLE_KEY` is missing.

So the URL and anon key are correct and the database is reachable. The service
role key is simply absent from the deployment. Verified by elimination, not by
guesswork: the same commit against the same database, run locally with the key
present, renders those pages at 231KB / 210KB / 273KB of real content instead
of 42KB of skeleton.

The agent could not set these. The Vercel integration available to it is
read-only beyond project metadata — `403 forbidden` on
`create projectEnvVars`, on `list projectEnvVars`, on `list deployment`, and
on project creation. Only the reads of project and deployment metadata work.

Set these four in Vercel → Settings → Environment Variables, for Production,
Preview and Development. Print the exact values without pasting secrets into a
chat window:

```bash
grep -E '^(SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|GEMINI_MODEL|AI_PROVIDER|CRON_SECRET)=' .env.local
```

| Key | Mark as | Without it |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Sensitive | the four pages above stay blank |
| `GEMINI_API_KEY` | Sensitive | grading errors on submit |
| `GEMINI_MODEL`, `AI_PROVIDER` | Plain | provider falls back wrongly |
| `CRON_SECRET` | Sensitive | the leaderboard and dead-link crons reject themselves |

Then redeploy. Environment variables are read at build time for
`NEXT_PUBLIC_*` and at runtime for the rest, but a redeploy is the only way to
be sure the running lambdas pick them up.

Still unset and still only affecting their own features: `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (payments stay dark) and
`NEXT_PUBLIC_TURN_*` (GD audio relay).

### 2. Re-point the Google OAuth client

The Google OAuth *client* lives in Google Cloud Console, so it survived the
deletion. What died was the Supabase half. Two steps:

1. In Google Cloud Console → Credentials → that OAuth client, add this to
   **Authorized redirect URIs**:

   ```
   https://hhjxvnrjnyugepnsuafi.supabase.co/auth/v1/callback
   ```

   The old URI pointed at the deleted project's domain. Until this is added,
   Google refuses the callback no matter what else is configured — this is
   almost certainly what "the Google sign-in is broken" means.

2. Paste that client's ID and secret into Supabase → Authentication →
   Providers → Google, and enable it. `external_google_enabled` is still
   `false`, and the sign-in button asks the auth server what is enabled, so
   the button stays hidden until it flips.

`site_url` and the redirect allow-list are already set to
`https://casecode-ebon.vercel.app` (plus the preview wildcard and localhost),
so nothing further is needed there.

## Carried-over issues, not caused by the outage

- Six AI routes are still uncapped; competition entries are the worst case.
- `protect_last_admin_grant()` and `sync_role_from_grants()` are trigger
  functions but are reachable as REST RPCs. Harmless in practice (they fault
  without a trigger context) and pre-existing, but worth revoking. Revoking
  needs `from public` as well as from `anon, authenticated` — and the
  `is_*()` RLS helpers next to them must stay executable or every policy
  breaks.
- `.env.cloud.backup` and `casecode01_*.sql` in the repo root refer to the
  deleted projects and the dead `mableetcode.vercel.app`. Safe to delete.
