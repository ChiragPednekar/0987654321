-- ============================================================================
-- CaseCode — complimentary access: every premium feature, now and later
-- ============================================================================
-- The owner's own account should have every premium feature that exists and
-- every one added in future, without buying a plan and without being metered.
--
-- A plan='pro' flag already gave Pro, but Pro is still metered (the yearly
-- allowance and the 5-hour window) and does not cover the certificate exams,
-- which are sold separately. So this adds an explicit grant, by email:
--
--   * has_pro() and can_solve() include it. Every premium feature is gated on
--     one of those two (directly, or through canSolve/getAccess/the quota
--     RPC), so a feature added later picks it up without a code change —
--     PROVIDED it gates on them. See HANDOFF.md.
--   * is_complimentary() is what the app reads to lift the usage limits and
--     make certificate exam attempts free (src/lib/quota.ts,
--     src/lib/billing/purchases.ts).
--
-- Expert mock interviews stay paid even here: that money goes to the expert.
-- ============================================================================

create table if not exists public.complimentary_access (
  email      citext primary key,
  note       text,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.complimentary_access is
  'Accounts given every premium feature, current and future, free and unmetered (074).';

alter table public.complimentary_access enable row level security;
revoke all on public.complimentary_access from public, anon, authenticated;
grant select, insert, update, delete on public.complimentary_access to service_role;

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
    join public.complimentary_access c on c.email = u.email::citext
    where u.id = p_user and u.deactivated_at is null
  );
$$;

revoke all on function public.is_complimentary(uuid) from public, anon, authenticated;
grant execute on function public.is_complimentary(uuid) to service_role;

create or replace function public.has_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    not exists (
      select 1 from public.users u
      where u.id = p_user and u.deactivated_at is not null
    )
    and (
      coalesce((select u.plan = 'pro' or u.role = 'admin'
                from public.users u where u.id = p_user), false)
      or public.is_complimentary(p_user)
      or public.has_active_subscription(p_user)
      or exists (
        select 1
        from public.institution_members m
        join public.institutions i on i.id = m.institution_id
        where m.user_id = p_user
          and i.grants_pro
          and not i.is_suspended
          and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
          and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
      )
    );
$$;

create or replace function public.can_solve(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_user
      and u.deactivated_at is null
      and (
        exists (select 1 from public.role_grants g where g.email = u.email::citext)
        or exists (select 1 from public.solve_allowlist a where a.email = u.email::citext)
        or exists (select 1 from public.complimentary_access c where c.email = u.email::citext)
        or u.plan = 'pro'
        or public.has_active_subscription(u.id)
        or exists (
          select 1
          from public.institution_members m
          join public.institutions i on i.id = m.institution_id
          where m.user_id = u.id
            and not i.is_suspended
            and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
            and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
        )
      )
  );
$$;

revoke all on function public.has_pro(uuid) from public, anon, authenticated;
revoke all on function public.can_solve(uuid) from public, anon, authenticated;
grant execute on function public.has_pro(uuid) to service_role;
grant execute on function public.can_solve(uuid) to service_role;

insert into public.complimentary_access (email, note)
values ('chiragpednekar3@gmail.com', 'Owner: every premium feature, current and future')
on conflict (email) do nothing;
