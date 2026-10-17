-- ============================================================================
-- CaseCode — every page is visible; solving is what is paid
-- ============================================================================
-- 072 hid the whole product from an account without a plan or licence. The
-- owner corrected that: anyone signed in may SEE everything — cases, rubrics,
-- drills, leaderboards — and only SOLVING needs a plan or a campus licence.
-- Solving is enforced route by route through can_solve() (src/lib/entitlement.ts).
--
-- So has_access(), the RESTRICTIVE policy on the content tables, goes back to
-- meaning "a live (not deactivated) account", as in 071. The policies keep
-- 072's scalar-subquery form, which runs the check once per statement.
-- app_gate() stays: the middleware reads its `live` column.
-- ============================================================================

create or replace function public.has_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = p_user and u.deactivated_at is null
  );
$$;

comment on function public.has_access(uuid) is
  'True for any live (not deactivated) account: every page is visible; solving
   is gated separately by can_solve() (073).';

-- An RLS helper: it must stay callable or every policy that reads it fails.
grant execute on function public.has_access(uuid) to anon, authenticated, service_role;
