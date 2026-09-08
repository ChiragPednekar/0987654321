# Migrating CaseCode from Vercel + Supabase to Google Cloud

Status: **infrastructure and database layer written; not yet provisioned.**
Nothing in production has changed. Vercel and Supabase are untouched and remain
the live system.

## Why the shape of this migration is unusual

The audit found three of the usual migration workstreams are empty:

| Supabase feature | Call sites | Action |
|---|---|---|
| Storage | 0 | none — do not create a GCS bucket for app data |
| Realtime | 0 | none — do not introduce Pub/Sub |
| Edge Functions | 0 | none exist |

And one is enormous: **269 `.from()` calls** go through PostgREST, which Cloud
SQL does not have. That single fact, not the data, is the migration. The
database is 2,766 rows and 9.5 MB — a `pg_dump` measured in seconds.

The mitigating discovery: only **3 client components** query tables directly.
The other ~266 calls already run server-side across 74 files. The app is
already `Browser → Backend → Database`, which is the target architecture.

## Target

```
GitHub → Cloud Build → Artifact Registry → Cloud Run (asia-south1)
                                             ├── Cloud SQL Postgres 17 (private IP)
                                             ├── Identity Platform
                                             └── Secret Manager
Cloud Scheduler ──OIDC──> /api/cron/refresh-leaderboards
```

**One Cloud Run service, not a frontend/backend split.** This is a single
Next.js process: Server Components, route handlers and middleware are the same
server. Splitting them would mean rewriting the app. Firebase Hosting alone
cannot run Server Components.

**asia-south1 (Mumbai).** The Supabase database is already in `ap-south-1` while
Vercel runs functions in `iad1` (Virginia), paying ~200ms per query each way —
measured as a **4.3s warm TTFB on `/dashboard`**. Co-location is most of the fix.

## The identity problem, and how it is solved

On Supabase, RLS worked because GoTrue put the user id in the request JWT and
`auth.uid()` read it back. Cloud SQL has no GoTrue and no per-request JWT.

Deleting the policies was not an option — 75 of them *are* the access control,
and 35 read `auth.uid()` directly. So identity moves to a transaction-local
session setting:

| | Supabase | Cloud SQL |
|---|---|---|
| Identity source | `auth.uid()` from JWT | `app.current_user_id()` from `SET LOCAL` |
| RLS-subject role | `authenticated` | `casecode_app` |
| RLS-exempt role | `service_role` key | `casecode_admin` (BYPASSRLS) |

`src/lib/db/withUser()` is the only way to get an RLS-subject connection. It
uses `SET LOCAL` inside a transaction — a plain `SET` would outlive the
transaction on a pooled connection and leak one user's identity into the next
request that borrowed it.

## Files

| Path | Purpose |
|---|---|
| `terraform/` | All infrastructure. 8 files, HCL-validated. |
| `gcp/sql/01_app_identity.sql` | `app` schema, `current_user_id()`, the two roles |
| `gcp/sql/02_helper_functions.sql` | 5 RLS helpers ported off `auth.uid()` |
| `gcp/sql/03_rls_policies.sql` | All 75 policies, generated not hand-written |
| `scripts/gcp/generate-rls-port.sql` | Regenerates the above from live Supabase |
| `scripts/gcp/verify-rls-port.sql` | Fails if any `auth.` reference survives |
| `scripts/gcp/export-supabase.sh` | Read-only dump + de-Supabase transform |
| `scripts/gcp/validate-migration.ts` | Diffs both databases across 9 dimensions |
| `src/lib/db/index.ts` | Pools, `withUser()`, `asAdmin()` |
| `cloudbuild.yaml` | test → build → push → deploy |

`03_rls_policies.sql` is generated because one mistyped predicate fails *open* —
a policy reading `true` where it should read `user_id = app.current_user_id()`
exposes every row and still passes a smoke test.

## Environment variables

Names only. Never commit values.

| Name | Class | Notes |
|---|---|---|
| `DATABASE_URL` | SECRET | `casecode_app` DSN, RLS applies |
| `DATABASE_ADMIN_URL` | SECRET | `casecode_admin` DSN, BYPASSRLS |
| `CRON_SECRET` | SECRET | replaced by OIDC once Scheduler is live |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | SECRET | |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | SECRET | |
| `RAZORPAY_KEY_ID`, `AI_PROVIDER`, `*_MODEL` | SERVER_ONLY | |
| `NEXT_PUBLIC_SITE_URL` | PUBLIC · **BUILD_TIME** | inlined into the bundle |

`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` all disappear. The browser no longer talks to a
database, so there is no public key to ship.

**Build-time trap:** `NEXT_PUBLIC_*` are baked in at `docker build`, not
injected at runtime. Passing them only to Cloud Run ships a bundle with
`undefined` compiled in — it fails in the browser and not in CI.

## Authentication

Supabase stores **bcrypt `$2a$` cost-10** hashes (verified — algorithm metadata
only, no hash material read). `firebase auth:import --hash-algo=BCRYPT` accepts
these directly, and Identity Platform accepts an explicit `localId`, so:

- existing passwords keep working — no forced reset
- **existing UUIDs are preserved**, so `public.users.id` needs no remapping
- the 2 Google OAuth identities re-link by verified email

This is a real capability, not an assumption. What must still be rebuilt:
session handling (Firebase ID tokens replace the `sb-*` cookie), the two
`auth.users` triggers become backend logic on first sign-in, and password-reset
and verification emails move to Identity Platform templates.

## Restore order

Order matters. Policies load **last** so they do not fight the data load.

```bash
SUPABASE_DIRECT_URL='postgresql://...' ./scripts/gcp/export-supabase.sh
psql "$CLOUDSQL_URL" -f out/schema.sql
psql "$CLOUDSQL_URL" -f gcp/sql/01_app_identity.sql
psql "$CLOUDSQL_URL" -f gcp/sql/02_helper_functions.sql
psql "$CLOUDSQL_URL" -f out/data.sql
psql "$CLOUDSQL_URL" -f gcp/sql/03_rls_policies.sql
psql "$CLOUDSQL_URL" -f scripts/gcp/verify-rls-port.sql
SUPABASE_DIRECT_URL=... CLOUDSQL_URL=... npx tsx scripts/gcp/validate-migration.ts
```

`validate-migration.ts` exits non-zero on any difference in row counts, columns,
keys, indexes, enums, functions, triggers or policy names. It uses exact
`count(*)`, not `pg_stat` estimates — those drift between vacuums, which is
exactly the margin a migration bug hides in.

## Cost

Honest assessment: **this migration increases cost.** Supabase free tier plus
Vercel Hobby is effectively ₹0. Cloud SQL cannot scale to zero.

| Service | Driver | Rough monthly |
|---|---|---|
| Cloud SQL `db-g1-small` | always on | $25–35 |
| Cloud Run | `min_instances = 1` | $8–15 |
| VPC connector | always on | $8 |
| Artifact Registry, Secret Manager, Scheduler, logs | small | $2–5 |

**≈ $45–60/month before traffic.** `min_instances = 0` and `db-f1-micro` cut it
to roughly $15 at the cost of cold starts. No figure here is a quote — they
depend on your actual usage.

## Rollback

Vercel and Supabase stay live and untouched throughout. Rollback is a DNS
change back, because the old stack was never modified. Keep both running until
the new stack has been stable for a full billing cycle.

**Never**, during any stage: delete the Vercel project, delete the Supabase
project, or point DNS at Cloud Run before `validate-migration.ts` passes.
