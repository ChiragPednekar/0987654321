-- ============================================================================
-- CaseCode — reconcile objects that existed only in production
-- ============================================================================
-- Six database objects were referenced by application code, declared in the
-- hand-maintained src/lib/types/database.ts, and created by no migration:
--
--   table    public.usage_events
--   table    public.audit_log
--   function public.platform_overview(integer)
--   function public.admin_user_list(text, text, integer, integer)
--   column   public.cases.visibility
--   column   public.cases.owner_classroom_id
--
-- Because `database.ts` is written by hand rather than generated, `tsc` and CI
-- were both perfectly happy — the types said the columns existed, so nothing
-- ever checked whether the database agreed. The precedent is commit 6dc2159,
-- "Commit three migrations that were only ever applied to production": objects
-- get applied through the SQL editor and the migration is written afterwards,
-- or not at all.
--
-- The visible cost of the drift, before this migration:
--
--   * POST /api/teacher/questions inserts `visibility` and
--     `owner_classroom_id`, so creating a teacher question fails PGRST204.
--   * POST /api/teacher/assignments selects both columns, so creating an
--     assignment fails the same way.
--   * /teacher/questions filters on `visibility`, /admin calls
--     platform_overview(), /admin/users calls admin_user_list().
--   * recordUsage() and audit() both wrap their insert in a swallowing
--     try/catch, so usage and audit writes failed *silently* — zeroed
--     dashboards and no error anywhere to explain them.
--
-- Everything here is idempotent (`if not exists`, `create or replace`,
-- duplicate_object guards) because production may already hold some of these
-- and this migration must be safe to apply there as well as to a fresh
-- database. Where a shape had to be chosen, it is the shape the application
-- already expects — see the matching types in src/lib/types/database.ts.
-- ============================================================================

-- ---------------------------------------------------------- usage_events ----

-- Per-operation AI accounting. One row per model call, priced at the rates in
-- force when it happened, so a later price change restates nothing.
create table if not exists public.usage_events (
  id             uuid primary key default gen_random_uuid(),
  -- Nullable and ON DELETE SET NULL: deleting a student must not erase the
  -- cost their usage already caused. The contract was still served.
  user_id        uuid references public.users(id) on delete set null,
  -- Denormalised at write time for the same reason — a student can leave an
  -- institution later, and the spend still belongs to that licence.
  institution_id uuid references public.institutions(id) on delete set null,
  operation      text not null check (operation in ('grading', 'interview')),
  model          text,
  input_tokens   integer not null default 0 check (input_tokens  >= 0),
  output_tokens  integer not null default 0 check (output_tokens >= 0),
  total_tokens   integer not null default 0 check (total_tokens  >= 0),
  cost_inr       numeric(12, 4) not null default 0 check (cost_inr >= 0),
  created_at     timestamptz not null default now()
);

create index if not exists usage_events_created_idx
  on public.usage_events (created_at desc);
create index if not exists usage_events_institution_idx
  on public.usage_events (institution_id, created_at desc);
create index if not exists usage_events_user_idx
  on public.usage_events (user_id, created_at desc);
-- The admin usage page groups by operation over a recent window.
create index if not exists usage_events_operation_idx
  on public.usage_events (operation, created_at desc);

alter table public.usage_events enable row level security;

-- No policy is declared deliberately: with RLS on and no policy, the table is
-- unreachable by anon and authenticated no matter what PostgREST is asked for.
-- Only the service role reads or writes it. tests/authorization.test.ts asserts
-- exactly this.
revoke all on public.usage_events from anon, authenticated;

-- -------------------------------------------------------------- audit_log ----

-- Record of privileged actions. Append-only by convention: nothing in the
-- application updates or deletes a row here.
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  -- The actor's id may be nulled by a later account deletion; actor_email is
  -- kept as a plain string so the record still says who did it.
  actor_id    uuid references public.users(id) on delete set null,
  actor_email text,
  action      text not null,
  resource    text not null,
  resource_id text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_resource_idx
  on public.audit_log (resource, resource_id);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- --------------------------------------------------------- case ownership ----

-- Separates the platform library from a teacher's own questions. Without this
-- column the two were indistinguishable, and since the row policy on `cases`
-- is `using (is_published or is_admin())`, a teacher question that was ever
-- published landed in the *public* library — model answer included.
do $$ begin
  create type public.case_visibility as enum ('platform', 'private');
exception when duplicate_object then null; end $$;

alter table public.cases
  add column if not exists visibility public.case_visibility
    not null default 'platform',
  -- Which batch a private question belongs to. Null for platform cases.
  add column if not exists owner_classroom_id uuid
    references public.classrooms(id) on delete cascade;

-- Partial index: the library and search filter on visibility on every read.
create index if not exists cases_visibility_idx
  on public.cases (visibility) where visibility = 'platform';
create index if not exists cases_owner_classroom_idx
  on public.cases (owner_classroom_id) where owner_classroom_id is not null;

-- Existing rows are all platform cases (the default above already says so).
-- Anything a teacher authored before this migration carries created_by and no
-- owner_classroom_id; it stays 'platform' rather than being guessed at, because
-- silently hiding a case someone is already assigning would be worse than
-- leaving it visible. There are none in practice — question authoring could not
-- succeed without these columns.

grant select (visibility, owner_classroom_id) on public.cases to anon, authenticated;

-- The row policy is the actual boundary, not the page-level filters. A private
-- question is readable by the batch it belongs to and by its author; everyone
-- else cannot see it even with a hand-written PostgREST query.
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

-- Rubrics follow their case: the previous policy exposed a rubric for any
-- published case, which would now leak a private question's criteria.
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

-- ------------------------------------------------- assignment_review_queue ---
/**
 * Recreated, for two reasons.
 *
 * 1. 20250101000024 changed assignment_submissions.status from the
 *    `assignment_status` enum to text, and added the values 'ai_graded' and
 *    'resubmission_requested' which that enum never had. This function was
 *    declared `status public.assignment_status` and was never recreated, so its
 *    final statement now returns text for a column declared as an enum. Since
 *    the same migration's scores trigger sets 'ai_graded' automatically, the
 *    teacher review page hit this on the ordinary path.
 *
 * 2. It returned the AI's total and nothing else. scores.breakdown and
 *    scores.feedback already hold the per-criterion split and the written
 *    strengths/weaknesses/improvements — the teacher simply never saw them,
 *    which is most of the value of grading against a rubric.
 *
 * attempt_number is returned too; AssignmentReviewRow already declared it.
 */
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

-- ------------------------------------------------------ platform_overview ----
/**
 * Platform-wide operational totals for the owner's overview.
 *
 * Aggregated in one round trip rather than counted in JavaScript, so the page
 * keeps working once the tables are large. Cost comes from usage_events, which
 * stores what each call actually cost at the rate in force — the same source
 * institution_commercials now uses, so the two pages cannot disagree.
 */
-- Dropped first rather than replaced: `create or replace` cannot change a
-- function's OUT parameters, and production may already hold a version of this
-- with a different shape (that is how it came to be missing from the migrations
-- in the first place). Dropping makes this migration safe to apply there.
drop function if exists public.platform_overview(integer);
create function public.platform_overview(p_days integer default 30)
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
    select count(distinct s.user_id) as n
    from public.scores s
    where s.evaluated_at > (select t from window_start)
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

-- --------------------------------------------------------- admin_user_list ---
/**
 * One page of the admin user list, filtered and counted in the database.
 *
 * total_count rides along on every row via a window function so the page can
 * paginate without a second query. A platform that works will not fit its user
 * table on one page, and pulling it into JavaScript to count would stop working
 * exactly when it starts mattering.
 */
-- Same reasoning as platform_overview above.
drop function if exists public.admin_user_list(text, text, integer, integer);
create function public.admin_user_list(
  p_search text    default null,
  p_role   text    default null,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id           uuid,
  email        text,
  full_name    text,
  role         public.user_role,
  plan         public.plan_tier,
  institution  text,
  cases_solved integer,
  ce           integer,
  last_active  timestamptz,
  created_at   timestamptz,
  total_count  bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with filtered as (
    select
      u.id, u.email::text, u.full_name, u.role, u.plan,
      i.name as institution,
      u.cases_solved, u.ce,
      (select max(s.evaluated_at) from public.scores s where s.user_id = u.id)
        as last_active,
      u.created_at
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

-- ----------------------------------------------- one source of truth for cost --
/**
 * institution_commercials, recomputed from usage_events.
 *
 * Supersedes the version in 20250101000022, which derived cost from
 * scores.tokens_used + chat_messages.tokens_used and apportioned the total
 * 80/20 between input and output. That was a reasonable estimate when nothing
 * stored the split, but usage_events records what each call actually cost, and
 * two pages computing AI spend two different ways will eventually disagree in
 * front of a customer. /admin and /admin/licences now read the same number.
 *
 * The rate arguments are kept for compatibility with the existing callers and
 * are still used for the token-derived fallback below.
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

-- ------------------------------------------------- quota: honour suspension --
/**
 * quota_status, with suspended licences excluded from the override lookup.
 *
 * has_pro() already refuses a suspended licence, so a suspended member drops to
 * the free tier — but the override CTE in 20250101000021 did not check
 * is_suspended, so a suspended contract could still raise that member's *free*
 * allowance above the default. Superseded here.
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
