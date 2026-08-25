-- ============================================================================
-- CaseCode — institutions (campus licences) and the placement-cell view
-- ============================================================================
-- A college buys seats, not subscriptions. This is the layer above classrooms:
-- one institution, many cohorts, one placement cell that needs to see how the
-- whole batch is doing.
--
-- Three things follow from that and are worth stating up front:
--
--   1. Membership is by email domain. A student signing up with an address at
--      @example.ac.in joins automatically — nobody is issuing a thousand join
--      codes, and the placement cell should not be doing data entry.
--   2. The licence, not the user row, grants Pro. Individual `users.plan`
--      still works for retail buyers; institutional access is derived from an
--      in-date licence so it lapses on its own when the contract ends.
--   3. Staff read aggregate performance for their own institution only. That
--      is genuinely other people's data, so it is fenced by policy and the
--      dashboard reads it through the service role after an explicit check.
-- ============================================================================

do $$ begin
  create type public.institution_role as enum ('owner', 'staff', 'student');
exception when duplicate_object then null; end $$;

create table if not exists public.institutions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) between 2 and 160),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  -- Bare domain, no '@'. Null means invite-only; unique so one domain cannot
  -- silently enrol students into two institutions.
  email_domain      text unique check (email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  seats_licensed    integer not null default 0 check (seats_licensed >= 0),
  licence_starts_on date,
  licence_ends_on   date,
  -- Whether an in-date licence confers Pro on its members.
  grants_pro        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (licence_ends_on is null or licence_starts_on is null
         or licence_ends_on >= licence_starts_on)
);
create index if not exists institutions_domain_idx on public.institutions(email_domain);
alter table public.institutions enable row level security;

create table if not exists public.institution_members (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  role           public.institution_role not null default 'student',
  joined_at      timestamptz not null default now(),
  primary key (institution_id, user_id)
);
create index if not exists institution_members_user_idx
  on public.institution_members(user_id);
alter table public.institution_members enable row level security;

-- ------------------------------------------------------------- helpers ----
-- SECURITY DEFINER so the policies below can test membership without reading
-- the very table the policy guards.

create or replace function public.institution_role_of(p_institution uuid)
returns public.institution_role
language sql stable security definer set search_path = public, pg_temp as $$
  select m.role from public.institution_members m
  where m.institution_id = p_institution and m.user_id = auth.uid();
$$;
grant execute on function public.institution_role_of(uuid) to authenticated;

create or replace function public.is_institution_staff(p_institution uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.institution_role_of(p_institution) in ('owner', 'staff');
$$;
grant execute on function public.is_institution_staff(uuid) to authenticated;

/**
 * Does this user have Pro right now, from any source?
 *
 * Retail `users.plan` OR an in-date institutional licence. Derived rather than
 * stored so a licence expiring needs no cron job and no backfill — the day
 * after licence_ends_on, this returns false on its own.
 */
create or replace function public.has_pro(p_user uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select
    coalesce((select u.plan = 'pro' or u.role = 'admin'
              from public.users u where u.id = p_user), false)
    or exists (
      select 1
      from public.institution_members m
      join public.institutions i on i.id = m.institution_id
      where m.user_id = p_user
        and i.grants_pro
        and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
        and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
    );
$$;
grant execute on function public.has_pro(uuid) to authenticated;

-- ------------------------------------------------------------ policies ----

drop policy if exists "members read their institution" on public.institutions;
create policy "members read their institution" on public.institutions
  for select using (public.institution_role_of(id) is not null);

drop policy if exists "staff read the roster" on public.institution_members;
create policy "staff read the roster" on public.institution_members
  for select using (
    -- Staff see everyone; a student sees only their own row, so the roster is
    -- not a directory of every classmate.
    public.is_institution_staff(institution_id) or user_id = auth.uid()
  );

grant select on public.institutions        to authenticated;
grant select on public.institution_members to authenticated;
-- Everything that changes a licence or a roster runs server-side. Seat counts
-- are contractual, so no client should be able to move them.
revoke insert, update, delete on public.institutions        from anon, authenticated;
revoke insert, update, delete on public.institution_members from anon, authenticated;

-- ------------------------------------------------- domain auto-enrolment ---
-- Extends the existing signup trigger rather than adding a second one, so the
-- user row and the membership are created in the same transaction.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_inst   public.institutions%rowtype;
  v_used   integer;
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Auto-enrol on email domain, if one matches an in-date licence.
  v_domain := lower(split_part(new.email, '@', 2));

  select * into v_inst
  from public.institutions
  where email_domain = v_domain
    and (licence_ends_on is null or licence_ends_on >= current_date)
  limit 1;

  if found then
    select count(*) into v_used
    from public.institution_members
    where institution_id = v_inst.id;

    -- Seats are what the college paid for. Past the cap the account is still
    -- created — locking a student out of signup entirely would be a worse
    -- failure than an unlicensed seat — but they do not join the institution,
    -- so they get no Pro and do not appear in the placement cell's numbers.
    if v_inst.seats_licensed = 0 or v_used < v_inst.seats_licensed then
      insert into public.institution_members (institution_id, user_id, role)
      values (v_inst.id, new.id, 'student')
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------- dashboard rollup ----
/**
 * Per-student summary for the placement cell.
 *
 * A function rather than a view because it must run as its owner: staff need
 * aggregate performance for students who are not themselves, and no row policy
 * on scores would allow that. The membership check is inside, so being able to
 * execute it is not the same as being able to read any institution.
 */
create or replace function public.institution_roster(p_institution uuid)
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  cases_solved   integer,
  cases_attempted integer,
  ce             integer,
  avg_percentage numeric,
  last_active    timestamptz,
  interviews     bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    u.id,
    u.full_name,
    u.email,
    u.cases_solved,
    u.cases_attempted,
    u.ce,
    (select round(avg(s.percentage), 1) from public.scores s where s.user_id = u.id),
    (select max(s.evaluated_at) from public.scores s where s.user_id = u.id),
    (select count(*) from public.chat_sessions c where c.user_id = u.id)
  from public.institution_members m
  join public.users u on u.id = m.user_id
  where m.institution_id = p_institution
    and m.role = 'student'
    and public.is_institution_staff(p_institution)
  order by u.cases_solved desc, u.ce desc;
$$;
revoke execute on function public.institution_roster(uuid) from anon;
grant execute on function public.institution_roster(uuid) to authenticated;

/** Cohort performance by domain — where the batch is actually weak. */
create or replace function public.institution_domain_breakdown(p_institution uuid)
returns table (
  domain         public.domain,
  students       bigint,
  cases_solved   bigint,
  avg_percentage numeric
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    dp.domain,
    count(distinct dp.user_id),
    sum(dp.cases_solved),
    round(avg(dp.avg_percentage), 1)
  from public.institution_members m
  join public.domain_progress dp on dp.user_id = m.user_id
  where m.institution_id = p_institution
    and public.is_institution_staff(p_institution)
  group by dp.domain
  order by avg(dp.avg_percentage) asc nulls last;
$$;
revoke execute on function public.institution_domain_breakdown(uuid) from anon;
grant execute on function public.institution_domain_breakdown(uuid) to authenticated;
