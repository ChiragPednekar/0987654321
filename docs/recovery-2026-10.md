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

### 1. Create the Vercel project

The Vercel integration available to the agent is installation-scoped and
returns `403 forbidden / action: create / resource: project` on both
`create_project` and `create_git_project`. It can read and manage projects but
cannot create one. Import `ChiragPednekar/0987654321` from the dashboard.

Two gotchas: name it something other than the repo name, because Vercel
rejects an all-digits project name; and set the function region to **bom1**,
or the region fix is silently lost.

Environment variables to set — `NEXT_PUBLIC_*` are already committed in
`.env.production` because they must be inlined at build time, the rest are
secrets and must not be:

| Key | Where it is |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (gitignored) |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PROVIDER` | `.env.local` |
| `CRON_SECRET` | `.env.local` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | still unset — payments stay dark until these exist |
| `NEXT_PUBLIC_TURN_*` | still unset — only affects GD audio relay |

### 2. Re-point the Google OAuth client

The Google OAuth *client* lives in Google Cloud Console, so it survived the
deletion. What died was the Supabase side of it. Two steps:

1. In Google Cloud Console → Credentials → that OAuth client, add this to
   **Authorized redirect URIs**:

   ```
   https://hhjxvnrjnyugepnsuafi.supabase.co/auth/v1/callback
   ```

   The old URI pointed at the deleted project's domain. Until this is added,
   Google refuses the callback no matter what else is configured — this is
   almost certainly what "the Google sign-in is broken" means.

2. Paste that client's ID and secret into Supabase → Authentication →
   Providers → Google, and enable it. `external_google_enabled` is currently
   `false`, and the sign-in button follows that flag, so the button is hidden
   until it flips.

Then set `site_url` and add the production callback to the allow-list:

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
curl -X PATCH "https://api.supabase.com/v1/projects/hhjxvnrjnyugepnsuafi/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"site_url":"https://YOUR-DOMAIN","uri_allow_list":"https://YOUR-DOMAIN/**,http://localhost:3000/**"}'
```

The allow-list currently holds localhost only, which is why local dev works
and production will not until this runs.

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
