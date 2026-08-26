-- ============================================================================
-- CaseCode — account deactivation
-- ============================================================================
-- The admin user list could read but never act. Deleting an account through
-- GoTrue is available but is the wrong tool for almost every case it would be
-- reached for: it cascades away submissions, scores and marks, so removing one
-- abusive account also destroys the record of what it did, and there is no way
-- back from a mistake.
--
-- Deactivation is the reversible version. The row stays, the work stays, and
-- the account simply stops being able to spend money or reach the product:
--
--   * has_pro() returns false, so Pro features close immediately.
--   * quota_status() reports a zero grading allowance, so /api/submissions
--     answers 402 rather than calling a model. That is the property that
--     matters commercially — a deactivated seat cannot run up AI spend.
--
-- Enforced in SQL rather than in a route guard because both of those functions
-- are already the single place every caller asks "may this user do this?", and
-- a check added anywhere else would be one more place to forget.
-- ============================================================================

alter table public.users
  add column if not exists deactivated_at timestamptz,
  -- Free text rather than an enum: the reasons are for a human reading the
  -- audit trail later, and enumerating them now would be guessing.
  add column if not exists deactivated_reason text;

create index if not exists users_deactivated_idx
  on public.users (deactivated_at) where deactivated_at is not null;

-- Readable by signed-in users so the UI can show an account as closed, but
-- writable only by the service role — 20250101000004 already restricts which
-- columns `authenticated` may update, and this is not among them.
grant select (deactivated_at) on public.users to authenticated;

/**
 * has_pro(), with deactivated accounts excluded.
 *
 * Supersedes 20250101000022. Same two routes to Pro — a retail `plan = 'pro'`
 * and an in-date, unsuspended campus licence — with a deactivated account
 * failing both regardless.
 */
create or replace function public.has_pro(p_user uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select
    not exists (
      select 1 from public.users u
      where u.id = p_user and u.deactivated_at is not null
    )
    and (
      coalesce((select u.plan = 'pro' or u.role = 'admin'
                from public.users u where u.id = p_user), false)
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

/**
 * quota_status(), returning a zero allowance for a deactivated account.
 *
 * Supersedes 20250101000025. Zero rather than an error so the caller's existing
 * 402 path handles it — the student sees a clear refusal instead of a 500, and
 * no model call is made either way.
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
  )
  select
    pro.ok,
    case when deactivated.off then 0
         else coalesce(override.g, p_default_gradings) end,
    case when deactivated.off then 0
         else coalesce(override.v, p_default_interviews) end,
    (select count(*) from public.scores s
      where s.user_id = p_user
        and s.evaluated_at > now() - make_interval(days => p_window_days)),
    (select count(*) from public.chat_sessions c
      where c.user_id = p_user
        and c.created_at > now() - make_interval(days => p_window_days))
  from pro, override, deactivated;
$$;

revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, anon;
grant execute on function public.quota_status(uuid, integer, integer, integer)
  to authenticated;

/**
 * admin_user_list(), now reporting account state.
 *
 * Supersedes 20250101000025 — the list is where an admin decides whether to
 * act, so it has to show what has already been done.
 *
 * Dropped first, not replaced. `create or replace` cannot change a function's
 * OUT parameters, and adding `deactivated_at` does exactly that:
 *
 *   ERROR: cannot change return type of existing function
 *   DETAIL: Row type defined by OUT parameters is different.
 *
 * The same rule is what broke assignment_review_queue between 20250101000023
 * and 20250101000024 — worth stating here so the next person changing a
 * returns-table signature does not rediscover it in production.
 */
drop function if exists public.admin_user_list(text, text, integer, integer);
create function public.admin_user_list(
  p_search text    default null,
  p_role   text    default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id             uuid,
  email          text,
  full_name      text,
  role           public.user_role,
  plan           public.plan_tier,
  institution    text,
  cases_solved   integer,
  ce             integer,
  last_active    timestamptz,
  created_at     timestamptz,
  deactivated_at timestamptz,
  total_count    bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with filtered as (
    select
      u.id, u.email::text, u.full_name, u.role, u.plan,
      i.name as institution,
      u.cases_solved, u.ce,
      (select max(s.evaluated_at) from public.scores s where s.user_id = u.id)
        as last_active,
      u.created_at,
      u.deactivated_at
    from public.users u
    left join public.institution_members m on m.user_id = u.id
    left join public.institutions i on i.id = m.institution_id
    where
      (
        p_search is null
        or u.full_name ilike '%' || p_search || '%'
        or u.email::text ilike '%' || p_search || '%'
      )
      and (p_role is null or u.role::text = p_role)
  )
  select
    f.*,
    count(*) over () as total_count
  from filtered f
  order by f.created_at desc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.admin_user_list(text, text, integer, integer)
  from public, anon, authenticated;
