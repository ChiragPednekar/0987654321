-- ============================================================================
-- CaseCode — the quota counts every AI feature it gates
-- ============================================================================
-- quota_status() decides how many gradings and interviews an account has left,
-- and it counts USE by reading the rows each feature leaves behind: `scores`,
-- `resume_critiques` and `deck_reviews` for gradings; the chat, PI,
-- negotiation and sales session tables for interviews.
--
-- Three AI features were gated on that quota without ever appearing in it:
-- competition entries, simulation debriefs and group discussions. Each route
-- checked "gradings left > 0" (or interviews) before calling the model, and
-- each call left nothing quota_status reads. So the check passed forever:
-- any account with one grading to spare could resubmit a competition entry or
-- re-run a debrief without limit, each time a paid model call.
--
-- WHY A TAG ON usage_events, NOT ANOTHER TABLE IN THE SUM
--
-- All three already write a usage_events row per model call, so the facts are
-- there. They cannot simply be counted as "operation = grading", because an
-- ordinary case grading also writes one — and is already counted through
-- `scores`. Counting both would charge every case twice. The tag says which
-- usage rows stand for a feature quota_status has no other way to see.
--
-- It is counted per model call, not per row of the feature's own table, on
-- purpose: a competition entry is upserted, so its table holds one row however
-- many times it is regraded. The regrades are the spend.
-- ============================================================================

alter table public.usage_events
  add column if not exists feature text;

-- A typo in a route would otherwise make that feature silently uncounted —
-- the bug this migration exists to fix. A failed insert at least logs.
alter table public.usage_events
  drop constraint if exists usage_events_feature_known;
alter table public.usage_events
  add constraint usage_events_feature_known
  check (feature is null or feature in (
    'competition_entry',
    'simulation_debrief',
    'group_discussion'
  ));

comment on column public.usage_events.feature is
  'Set only for AI features that leave no row quota_status() can count. Null for the rest, which are counted from their own tables.';

create index if not exists usage_events_quota
  on public.usage_events (user_id, feature, created_at)
  where feature is not null;

-- Same signature and return shape, so every caller is unchanged.
create or replace function public.quota_status(
  p_user uuid,
  p_window_days integer,
  p_default_gradings integer,
  p_default_interviews integer
)
returns table(
  is_pro boolean,
  grading_limit integer,
  interview_limit integer,
  gradings_used bigint,
  interviews_used bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with deactivated as (
    select exists (
      select 1 from public.users u
      where u.id = p_user and u.deactivated_at is not null
    ) as off
  ),
  pro as (
    select public.has_pro(p_user) as ok
  ),
  override as (
    select max(i.grading_quota) as g, max(i.interview_quota) as v
    from public.institution_members m
    join public.institutions i on i.id = m.institution_id
    where m.user_id = p_user
      and not i.is_suspended
      and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
      and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
  ),
  tagged as (
    select
      count(*) filter (where e.feature in ('competition_entry', 'simulation_debrief')) as gradings,
      count(*) filter (where e.feature = 'group_discussion') as interviews
    from public.usage_events e
    where e.user_id = p_user
      and e.feature is not null
      and e.created_at > now() - make_interval(days => p_window_days)
  )
  select
    pro.ok,
    case when deactivated.off then 0
         else coalesce(override.g, p_default_gradings) end,
    case when deactivated.off then 0
         else coalesce(override.v, p_default_interviews) end,
    (select count(*) from public.scores s
      where s.user_id = p_user
        and s.evaluated_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.resume_critiques r
      where r.user_id = p_user
        and r.created_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.deck_reviews d
      where d.user_id = p_user
        and d.created_at > now() - make_interval(days => p_window_days))
    + tagged.gradings,
    (select count(*) from public.chat_sessions c
      where c.user_id = p_user
        and c.created_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.pi_sessions p
      where p.user_id = p_user
        and p.started_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.negotiation_sessions n
      where n.user_id = p_user
        and n.started_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.sales_sessions x
      where x.user_id = p_user
        and x.started_at > now() - make_interval(days => p_window_days))
    + tagged.interviews
  from pro, override, deactivated, tagged;
$function$;
