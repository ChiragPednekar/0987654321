-- ============================================================================
-- CaseCode — complimentary access includes admin accounts
-- ============================================================================
-- Extends is_complimentary() to treat admin accounts identically to entries in
-- complimentary_access: full unmetered access to every premium feature and free
-- certificate exam attempts.
-- ============================================================================

create or replace function public.is_complimentary(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    left join public.complimentary_access c on c.email = u.email::citext
    where u.id = p_user
      and u.deactivated_at is null
      and (c.email is not null or u.role = 'admin')
  );
$$;

revoke all on function public.is_complimentary(uuid) from public, anon, authenticated;
grant execute on function public.is_complimentary(uuid) to service_role;
