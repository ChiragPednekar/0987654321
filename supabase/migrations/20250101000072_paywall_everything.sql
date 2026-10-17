-- ============================================================================
-- CaseCode — nothing opens without a plan or a licence
-- ============================================================================
-- 071 opened sign-up and gated PRACTISING behind can_solve(). The owner wants
-- more: a signed-in account that has neither bought a plan nor been added to a
-- live campus licence should see nothing of the product — not the cases, not
-- the drills, not the dashboard — only the way to pay.
--
-- Two layers, as before:
--
--   1. app_gate() — one call the middleware makes per request, answering for
--      the CALLER only (it takes no user argument, so it cannot be used to
--      probe someone else's account): is the account live, and is it
--      entitled. Entitled means exactly can_solve(): a staff role, a named
--      individual, Pro by hand, a live subscription period, or a live campus
--      licence seat.
--
--   2. has_access() — the RESTRICTIVE policy on every content table — now also
--      requires entitlement, so the questions cannot be read straight through
--      PostgREST with a free account's token either. The policies are
--      recreated with the call wrapped in a scalar subquery, so Postgres runs
--      it once per statement instead of once per row.
-- ============================================================================

create or replace function public.app_gate()
returns table(live boolean, entitled boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (select 1 from public.users u where u.id = auth.uid() and u.deactivated_at is null),
    public.can_solve(auth.uid());
$$;

comment on function public.app_gate() is
  'For the calling account only: live (not deactivated) and entitled (can_solve).
   Read by the middleware on every protected request (072).';

revoke all on function public.app_gate() from public, anon;
grant execute on function public.app_gate() to authenticated, service_role;

-- Same signature: every RESTRICTIVE policy keeps working. can_solve() already
-- requires the account to be live.
create or replace function public.has_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_solve(p_user);
$$;

comment on function public.has_access(uuid) is
  'True when the account may see the product at all: live AND entitled
   (can_solve). 072; it meant "live" in 071 and "on access_allowlist" in 060.';

-- An RLS helper: it must stay callable or every policy that reads it fails.
grant execute on function public.has_access(uuid) to anon, authenticated, service_role;

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
      continue;
    end if;
    execute format('drop policy if exists "access list only" on public.%I', t);
    execute format(
      'create policy "access list only" on public.%I as restrictive for select
         to anon, authenticated using ((select public.has_access()))', t);
  end loop;
end;
$$;
