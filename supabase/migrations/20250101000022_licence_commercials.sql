-- ============================================================================
-- CaseCode — licence commercials and token accounting
-- ============================================================================
-- Two gaps this closes.
--
-- There was nowhere to record what a college actually pays, so "show me the
-- billing" was unanswerable. `is_suspended` is separate from the licence dates
-- deliberately: non-payment should not require back-dating a contract.
--
-- And /api/chat received a token count from the provider and threw it away, so
-- interview cost could only ever be estimated while grading cost was measured.
-- An owner comparing margin across licences would have been comparing a
-- measurement to a guess.
--
-- Applied to production as `licence_commercials_and_token_accounting` on
-- 2026-08-25.
-- ============================================================================

alter table public.institutions
  add column if not exists contract_value_inr    integer check (contract_value_inr is null or contract_value_inr >= 0),
  add column if not exists billing_contact_email text,
  add column if not exists notes                 text,
  add column if not exists is_suspended          boolean not null default false;

grant select (contract_value_inr, is_suspended) on public.institutions to authenticated;

alter table public.chat_messages
  add column if not exists tokens_used integer not null default 0,
  add column if not exists model       text;

-- A suspended licence must stop conferring Pro at once. Supersedes the version
-- in 20250101000019.
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
        and not i.is_suspended
        and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
        and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
    );
$$;

/**
 * Per-licence commercials for the platform owner.
 *
 * Cost is computed from stored token counts rather than a per-call estimate,
 * so margin is measured. Rates are passed in rather than hardcoded: they are
 * Google's list prices, they change (they roughly double on 2027-01-01), and a
 * copy buried in a function is a copy that goes stale silently.
 */
create or replace function public.institution_commercials(
  p_in_rate_per_million  numeric,
  p_out_rate_per_million numeric,
  p_usd_inr              numeric
)
returns table (
  institution_id     uuid,
  name               text,
  seats_licensed     integer,
  seats_used         bigint,
  active_30d         bigint,
  contract_value_inr integer,
  licence_ends_on    date,
  is_suspended       boolean,
  gradings           bigint,
  interviews         bigint,
  grading_tokens     bigint,
  interview_tokens   bigint,
  ai_cost_inr        numeric
)
language sql stable security definer set search_path = public, pg_temp as $$
  with member as (
    select m.institution_id, m.user_id
    from public.institution_members m
    where m.role = 'student'
  ),
  grading as (
    select mb.institution_id,
           count(*)                       as n,
           coalesce(sum(s.tokens_used),0) as tok
    from member mb
    join public.scores s on s.user_id = mb.user_id
    group by mb.institution_id
  ),
  chat as (
    select mb.institution_id,
           count(distinct c.id)            as n,
           coalesce(sum(cm.tokens_used),0) as tok
    from member mb
    join public.chat_sessions c on c.user_id = mb.user_id
    left join public.chat_messages cm on cm.session_id = c.id
    group by mb.institution_id
  ),
  active as (
    select mb.institution_id, count(distinct s.user_id) as n
    from member mb
    join public.scores s on s.user_id = mb.user_id
    where s.evaluated_at > now() - interval '30 days'
    group by mb.institution_id
  ),
  seats as (
    select institution_id, count(*) as n from member group by institution_id
  )
  select
    i.id, i.name, i.seats_licensed,
    coalesce(seats.n, 0),
    coalesce(active.n, 0),
    i.contract_value_inr,
    i.licence_ends_on,
    i.is_suspended,
    coalesce(grading.n, 0),
    coalesce(chat.n, 0),
    coalesce(grading.tok, 0),
    coalesce(chat.tok, 0),
    -- Token counts are totals, not split by direction. Apportioned 80/20
    -- input:output, which is what the measured grading calls actually look
    -- like (5,271 in / 1,126 out).
    round(
      ((coalesce(grading.tok,0) + coalesce(chat.tok,0)) * 0.8 / 1e6 * p_in_rate_per_million
     + (coalesce(grading.tok,0) + coalesce(chat.tok,0)) * 0.2 / 1e6 * p_out_rate_per_million)
      * p_usd_inr, 2)
  from public.institutions i
  left join seats   on seats.institution_id   = i.id
  left join active  on active.institution_id  = i.id
  left join grading on grading.institution_id = i.id
  left join chat    on chat.institution_id    = i.id
  order by i.created_at desc;
$$;

revoke execute on function public.institution_commercials(numeric, numeric, numeric)
  from public, anon, authenticated;
