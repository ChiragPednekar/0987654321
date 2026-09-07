-- ============================================================================
-- CaseCode — join codes, publicly shared teaching, and a full leaderboard
-- ============================================================================
-- Four changes, plus one repair that production still needs.
--
-- 0. THE REPAIR (first, because the library is broken without it)
--
-- /cases filters on cases.visibility, which needs SELECT on that column.
-- 20250101000025 granted it; this database never received that migration, so
-- every library read came back 42501 and the catalogue rendered 0 of 510 cases.
-- The application now falls back to an unfiltered query, but that leans
-- entirely on the row policy — which this database also predates, so a private
-- teacher question would show in the public library until both land here.
--
-- Only the grant and the two policies are replayed. The rest of migration 25
-- redefines admin_user_list, quota_status and has_pro, all of which
-- 20250101000026 has since superseded; replaying those would undo account
-- deactivation.
--
-- 1. GROUP JOIN CODES
--
-- A private group had no way in. `is_private` hid it from everyone who was not
-- already a member, and nothing issued an invitation — so a private group was
-- permanently sealed at one member. Private groups now carry a code the owner
-- can pass on. Public groups need none: they are listed for everyone and joined
-- with a click.
--
-- 2. PUBLICLY SHARED TEACHING
--
-- A teacher's assignment reaches the batch it was set for. Some material is
-- worth putting in front of everyone — a worked example, a revision set — and
-- there was no way to say so. `is_public` marks an assignment as visible
-- platform-wide, which is a *read* grant only: it never enrols anyone, never
-- collects submissions from outside the batch, and never exposes another
-- student's marks.
--
-- 3. THE LEADERBOARD INCLUDES EVERYONE
--
-- refresh_leaderboards() built the all-time board from user_case_best, so an
-- account that had not yet solved anything did not exist on it. With one solver
-- on the platform the board had one row and looked broken. Everyone appears
-- now, scored on what they have actually done, which also makes "you are 40th
-- of 300" a real sentence rather than a hidden one.
-- ============================================================================

-- ------------------------------------------------- 0. the pending repair ----

grant select (visibility, owner_classroom_id) on public.cases to anon, authenticated;

drop policy if exists "published cases are public" on public.cases;
create policy "published cases are public"
  on public.cases for select
  using (
    public.is_admin()
    or (
      is_published
      and (
        visibility = 'platform'
        or created_by = auth.uid()
        or (
          owner_classroom_id is not null
          and public.is_classroom_member(owner_classroom_id)
        )
      )
    )
  );

-- Rubrics follow their case, or a private question's criteria leak.
drop policy if exists "rubrics readable for published cases" on public.rubrics;
create policy "rubrics readable for published cases"
  on public.rubrics for select
  using (
    exists (
      select 1 from public.cases c
      where c.id = rubrics.case_id
        and (
          public.is_admin()
          or (
            c.is_published
            and (
              c.visibility = 'platform'
              or c.created_by = auth.uid()
              or (
                c.owner_classroom_id is not null
                and public.is_classroom_member(c.owner_classroom_id)
              )
            )
          )
        )
    )
  );

-- ---------------------------------------------------- 1. group join codes ----

alter table public.groups
  add column if not exists join_code text;

-- Unique only where present: public groups carry no code, and a partial index
-- lets any number of them hold NULL.
create unique index if not exists groups_join_code_key
  on public.groups (join_code) where join_code is not null;

grant select (join_code) on public.groups to authenticated;

/**
 * Issues a code for every private group that has none.
 *
 * Same alphabet as classroom join codes — no O/0 or I/1, because people read
 * these aloud. Loops until the insert sticks rather than pre-checking; at this
 * table size a collision is vanishingly rare and the unique index is the
 * authority either way.
 */
create or replace function public.ensure_group_join_code(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_existing text;
begin
  select join_code into v_existing from public.groups where id = p_group;
  if v_existing is not null then
    return v_existing;
  end if;

  for _ in 1..10 loop
    v_code := '';
    for _ in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    begin
      update public.groups set join_code = v_code where id = p_group;
      return v_code;
    exception when unique_violation then
      -- try again
    end;
  end loop;

  raise exception 'could not allocate a join code for group %', p_group;
end;
$$;

revoke execute on function public.ensure_group_join_code(uuid)
  from public, anon, authenticated;

-- Backfill: every existing private group gets one, so none stays sealed.
do $$
declare g uuid;
begin
  for g in select id from public.groups where is_private and join_code is null loop
    perform public.ensure_group_join_code(g);
  end loop;
end;
$$;

-- ---------------------------------------------- 2. publicly shared teaching --

alter table public.classroom_assignments
  add column if not exists is_public boolean not null default false;

create index if not exists classroom_assignments_public_idx
  on public.classroom_assignments (is_public, created_at desc) where is_public;

grant select (is_public) on public.classroom_assignments to anon, authenticated;

-- A public assignment is readable by anyone signed in. Deliberately a read
-- grant and nothing more: submissions still attach only for members of the
-- batch (see attach_submission_to_assignments), so nobody outside it can hand
-- work in or appear in its review queue.
drop policy if exists "members read published assignments" on public.classroom_assignments;
create policy "members read published assignments"
  on public.classroom_assignments
  for select using (
    public.is_classroom_teacher(classroom_id)
    or (is_published and public.is_classroom_member(classroom_id))
    or (is_published and is_public)
  );

-- The case behind a public assignment has to be readable too, or the listing
-- shows a title nobody can open.
drop policy if exists "published cases are public" on public.cases;
create policy "published cases are public"
  on public.cases for select
  using (
    public.is_admin()
    or (
      is_published
      and (
        visibility = 'platform'
        or created_by = auth.uid()
        or (
          owner_classroom_id is not null
          and public.is_classroom_member(owner_classroom_id)
        )
        or exists (
          select 1
          from public.classroom_assignments a
          where a.case_id = cases.id
            and a.is_published
            and a.is_public
        )
      )
    )
  );

-- ------------------------------------------- 3. leaderboard includes everyone --
/**
 * refresh_leaderboards(), all-time board built from `users` rather than from
 * user_case_best.
 *
 * Supersedes 20250101000001. The weekly and monthly boards are unchanged: those
 * are "what happened this week", and listing people who did nothing would be
 * noise. The all-time board is a standing, and everyone has one — including
 * zero.
 */
create or replace function public.refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today       date := (now() at time zone 'utc')::date;
  v_week_start  date := date_trunc('week', v_today)::date;
  v_week_end    date := (date_trunc('week', v_today) + interval '6 days')::date;
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end   date := (date_trunc('month', v_today) + interval '1 month'
                         - interval '1 day')::date;
begin
  delete from public.leaderboards where period = 'all_time';

  insert into public.leaderboards
    (user_id, period, period_start, period_end, total_points, cases_solved,
     accuracy, rank)
  select
    t.user_id, 'all_time', 'epoch'::date, '9999-12-31'::date,
    t.total_points, t.cases_solved, t.accuracy,
    rank() over (order by t.total_points desc, t.accuracy desc, t.cases_solved desc)
  from (
    select
      u.id as user_id,
      coalesce(sum(ucb.total_score), 0)::integer as total_points,
      count(ucb.case_id) filter (where ucb.percentage >= 60)::integer as cases_solved,
      round(coalesce(avg(ucb.percentage), 0), 2) as accuracy
    from public.users u
    -- Left join: an account that has solved nothing still has a standing.
    left join public.user_case_best ucb on ucb.user_id = u.id
    -- A closed account is not a competitor.
    where u.deactivated_at is null
    group by u.id
  ) t;

  -- ---- weekly -----------------------------------------------------------
  delete from public.leaderboards
   where period = 'weekly' and period_start = v_week_start;

  insert into public.leaderboards
    (user_id, period, period_start, period_end, total_points, cases_solved,
     accuracy, rank)
  select
    t.user_id, 'weekly', v_week_start, v_week_end,
    t.total_points, t.cases_solved, t.accuracy,
    rank() over (order by t.total_points desc, t.accuracy desc, t.cases_solved desc)
  from (
    select
      s.user_id,
      coalesce(sum(s.total_score), 0)::integer as total_points,
      count(distinct s.case_id) filter (where s.percentage >= 60)::integer
        as cases_solved,
      round(coalesce(avg(s.percentage), 0), 2) as accuracy
    from public.scores s
    where s.evaluated_at >= v_week_start
      and s.evaluated_at < v_week_end + 1
    group by s.user_id
  ) t;

  -- ---- monthly ----------------------------------------------------------
  delete from public.leaderboards
   where period = 'monthly' and period_start = v_month_start;

  insert into public.leaderboards
    (user_id, period, period_start, period_end, total_points, cases_solved,
     accuracy, rank)
  select
    t.user_id, 'monthly', v_month_start, v_month_end,
    t.total_points, t.cases_solved, t.accuracy,
    rank() over (order by t.total_points desc, t.accuracy desc, t.cases_solved desc)
  from (
    select
      s.user_id,
      coalesce(sum(s.total_score), 0)::integer as total_points,
      count(distinct s.case_id) filter (where s.percentage >= 60)::integer
        as cases_solved,
      round(coalesce(avg(s.percentage), 0), 2) as accuracy
    from public.scores s
    where s.evaluated_at >= v_month_start
      and s.evaluated_at < v_month_end + 1
    group by s.user_id
  ) t;
end;
$$;

revoke execute on function public.refresh_leaderboards() from public, anon, authenticated;

-- Rebuild immediately so the board is right without waiting for the cron.
select public.refresh_leaderboards();
