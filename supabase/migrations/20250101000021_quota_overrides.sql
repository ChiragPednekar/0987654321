-- ============================================================================
-- CaseCode — annual fair-use quota
-- ============================================================================
-- RATE_LIMIT in the application caps five evaluations a minute and nothing
-- else, which permits 7,200 a day — roughly Rs 19,00,000 of model spend from a
-- single account in a year. Behind a fixed-price campus licence that is not a
-- limit, it is an unbounded liability.
--
-- Per-licence overrides are nullable: null means "use the application default",
-- so an existing licence keeps whatever constants.ts says and only a college
-- that negotiated something different carries its own numbers. That makes a
-- larger allowance a contract term rather than a deploy.
--
-- Applied to production as `quota_overrides` on 2026-08-25.
-- ============================================================================

alter table public.institutions
  add column if not exists grading_quota   integer check (grading_quota   is null or grading_quota   >= 0),
  add column if not exists interview_quota integer check (interview_quota is null or interview_quota >= 0);

grant select (grading_quota, interview_quota) on public.institutions to authenticated;

/**
 * The quota that applies to one user, and what they have already spent.
 *
 * One round trip rather than four. Returns the effective limits (licence
 * override, else the caller-supplied defaults) alongside a rolling-window
 * count, so the route can decide without a second query.
 *
 * Defaults arrive as arguments instead of being hardcoded: constants.ts
 * documents the cost arithmetic behind them, and two copies of that number
 * drifting apart is exactly the bug this is meant to prevent.
 */
create or replace function public.quota_status(
  p_user               uuid,
  p_window_days        integer,
  p_default_gradings   integer,
  p_default_interviews integer
)
returns table (
  is_pro          boolean,
  grading_limit   integer,
  interview_limit integer,
  gradings_used   bigint,
  interviews_used bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with pro as (
    select public.has_pro(p_user) as ok
  ),
  -- Best override across any in-date licence the user belongs to. A student on
  -- two licences gets the more generous of them rather than an arbitrary one.
  override as (
    select max(i.grading_quota) as g, max(i.interview_quota) as v
    from public.institution_members m
    join public.institutions i on i.id = m.institution_id
    where m.user_id = p_user
      and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
      and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
  )
  select
    pro.ok,
    coalesce(override.g, p_default_gradings),
    coalesce(override.v, p_default_interviews),
    (select count(*) from public.scores s
      where s.user_id = p_user
        and s.evaluated_at > now() - make_interval(days => p_window_days)),
    (select count(*) from public.chat_sessions c
      where c.user_id = p_user
        and c.created_at > now() - make_interval(days => p_window_days))
  from pro, override;
$$;

revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, anon;
grant execute on function public.quota_status(uuid, integer, integer, integer)
  to authenticated;
