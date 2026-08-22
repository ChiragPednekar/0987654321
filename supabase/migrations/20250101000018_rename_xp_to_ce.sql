-- ============================================================================
-- CaseCode — XP renamed to CE (Case Experience)
-- ============================================================================
-- Spec §17. A branding change, not a redesign: the curve, the award amounts and
-- the level thresholds are all identical, so nobody's standing moves. Only the
-- name changes.
--
-- Renaming the columns alone would not have been enough. PL/pgSQL resolves
-- column references at execution, so award_badges() and after_score_insert()
-- would have kept compiling and then failed the first time a real submission
-- was graded — the worst possible place to find out. Both are recreated here
-- from the same source, with identifiers rewritten mechanically rather than by
-- hand.
--
-- The old helper names are dropped rather than left as aliases: two spellings
-- of the same curve is how they drift apart.
-- ============================================================================

alter table public.users         rename column xp        to ce;
alter table public.badges        rename column xp_reward to ce_reward;
alter table public.user_activity rename column xp_delta  to ce_delta;

alter index if exists users_xp_idx rename to users_ce_idx;

create or replace function public.level_for_ce(p_ce integer)
returns integer
language sql
immutable
as $$
  select greatest(1, floor(sqrt(greatest(p_ce, 0)::numeric / 50))::integer + 1);
$$;

create or replace function public.ce_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select (50 * power(greatest(p_level, 1) - 1, 2))::integer;
$$;

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

      when 'total_ce' then
        v_ok := v_user.ce >= (v_badge.criteria ->> 'threshold')::integer;

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
           set ce = ce + v_badge.ce_reward
         where id = p_user_id;

        insert into public.user_activity (user_id, type, metadata, ce_delta)
        values (
          p_user_id,
          'badge_earned',
          jsonb_build_object('badge_slug', v_badge.slug, 'badge_name', v_badge.name),
          v_badge.ce_reward
        );
      end if;
    end if;
  end loop;

  -- Re-derive level after any CE awards.
  update public.users
     set level = public.level_for_ce(ce)
   where id = p_user_id;

  return v_earned;
end;
$$;

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
  v_ce_gain       integer;
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

  -- ---- CE ---------------------------------------------------------------
  -- Base CE scales with difficulty; only the first clear pays full price,
  -- later improvements pay a small retry bonus.
  v_ce_gain := case v_difficulty
                 when 'easy' then 50
                 when 'medium' then 100
                 when 'hard' then 175
                 else 50
               end;
  v_ce_gain := round(v_ce_gain * (new.percentage / 100.0))::integer;

  if v_already_solved then
    v_ce_gain := round(v_ce_gain * 0.2)::integer;
  elsif not v_is_pass then
    v_ce_gain := round(v_ce_gain * 0.5)::integer;
  end if;

  select level, last_solved_on into v_old_level, v_last_solved
  from public.users where id = new.user_id;

  -- ---- user aggregates + streak ----------------------------------------
  update public.users u
     set ce = u.ce + v_ce_gain,
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
         level = public.level_for_ce(ce)
   where id = new.user_id;

  select level into v_new_level from public.users where id = new.user_id;

  -- ---- activity feed ----------------------------------------------------
  if v_is_pass and not v_already_solved then
    insert into public.user_activity (user_id, type, case_id, metadata, ce_delta)
    values (
      new.user_id, 'case_solved', new.case_id,
      jsonb_build_object(
        'score', new.total_score,
        'max_score', new.max_score,
        'percentage', new.percentage
      ),
      v_ce_gain
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
drop function if exists public.level_for_xp(integer);
drop function if exists public.xp_for_level(integer);

alter function public.level_for_ce(integer) set search_path = public, pg_temp;
alter function public.ce_for_level(integer) set search_path = public, pg_temp;
grant execute on function public.level_for_ce(integer) to authenticated, anon;
grant execute on function public.ce_for_level(integer) to authenticated, anon;

-- The read grant enumerates columns by name, so it has to follow the rename.
grant select (ce) on public.users to anon, authenticated;

-- Badge rules keyed on the old string, and the two badges named after it.
update public.badges
   set criteria = jsonb_set(criteria, '{type}', '"total_ce"')
 where criteria ->> 'type' = 'total_xp';

update public.badges set slug = 'ce-5000',  description = 'Earned 5,000 CE.'  where slug = 'xp-5000';
update public.badges set slug = 'ce-25000', description = 'Earned 25,000 CE.' where slug = 'xp-25000';
