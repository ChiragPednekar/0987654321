-- ============================================================================
-- Cloud SQL — the identity layer that replaces Supabase's auth schema
-- ============================================================================
-- On Supabase, RLS worked because GoTrue put the caller's user id into the
-- request JWT and `auth.uid()` read it back. Cloud SQL has no GoTrue, no auth
-- schema, and no per-request JWT — the database only ever sees one pooled
-- connection owned by the application.
--
-- Deleting the policies was never an option: 75 of them are the platform's
-- access control, and 35 read auth.uid() directly. So identity moves into a
-- session setting the backend sets on every checkout, and every policy reads it
-- through app.current_user_id() instead.
--
--   Supabase :  auth.uid()               <- from the request JWT
--   Cloud SQL:  app.current_user_id()    <- from `SET LOCAL app.user_id`
--
-- The security property is preserved only if the backend sets this on EVERY
-- borrowed connection, inside the transaction, before any query. src/lib/db
-- enforces that; see withUser() there.
-- ============================================================================

create schema if not exists app;

/**
 * The current request's user, or NULL when there isn't one.
 *
 * `true` as the second argument to current_setting means "return NULL if unset"
 * rather than raising. That matters: an unset value must read as "nobody",
 * which makes every `= app.current_user_id()` policy fail closed. Raising
 * instead would turn a missing SET LOCAL into a 500 on a page that should
 * simply have shown nothing — and, worse, tempt someone to wrap it in a
 * default that fails open.
 */
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

/**
 * The application's runtime role.
 *
 * Deliberately NOT the table owner and NOT superuser, because RLS is bypassed
 * by both. On Supabase the equivalent split was anon/authenticated (subject to
 * RLS) versus service_role (exempt). Here:
 *
 *   casecode_app    — subject to RLS, used for anything acting as a user
 *   casecode_admin  — BYPASSRLS, the narrow replacement for the service-role
 *                     key, used only by the paths that legitimately need it
 *                     (cron, admin dashboards, webhooks, usage accounting)
 *
 * Passwords are set out of band from Secret Manager, never written here.
 */
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'casecode_app') then
    create role casecode_app login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'casecode_admin') then
    create role casecode_admin login bypassrls;
  end if;
end
$$;

grant usage on schema app, public to casecode_app, casecode_admin;
grant execute on function app.current_user_id() to casecode_app, casecode_admin;

grant select, insert, update, delete on all tables in schema public to casecode_app;
grant usage, select on all sequences in schema public to casecode_app;
grant select, insert, update, delete on all tables in schema public to casecode_admin;
grant usage, select on all sequences in schema public to casecode_admin;

alter default privileges in schema public
  grant select, insert, update, delete on tables to casecode_app, casecode_admin;
alter default privileges in schema public
  grant usage, select on sequences to casecode_app, casecode_admin;

-- The table owner bypasses RLS implicitly. Force policies to apply to it too,
-- so a mistaken connection as the owner cannot quietly read everything.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (select c.relname from pg_class c
                        join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname = 'public' and c.relrowsecurity)
  loop
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end
$$;
