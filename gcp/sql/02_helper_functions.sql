-- ============================================================================
-- Cloud SQL — RLS helper functions, ported off auth.uid()
-- ============================================================================
-- These five are load-bearing: is_admin() alone backs 23 policies. They stay
-- SECURITY DEFINER for the same reason as on Supabase — a policy on `users`
-- that calls is_admin(), which itself reads `users`, would recurse into its own
-- policy without it.
--
-- Only the identity source changed. Generated from the live Supabase catalogue
-- (see scripts/gcp/generate-rls-port.sql) rather than retyped, so the bodies
-- match production exactly.
-- ============================================================================

create or replace function public.institution_role_of(p_institution uuid)
returns institution_role
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select m.role from public.institution_members m
  where m.institution_id = p_institution and m.user_id = app.current_user_id();
$function$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.users where id = app.current_user_id() and role = 'admin'
  );
$function$;

create or replace function public.is_classroom_member(p_classroom uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.classroom_members m
                 where m.classroom_id = p_classroom and m.user_id = app.current_user_id());
$function$;

create or replace function public.is_classroom_teacher(p_classroom uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.classroom_members m
                 where m.classroom_id = p_classroom and m.user_id = app.current_user_id()
                   and m.role = 'teacher');
$function$;

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.group_members m
                 where m.group_id = p_group and m.user_id = app.current_user_id());
$function$;

-- Policies call these as the querying role, so casecode_app needs EXECUTE.
-- This is the same reason the Supabase linter's warning about them was wrong to
-- act on there: revoking breaks every policy that calls them.
grant execute on function
  public.is_admin(),
  public.is_group_member(uuid),
  public.is_classroom_member(uuid),
  public.is_classroom_teacher(uuid),
  public.institution_role_of(uuid)
to casecode_app, casecode_admin;

-- These two take a user id as an argument rather than from the session, so they
-- must NOT be reachable by the app role. On Supabase they leaked: has_pro()
-- answered `true` to anonymous callers for any account. Keep them owner-only.
revoke execute on function public.has_pro(uuid) from public, casecode_app;
revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, casecode_app;
