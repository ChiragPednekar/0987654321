-- ============================================================================
-- CaseCode — invite-only access
-- ============================================================================
-- Until now the library was deliberately open: updateSession() protected only
-- the personal and administrative surfaces, and anyone with a Google account
-- could sign up and read every published platform case. That was the top of
-- the funnel. The owner has asked for the opposite — nobody sees the questions
-- until their address is on a list he controls.
--
-- WHERE THIS IS ENFORCED, AND WHY IT TAKES TWO PLACES
--
-- 1. `auth.users` BEFORE INSERT. An address that is not listed cannot become
--    an account at all. This is the real gate: no account, no session, no
--    read, and nothing downstream has to be correct for it to hold.
--
-- 2. A RESTRICTIVE policy on each content table. Restrictive policies AND with
--    the existing permissive ones, so the published/visibility logic already
--    written is kept intact and simply has one more condition. This is what
--    stops someone calling PostgREST directly with their own JWT instead of
--    going through the app.
--
-- Two places because neither covers the other. The trigger does not help for
-- an account that was listed and is later removed; the RLS does not help on
-- the pages that render through the service-role client (/sql, /excel,
-- /companies, /competitions), because service_role bypasses RLS by design.
-- The middleware covers that third case, and is UX, not a boundary.
--
-- NOT A SECOND LICENCE LIST
--
-- `solve_allowlist` answers "may this account spend AI budget", and keeps that
-- meaning. This answers "may this account see anything at all". They are
-- independent on purpose: a licensed account that is removed from access must
-- lose the content, and an account with access is not thereby granted the
-- grading spend.
-- ============================================================================

create table if not exists public.access_allowlist (
  email      citext primary key,
  note       text,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.access_allowlist is
  'Addresses permitted to hold an account and read content. Empty means nobody.';

alter table public.access_allowlist enable row level security;

drop policy if exists "admins manage access allowlist" on public.access_allowlist;
create policy "admins manage access allowlist" on public.access_allowlist
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.access_allowlist from public;
revoke all on public.access_allowlist from anon, authenticated;
grant select, insert, update, delete on public.access_allowlist to service_role;

-- ---------------------------------------------------------------------------
-- Seed. Anyone who already held a role or a licence keeps access, so turning
-- this on cannot lock out an account that was already trusted.
-- ---------------------------------------------------------------------------
insert into public.access_allowlist (email, note)
select email, 'carried over from role_grants' from public.role_grants
on conflict (email) do nothing;

insert into public.access_allowlist (email, note)
select email, 'carried over from solve_allowlist' from public.solve_allowlist
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- has_access(): the one answer both layers read.
-- ---------------------------------------------------------------------------
create or replace function public.has_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.access_allowlist a on a.email = u.email::citext
    where u.id = p_user
  );
$$;

comment on function public.has_access(uuid) is
  'True when the account''s address is on access_allowlist. Used by the
   RESTRICTIVE content policies and by the middleware.';

-- An RLS helper: it must stay callable or every policy that reads it fails.
grant execute on function public.has_access(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Gate 1 — an unlisted address cannot become an account.
-- ---------------------------------------------------------------------------
create or replace function public.reject_unlisted_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.access_allowlist a where a.email = new.email::citext
  ) then
    -- 42501 = insufficient_privilege. GoTrue surfaces this as a refusal
    -- rather than a crash, so the person sees a rejection, not a 500.
    raise exception 'CaseCode is invite-only; % has not been granted access.',
      new.email
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_check_access on auth.users;
create trigger on_auth_user_created_check_access
  before insert on auth.users
  for each row execute function public.reject_unlisted_signup();

-- ---------------------------------------------------------------------------
-- Gate 2 — RESTRICTIVE policies on the content tables.
--
-- Applied in a loop so a table that does not exist in some environment is
-- skipped rather than failing the migration. RESTRICTIVE means these AND with
-- whatever permissive policy the table already has: the published/visibility
-- rules are untouched, they just also require access now.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  content_tables text[] := array[
    'cases', 'rubrics', 'objective_questions', 'gd_topics', 'drill_questions',
    'negotiation_cases', 'sales_scenarios', 'companies', 'competitions',
    'learning_paths', 'learning_path_steps', 'case_categories',
    'sql_exercises', 'excel_exercises'
  ];
begin
  foreach t in array content_tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipped (absent): %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "access list only" on public.%I', t);
    execute format(
      'create policy "access list only" on public.%I as restrictive for select
         to anon, authenticated using (public.has_access())', t);
  end loop;
end;
$$;
