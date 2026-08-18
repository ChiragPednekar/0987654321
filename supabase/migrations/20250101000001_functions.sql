-- ============================================================================
-- CaseCode — functions & triggers
-- ============================================================================
-- All the write-side business logic lives here so that a client with only an
-- anon key can never desync a counter, inflate XP, or hand itself a badge.
-- ============================================================================

-- --------------------------------------------------------- housekeeping ----

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger cases_set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

create trigger rubrics_set_updated_at
  before update on public.rubrics
  for each row execute function public.set_updated_at();

create trigger contests_set_updated_at
  before update on public.contests
  for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- auth bridge ----

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the mirrored email in sync when a user changes it via Supabase Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ------------------------------------------------------------- authz ------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ------------------------------------------------------- gamification ------

-- Level curve: level 1 at 0 XP, then every level costs 100 * level XP more.
-- level(xp) = floor(sqrt(xp / 50)) + 1  → L2 @ 50, L3 @ 200, L4 @ 450, L5 @ 800.
create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 50))::integer + 1);
$$;

create or replace function public.xp_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select (50 * power(greatest(p_level, 1) - 1, 2))::integer;
$$;

-- Evaluate every badge rule against a user's current state and grant any that
-- are newly satisfied. Idempotent — safe to call as often as you like.
create or replace function public.award_badges(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge   record;
  v_earned  integer := 0;
  v_ok      boolean;
  v_user    public.users%rowtype;
begin
  select * into v_user from public.users where id = p_user_id;
  if not found then
    return 0;
  end if;

  for v_badge in
    select b.*
    from public.badges b
    where not exists (
      select 1 from public.achievements a
      where a.user_id = p_user_id and a.badge_id = b.id
    )
  loop
    v_ok := false;

    case v_badge.criteria ->> 'type'

      when 'cases_solved' then
        v_ok := v_user.cases_solved >= (v_badge.criteria ->> 'threshold')::integer;

      when 'domain_cases_solved' then
        select coalesce(count(distinct ucb.case_id), 0)
                 >= (v_badge.criteria ->> 'threshold')::integer
          into v_ok
        from public.user_case_best ucb
        join public.cases c on c.id = ucb.case_id
        where ucb.user_id = p_user_id
          and c.domain = (v_badge.criteria ->> 'domain')::public.domain
          and ucb.percentage >= 60;

      when 'difficulty_cases_solved' then
        select coalesce(count(distinct ucb.case_id), 0)
                 >= (v_badge.criteria ->> 'threshold')::integer
          into v_ok
        from public.user_case_best ucb
        join public.cases c on c.id = ucb.case_id
        where ucb.user_id = p_user_id
          and c.difficulty = (v_badge.criteria ->> 'difficulty')::public.difficulty
          and ucb.percentage >= 60;

      when 'streak' then
        v_ok := v_user.longest_streak >= (v_badge.criteria ->> 'threshold')::integer;

      when 'total_xp' then
        v_ok := v_user.xp >= (v_badge.criteria ->> 'threshold')::integer;

      when 'perfect_score' then
        select exists (
          select 1 from public.scores
          where user_id = p_user_id and percentage >= 95
        ) into v_ok;

      when 'contest_entries' then
        select count(*) >= (v_badge.criteria ->> 'threshold')::integer
          into v_ok
        from public.contest_submissions
        where user_id = p_user_id and submitted_at is not null;

      when 'contest_podium' then
        select exists (
          select 1 from public.contest_submissions
          where user_id = p_user_id and rank is not null and rank <= 3
        ) into v_ok;

      else
        v_ok := false;
    end case;

    if v_ok then
      insert into public.achievements (user_id, badge_id)
      values (p_user_id, v_badge.id)
      on conflict do nothing;

      if found then
        v_earned := v_earned + 1;

        update public.users
           set xp = xp + v_badge.xp_reward
         where id = p_user_id;

        insert into public.user_activity (user_id, type, metadata, xp_delta)
        values (
          p_user_id,
          'badge_earned',
          jsonb_build_object('badge_slug', v_badge.slug, 'badge_name', v_badge.name),
          v_badge.xp_reward
        );
      end if;
    end if;
  end loop;

  -- Re-derive level after any XP awards.
  update public.users
     set level = public.level_for_xp(xp)
   where id = p_user_id;

  return v_earned;
end;
$$;

-- ------------------------------------------- submission / score effects ----

-- Attempt counter + per-case submission counter.
create or replace function public.on_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prior integer;
begin
  select count(*) into v_prior
  from public.submissions
  where user_id = new.user_id and case_id = new.case_id and id <> new.id;

  new.attempt_number := v_prior + 1;
  return new;
end;
$$;

create trigger submissions_set_attempt
  before insert on public.submissions
  for each row execute function public.on_submission_insert();

create or replace function public.after_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cases
     set total_submissions = total_submissions + 1
   where id = new.case_id;

  if new.attempt_number = 1 then
    update public.users
       set cases_attempted = cases_attempted + 1
     where id = new.user_id;

    insert into public.user_activity (user_id, type, case_id)
    values (new.user_id, 'case_attempted', new.case_id);
  end if;

  return new;
end;
$$;

create trigger submissions_after_insert
  after insert on public.submissions
  for each row execute function public.after_submission_insert();

-- The big one: when an evaluation lands, fan out to every derived counter.
create or replace function public.after_score_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass_score    integer;
  v_is_pass       boolean;
  v_already_solved boolean;
  v_xp_gain       integer;
  v_difficulty    public.difficulty;
  v_today         date := (now() at time zone 'utc')::date;
  v_last_solved   date;
  v_old_level     integer;
  v_new_level     integer;
begin
  select coalesce(r.pass_score, 60), c.difficulty
    into v_pass_score, v_difficulty
  from public.cases c
  left join public.rubrics r on r.case_id = c.id
  where c.id = new.case_id;

  v_is_pass := new.percentage >= coalesce(v_pass_score, 60);

  -- Had this user already cleared this case before *this* score row?
  select exists (
    select 1 from public.scores s
    where s.user_id = new.user_id
      and s.case_id = new.case_id
      and s.id <> new.id
      and s.percentage >= coalesce(v_pass_score, 60)
  ) into v_already_solved;

  -- ---- case aggregates -------------------------------------------------
  update public.cases c
     set total_solved = c.total_solved
                        + case when v_is_pass and not v_already_solved then 1 else 0 end,
         avg_score = (
           select round(coalesce(avg(s.percentage), 0), 2)
           from public.scores s where s.case_id = c.id
         )
   where c.id = new.case_id;

  -- ---- XP ---------------------------------------------------------------
  -- Base XP scales with difficulty; only the first clear pays full price,
  -- later improvements pay a small retry bonus.
  v_xp_gain := case v_difficulty
                 when 'easy' then 50
                 when 'medium' then 100
                 when 'hard' then 175
                 else 50
               end;
  v_xp_gain := round(v_xp_gain * (new.percentage / 100.0))::integer;

  if v_already_solved then
    v_xp_gain := round(v_xp_gain * 0.2)::integer;
  elsif not v_is_pass then
    v_xp_gain := round(v_xp_gain * 0.5)::integer;
  end if;

  select level, last_solved_on into v_old_level, v_last_solved
  from public.users where id = new.user_id;

  -- ---- user aggregates + streak ----------------------------------------
  update public.users u
     set xp = u.xp + v_xp_gain,
         total_score = u.total_score
                       + case when v_is_pass and not v_already_solved
                              then new.total_score else 0 end,
         cases_solved = u.cases_solved
                        + case when v_is_pass and not v_already_solved then 1 else 0 end,
         current_streak = case
           when not v_is_pass then u.current_streak
           when u.last_solved_on = v_today then u.current_streak
           when u.last_solved_on = v_today - 1 then u.current_streak + 1
           else 1
         end,
         last_solved_on = case when v_is_pass then v_today else u.last_solved_on end
   where u.id = new.user_id;

  update public.users
     set longest_streak = greatest(longest_streak, current_streak),
         level = public.level_for_xp(xp)
   where id = new.user_id;

  select level into v_new_level from public.users where id = new.user_id;

  -- ---- activity feed ----------------------------------------------------
  if v_is_pass and not v_already_solved then
    insert into public.user_activity (user_id, type, case_id, metadata, xp_delta)
    values (
      new.user_id, 'case_solved', new.case_id,
      jsonb_build_object(
        'score', new.total_score,
        'max_score', new.max_score,
        'percentage', new.percentage
      ),
      v_xp_gain
    );
  end if;

  if v_new_level > v_old_level then
    insert into public.user_activity (user_id, type, metadata)
    values (new.user_id, 'level_up', jsonb_build_object('level', v_new_level));
  end if;

  -- ---- learning path progress ------------------------------------------
  perform public.recalc_path_progress(new.user_id);

  -- ---- badges -----------------------------------------------------------
  perform public.award_badges(new.user_id);

  return new;
end;
$$;

create trigger scores_after_insert
  after insert on public.scores
  for each row execute function public.after_score_insert();

-- --------------------------------------------------- learning path calc ----

-- A step is complete when the user's best score on that case meets the step's
-- unlock_threshold. current_step is the first incomplete step.
create or replace function public.recalc_path_progress(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path record;
begin
  for v_path in select id from public.learning_paths where is_published loop
    with steps as (
      select
        s.step_order,
        coalesce(ucb.percentage, -1) >= s.unlock_threshold as done
      from public.learning_path_steps s
      left join public.user_case_best ucb
        on ucb.case_id = s.case_id and ucb.user_id = p_user_id
      where s.path_id = v_path.id
    ),
    agg as (
      select
        count(*) filter (where done)                     as completed,
        count(*)                                         as total,
        coalesce(min(step_order) filter (where not done),
                 (select max(step_order) + 1 from steps)) as next_step
      from steps
    )
    insert into public.user_path_progress
      (user_id, path_id, completed_steps, current_step, completed_at, updated_at)
    select
      p_user_id,
      v_path.id,
      agg.completed,
      least(agg.next_step, greatest(agg.total, 1)),
      case when agg.completed = agg.total and agg.total > 0 then now() end,
      now()
    from agg
    where agg.total > 0
    on conflict (user_id, path_id) do update
      set completed_steps = excluded.completed_steps,
          current_step    = excluded.current_step,
          completed_at    = coalesce(user_path_progress.completed_at,
                                     excluded.completed_at),
          updated_at      = now();
  end loop;
end;
$$;

-- ---------------------------------------------------------- vote counts ----

create or replace function public.sync_comment_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment uuid := coalesce(new.comment_id, old.comment_id);
begin
  update public.comments c
     set upvotes = (select count(*) from public.comment_votes v
                    where v.comment_id = c.id)
   where c.id = v_comment;
  return null;
end;
$$;

create trigger comment_votes_sync
  after insert or delete on public.comment_votes
  for each row execute function public.sync_comment_votes();

create or replace function public.sync_submission_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission uuid := coalesce(new.submission_id, old.submission_id);
begin
  update public.submissions s
     set upvotes = (select count(*) from public.submission_votes v
                    where v.submission_id = s.id)
   where s.id = v_submission;
  return null;
end;
$$;

create trigger submission_votes_sync
  after insert or delete on public.submission_votes
  for each row execute function public.sync_submission_votes();

-- --------------------------------------------------------- leaderboards ----

-- Rebuilds all three leaderboard periods. Cheap enough to run on a cron every
-- few minutes; the read path never computes ranks on the fly.
create or replace function public.refresh_leaderboards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today       date := (now() at time zone 'utc')::date;
  v_week_start  date := date_trunc('week', v_today)::date;
  v_week_end    date := (date_trunc('week', v_today) + interval '6 days')::date;
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end   date := (date_trunc('month', v_today) + interval '1 month'
                         - interval '1 day')::date;
begin
  -- ---- all time (based on each user's best score per case) --------------
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
      ucb.user_id,
      coalesce(sum(ucb.total_score), 0)::integer as total_points,
      count(*) filter (where ucb.percentage >= 60)::integer as cases_solved,
      round(coalesce(avg(ucb.percentage), 0), 2) as accuracy
    from public.user_case_best ucb
    group by ucb.user_id
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

-- ------------------------------------------------------------- contests ----

-- Speed bonus decays linearly across the personal timer window.
create or replace function public.compute_speed_bonus(
  p_duration_seconds integer,
  p_limit_minutes    integer,
  p_max_bonus        integer
)
returns integer
language sql
immutable
as $$
  select greatest(
    0,
    round(
      p_max_bonus * (
        1 - least(1.0, greatest(0, p_duration_seconds)::numeric
                       / nullif(p_limit_minutes * 60, 0))
      )
    )::integer
  );
$$;

-- Finalises a contest: pulls each entrant's score, applies the speed bonus and
-- writes ranks. Safe to re-run.
create or replace function public.finalize_contest(p_contest_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contest public.contests%rowtype;
  v_count   integer;
begin
  select * into v_contest from public.contests where id = p_contest_id;
  if not found then
    raise exception 'contest % not found', p_contest_id;
  end if;

  update public.contest_submissions cs
     set base_score  = sc.total_score,
         speed_bonus = public.compute_speed_bonus(
                         cs.duration_seconds,
                         v_contest.duration_minutes,
                         v_contest.max_speed_bonus
                       ),
         final_score = sc.total_score + public.compute_speed_bonus(
                         cs.duration_seconds,
                         v_contest.duration_minutes,
                         v_contest.max_speed_bonus
                       )
    from public.scores sc
   where cs.contest_id = p_contest_id
     and cs.submission_id = sc.submission_id;

  with ranked as (
    select id,
           rank() over (
             order by final_score desc nulls last,
                      duration_seconds asc nulls last
           ) as r
    from public.contest_submissions
    where contest_id = p_contest_id and final_score is not null
  )
  update public.contest_submissions cs
     set rank = ranked.r
    from ranked
   where cs.id = ranked.id;

  select count(*) into v_count
  from public.contest_submissions
  where contest_id = p_contest_id and rank is not null;

  update public.contests set status = 'completed' where id = p_contest_id;

  return v_count;
end;
$$;

-- Moves contests between scheduled → live → grading based on wall clock.
create or replace function public.sync_contest_statuses()
returns void
language sql
security definer
set search_path = public
as $$
  update public.contests
     set status = (case
       when now() < starts_at then 'scheduled'
       when now() between starts_at and ends_at then 'live'
       else 'grading'
     end)::public.contest_status
   where status <> 'completed';
$$;
