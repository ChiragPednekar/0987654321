-- ============================================================================
-- CaseCode — bring production back in line with the migrations
-- ============================================================================
-- A schema fingerprint of production compared with a database built from these
-- migrations (2026-09-14) found production had only partly received
-- 20250101000025_reconcile_missing_objects. Everything below is idempotent: on
-- a database built from the migrations it changes nothing except where noted
-- as a deliberate revision.
--
-- 1. AUDIT ROWS KEYED BY EMAIL WERE REJECTED
--
-- audit_log.resource_id is text in 025, but production had it as uuid. Role
-- grants are keyed by email, so every "role_grant.set" and "role_grant.revoke"
-- insert failed the cast — and audit() logs and swallows a failed write by
-- design, so the grant went through and its record silently did not. The
-- three grants production holds were inserted directly by migration, not
-- through the admin page, so no actual event was lost; the next one would
-- have been. Widening uuid to text is lossless.
--
-- 2. MISSING INDEXES AND A MISSING CHECK
--
-- audit_log_actor_idx, cases_visibility_idx, cases_owner_classroom_idx,
-- usage_events_operation_idx and the non-negative cost check on usage_events.
-- cases_owner_idx existed only in production; the teacher's own-question list
-- filters cases on created_by, so it is kept and added here rather than
-- dropped.
--
-- 3. THREE FUNCTIONS WERE OLDER VERSIONS
--
-- assignment_review_queue did not return the AI breakdown and feedback (the
-- teacher page compensates, but the function should match). platform_overview
-- and institution_commercials computed cost and activity differently from the
-- migrations, so /admin could disagree with the repository.
--
-- DELIBERATE REVISION: "active" means graded or used an AI feature
--
-- The two versions disagreed about who is active. 025 counted students with a
-- score in the window; production counted anyone with a usage event. Each
-- undercounts: a student who only did HR interviews, negotiations or sales
-- role-plays has no score, and grading that predates usage_events has no
-- event. "Cost per active user" divides AI spend by this number, so it now
-- counts either, once.
-- ============================================================================

-- -------------------------------------------------------------- 1. audit_log --
alter table public.audit_log
  alter column resource_id type text using resource_id::text;

-- ----------------------------------------------------- 2. indexes and check --
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, created_at desc);
create index if not exists usage_events_operation_idx
  on public.usage_events (operation, created_at desc);
create index if not exists cases_visibility_idx
  on public.cases (visibility) where visibility = 'platform';
create index if not exists cases_owner_classroom_idx
  on public.cases (owner_classroom_id) where owner_classroom_id is not null;
create index if not exists cases_owner_idx
  on public.cases (created_by) where created_by is not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.usage_events'::regclass
      and pg_get_constraintdef(oid) = 'CHECK ((cost_inr >= (0)::numeric))'
  ) then
    alter table public.usage_events
      add constraint usage_events_cost_inr_check check (cost_inr >= 0);
  end if;
end $$;

-- ------------------------------------------------ 3. assignment_review_queue --
-- As in 025. Dropped first because production's version returns fewer
-- columns, and `create or replace` cannot change a function's OUT parameters.
drop function if exists public.assignment_review_queue(uuid);
create function public.assignment_review_queue(p_assignment uuid)
returns table (
  user_id         uuid,
  full_name       text,
  email           text,
  submission_id   uuid,
  answer          text,
  submitted_at    timestamptz,
  is_late         boolean,
  attempt_number  integer,
  status          text,
  ai_score        integer,
  ai_max          integer,
  ai_percentage   numeric,
  ai_breakdown    jsonb,
  ai_feedback     jsonb,
  faculty_marks   numeric,
  faculty_remarks text,
  reviewed_at     timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    u.id, u.full_name, u.email,
    asub.submission_id,
    s.answer,
    asub.submitted_at,
    coalesce(asub.is_late, false),
    coalesce(asub.attempt_number, 0),
    asub.status,
    sc.total_score, sc.max_score, sc.percentage,
    sc.breakdown, sc.feedback,
    asub.faculty_marks, asub.faculty_remarks, asub.reviewed_at
  from public.classroom_assignments a
  join public.classroom_members m
    on m.classroom_id = a.classroom_id and m.role = 'student'
  join public.users u on u.id = m.user_id
  left join public.assignment_submissions asub
    on asub.assignment_id = a.id and asub.user_id = u.id
  left join public.submissions s on s.id = asub.submission_id
  left join public.scores sc on sc.submission_id = asub.submission_id
  where a.id = p_assignment
  -- Unsubmitted first: they are the ones needing a nudge.
  order by asub.submitted_at asc nulls first, u.full_name;
$$;
revoke execute on function public.assignment_review_queue(uuid)
  from public, anon, authenticated;

-- ------------------------------------------------------- platform_overview ----
/**
 * Supersedes 025. Identical except active_users, which counts anyone graded or
 * with an AI usage event in the window (see the header).
 */
create or replace function public.platform_overview(p_days integer default 30)
returns table (
  total_users        bigint,
  students           bigint,
  teachers           bigint,
  admins             bigint,
  active_users       bigint,
  new_users          bigint,
  never_started      bigint,
  total_institutions bigint,
  active_licences    bigint,
  expired_licences   bigint,
  suspended_licences bigint,
  seats_licensed     bigint,
  seats_used         bigint,
  gradings           bigint,
  interviews         bigint,
  total_tokens       bigint,
  ai_cost_inr        numeric
)
language sql stable security definer set search_path = public, pg_temp as $$
  with window_start as (
    select now() - make_interval(days => greatest(coalesce(p_days, 30), 1)) as t
  ),
  u as (
    select
      count(*)                                          as total,
      count(*) filter (where role = 'student')           as students,
      count(*) filter (where role = 'teacher')           as teachers,
      count(*) filter (where role = 'admin')             as admins,
      count(*) filter (where created_at > (select t from window_start))
                                                         as new_users,
      count(*) filter (where cases_attempted = 0)        as never_started
    from public.users
  ),
  act as (
    select count(*) as n
    from (
      select s.user_id from public.scores s
      where s.evaluated_at > (select t from window_start)
      union
      select e.user_id from public.usage_events e
      where e.user_id is not null and e.created_at > (select t from window_start)
    ) active
  ),
  inst as (
    select
      count(*)                                                    as total,
      count(*) filter (
        where not is_suspended
          and (licence_starts_on is null or licence_starts_on <= current_date)
          and (licence_ends_on   is null or licence_ends_on   >= current_date)
      )                                                           as active,
      count(*) filter (
        where licence_ends_on is not null and licence_ends_on < current_date
      )                                                           as expired,
      count(*) filter (where is_suspended)                        as suspended,
      coalesce(sum(seats_licensed), 0)                            as seats
    from public.institutions
  ),
  used as (
    select count(*) as n from public.institution_members where role = 'student'
  ),
  usage as (
    select
      count(*) filter (where operation = 'grading')   as gradings,
      count(*) filter (where operation = 'interview') as interviews,
      coalesce(sum(total_tokens), 0)                  as tokens,
      coalesce(sum(cost_inr), 0)                      as cost
    from public.usage_events
  )
  select
    u.total, u.students, u.teachers, u.admins,
    act.n, u.new_users, u.never_started,
    inst.total, inst.active, inst.expired, inst.suspended,
    inst.seats, used.n,
    usage.gradings, usage.interviews, usage.tokens,
    round(usage.cost, 2)
  from u, act, inst, used, usage;
$$;
revoke execute on function public.platform_overview(integer)
  from public, anon, authenticated;

-- -------------------------------------------------- institution_commercials ----
/**
 * Supersedes 025. Identical except active_30d, which uses the same definition
 * of active as platform_overview, so /admin and /admin/licences agree.
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
  ev as (
    select
      e.institution_id,
      count(*) filter (where e.operation = 'grading')                as gradings,
      count(*) filter (where e.operation = 'interview')              as interviews,
      coalesce(sum(e.total_tokens) filter (where e.operation = 'grading'), 0)
                                                                     as grading_tokens,
      coalesce(sum(e.total_tokens) filter (where e.operation = 'interview'), 0)
                                                                     as interview_tokens,
      coalesce(sum(e.cost_inr), 0)                                   as cost
    from public.usage_events e
    where e.institution_id is not null
    group by e.institution_id
  ),
  -- Fallback for usage that predates usage_events: the token columns on scores
  -- and chat_messages are still the only record of those calls. Counted only
  -- where no usage_events row exists for the institution, so the two can never
  -- be added together.
  legacy as (
    select
      mb.institution_id,
      count(distinct s.id)                as gradings,
      coalesce(sum(s.tokens_used), 0)     as tokens
    from member mb
    join public.scores s on s.user_id = mb.user_id
    group by mb.institution_id
  ),
  legacy_chat as (
    select
      mb.institution_id,
      count(distinct c.id)                 as interviews,
      coalesce(sum(cm.tokens_used), 0)     as tokens
    from member mb
    join public.chat_sessions c on c.user_id = mb.user_id
    left join public.chat_messages cm on cm.session_id = c.id
    group by mb.institution_id
  ),
  active as (
    select a.institution_id, count(distinct a.user_id) as n
    from (
      select mb.institution_id, mb.user_id
      from member mb
      join public.scores s on s.user_id = mb.user_id
      where s.evaluated_at > now() - interval '30 days'
      union
      select mb.institution_id, mb.user_id
      from member mb
      join public.usage_events e on e.user_id = mb.user_id
      where e.created_at > now() - interval '30 days'
    ) a
    group by a.institution_id
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
    coalesce(ev.gradings,   legacy.gradings,      0),
    coalesce(ev.interviews, legacy_chat.interviews, 0),
    coalesce(ev.grading_tokens,   legacy.tokens,      0),
    coalesce(ev.interview_tokens, legacy_chat.tokens, 0),
    case
      when ev.institution_id is not null then round(ev.cost, 2)
      else round(
        ((coalesce(legacy.tokens, 0) + coalesce(legacy_chat.tokens, 0))
           * 0.8 / 1e6 * p_in_rate_per_million
       + (coalesce(legacy.tokens, 0) + coalesce(legacy_chat.tokens, 0))
           * 0.2 / 1e6 * p_out_rate_per_million)
        * p_usd_inr, 2)
    end
  from public.institutions i
  left join seats       on seats.institution_id       = i.id
  left join active      on active.institution_id      = i.id
  left join ev          on ev.institution_id          = i.id
  left join legacy      on legacy.institution_id      = i.id
  left join legacy_chat on legacy_chat.institution_id = i.id
  order by i.created_at desc;
$$;
revoke execute on function public.institution_commercials(numeric, numeric, numeric)
  from public, anon, authenticated;
