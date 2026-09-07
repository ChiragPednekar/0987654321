-- ============================================================================
-- CaseCode — privacy preferences that actually apply
-- ============================================================================
-- The settings page offers "Privacy & Public Profile", promising control over
-- "how your rank, university, and performance appear to peers and recruiters",
-- with three toggles and a "Privacy preferences updated." confirmation.
--
-- All three wrote to localStorage and nothing else. Switching "Show on
-- leaderboard" off produced the success message and left the user on the
-- leaderboard — name, score and rank — for every visitor including recruiters.
-- The preference did not reach the server, so no query could honour it, and it
-- did not follow the user to another browser or device.
--
-- A privacy control that does not change what anyone else can see is not a
-- privacy control. These become real columns, and the reads that expose a user
-- honour them.
--
-- Defaults preserve today's behaviour: everyone is currently visible, so
-- defaulting to true changes nothing for existing accounts and the toggles
-- start where the interface already claimed they were.
-- ============================================================================

alter table public.users
  -- Appear on the global and campus leaderboards at all.
  add column if not exists show_on_leaderboard boolean not null default true,
  -- Let classmates in a shared batch see solved counts and averages.
  add column if not exists share_history_with_cohort boolean not null default true,
  -- Show university alongside the name in public surfaces.
  add column if not exists show_college_affiliation boolean not null default true;

-- Readable by signed-in users so the settings page can render the real state,
-- and so a page can tell whether to show someone's university. Writable only
-- through the route, which checks the caller owns the row —
-- 20250101000004 governs which columns `authenticated` may update, and these
-- are deliberately not among them.
grant select (show_on_leaderboard, share_history_with_cohort, show_college_affiliation)
  on public.users to anon, authenticated;

create index if not exists users_leaderboard_optout_idx
  on public.users (show_on_leaderboard) where not show_on_leaderboard;

/**
 * refresh_leaderboards(), honouring the opt-out.
 *
 * Supersedes 20250101000027. Someone who has opted out is absent from all three
 * boards rather than merely hidden by the page that renders them — a board is
 * read through several surfaces (global, campus, the recruiter view), and a
 * filter applied in one of them is a filter missing from the others.
 *
 * Ranks are computed after the exclusion, so the visible ordering has no gaps.
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
    where u.deactivated_at is null
      and u.show_on_leaderboard
    group by u.id
  ) t;

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
    join public.users u on u.id = s.user_id
    where s.evaluated_at >= v_week_start
      and s.evaluated_at < v_week_end + 1
      and u.deactivated_at is null
      and u.show_on_leaderboard
    group by s.user_id
  ) t;

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
    join public.users u on u.id = s.user_id
    where s.evaluated_at >= v_month_start
      and s.evaluated_at < v_month_end + 1
      and u.deactivated_at is null
      and u.show_on_leaderboard
    group by s.user_id
  ) t;
end;
$$;

revoke execute on function public.refresh_leaderboards() from public, anon, authenticated;

select public.refresh_leaderboards();
