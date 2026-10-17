-- ============================================================================
-- CaseCode — individual subscriptions alongside campus licences
-- ============================================================================
-- Until now access to solve came from an elevated role, a named individual on
-- solve_allowlist, or a seat on a live campus licence. A student whose college
-- has not bought CaseCode had no way in.
--
-- Now they can subscribe to CaseCode Pro themselves. A subscription is a row
-- in public.subscriptions with status 'active' and a current_period_end in the
-- future; when the period ends, access ends with it.
--
-- THE PERIOD IS THE ENTITLEMENT, NOT users.plan
--
-- Payments used to set users.plan = 'pro' and never unset it, so one ₹499
-- payment bought Pro for ever — the period end was written and never read.
-- Paid access is now read from the subscription period alone. users.plan =
-- 'pro' remains, but only for Pro an admin grants by hand with no end date.
--
-- WHERE A SUBSCRIPTION COMES FROM
--
-- `source` says how the row was made: 'razorpay' for a verified payment,
-- 'manual' for an admin grant (a complimentary month, a test account, a
-- refund made good). Manual grants carry who granted them.
-- ============================================================================

alter table public.subscriptions
  add column if not exists source     text not null default 'razorpay',
  add column if not exists granted_by uuid references public.users(id) on delete set null;

alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions
  add constraint subscriptions_source_check check (source in ('razorpay', 'manual'));

create index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id, current_period_end desc)
  where status = 'active';

-- ------------------------------------------------- the one definition --

-- Paid-up right now. 'authenticated' and 'created' are checkout states, not
-- payment; a null period end is never treated as "for ever".
create or replace function public.has_active_subscription(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user
      and s.status = 'active'
      and s.current_period_end is not null
      and s.current_period_end > now()
  );
$$;

comment on function public.has_active_subscription(uuid) is
  'True while the account has an active, paid-up (or admin-granted) subscription period.';

revoke execute on function public.has_active_subscription(uuid) from public, anon, authenticated;
grant execute on function public.has_active_subscription(uuid) to service_role;

-- Pro: the interviewer, the larger allowance. Same as before plus a live
-- subscription period.
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

revoke execute on function public.has_pro(uuid) from public, anon, authenticated;
grant execute on function public.has_pro(uuid) to service_role;

-- May practise at all: answer cases, open SQL/Excel/aptitude questions, run
-- drills. Adds an individual subscription (or hand-granted Pro) to the
-- three existing routes in.
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
        -- 1. Runs the platform (admin, teacher, recruiter).
        exists (select 1 from public.role_grants g where g.email = u.email::citext)

        -- 2. Named individually.
        or exists (select 1 from public.solve_allowlist a where a.email = u.email::citext)

        -- 3. Pays for it: a live subscription period, or Pro granted by hand.
        or u.plan = 'pro'
        or public.has_active_subscription(u.id)

        -- 4. Covered by a live campus licence. Matched on membership rather
        --    than on the email domain alone, so revoking a seat actually
        --    revokes access.
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

comment on function public.can_solve(uuid) is
  'True when the account may practise: staff role, named individual, live subscription or hand-granted Pro, or a campus licence seat.';

revoke execute on function public.can_solve(uuid) from public, anon, authenticated;
grant execute on function public.can_solve(uuid) to service_role;
