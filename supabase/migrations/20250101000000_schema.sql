-- ============================================================================
-- CaseCode — core schema
-- ============================================================================
-- Conventions:
--   * every table has a uuid PK and created_at
--   * denormalised counters (cases_solved, upvotes, ...) are maintained by
--     triggers in 20250101000001_functions.sql, never by the client
--   * RLS lives in 20250101000002_policies.sql
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums ----

create type public.domain as enum (
  'finance',
  'consulting',
  'product_management',
  'marketing',
  'strategy'
);

create type public.difficulty as enum ('easy', 'medium', 'hard');

create type public.user_role as enum ('student', 'admin');

create type public.submission_status as enum (
  'draft',
  'submitted',
  'evaluating',
  'evaluated',
  'failed'
);

create type public.contest_status as enum (
  'scheduled',
  'live',
  'grading',
  'completed'
);

create type public.leaderboard_period as enum ('all_time', 'weekly', 'monthly');

create type public.activity_type as enum (
  'case_solved',
  'case_attempted',
  'badge_earned',
  'level_up',
  'contest_entered',
  'path_step_completed'
);

-- ---------------------------------------------------------------- users ----

create table public.users (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          citext not null unique,
  full_name      text,
  avatar_url     text,
  university     text,
  career_goal    text,
  role           public.user_role not null default 'student',

  -- gamification
  xp             integer not null default 0 check (xp >= 0),
  level          integer not null default 1 check (level >= 1),
  total_score    integer not null default 0 check (total_score >= 0),
  cases_solved   integer not null default 0 check (cases_solved >= 0),
  cases_attempted integer not null default 0 check (cases_attempted >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_solved_on date,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.users is
  'Public profile mirroring auth.users. Created automatically by handle_new_user().';

create index users_xp_idx on public.users (xp desc);
create index users_role_idx on public.users (role) where role = 'admin';

-- ------------------------------------------------------- case_categories ----

create table public.case_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  domain      public.domain not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index case_categories_domain_idx on public.case_categories (domain);

-- ---------------------------------------------------------------- cases ----

create table public.cases (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  domain            public.domain not null,
  difficulty        public.difficulty not null,
  category_id       uuid references public.case_categories (id) on delete set null,
  company_track     text,
  estimated_minutes integer not null default 30 check (estimated_minutes > 0),

  scenario          text not null,
  supporting_data   jsonb not null default '{}'::jsonb,
  attachments       jsonb not null default '[]'::jsonb,
  instructions      text not null default '',
  expected_framework text,
  model_answer      text,
  tags              text[] not null default '{}',

  is_published      boolean not null default true,
  created_by        uuid references public.users (id) on delete set null,

  -- maintained by triggers
  total_submissions integer not null default 0,
  total_solved      integer not null default 0,
  avg_score         numeric(5, 2) not null default 0,
  completion_rate   numeric(5, 4) generated always as (
    case when total_submissions = 0 then 0
         else round(total_solved::numeric / total_submissions, 4)
    end
  ) stored,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index cases_domain_difficulty_idx on public.cases (domain, difficulty);
create index cases_published_idx on public.cases (is_published) where is_published;
create index cases_company_track_idx on public.cases (company_track);
create index cases_tags_idx on public.cases using gin (tags);
create index cases_search_idx on public.cases
  using gin (to_tsvector('english', title || ' ' || scenario));

-- -------------------------------------------------------------- rubrics ----

create table public.rubrics (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null unique references public.cases (id) on delete cascade,
  -- Flat weight map, exactly as the evaluator consumes it:
  --   {"financial_analysis": 20, "market_analysis": 20, ...}
  criteria    jsonb not null,
  -- Optional per-criterion guidance handed to the model:
  --   {"financial_analysis": "Look for unit economics, burn multiple, runway."}
  descriptors jsonb not null default '{}'::jsonb,
  max_score   integer not null check (max_score > 0),
  pass_score  integer not null default 60 check (pass_score between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint rubrics_criteria_is_object check (jsonb_typeof(criteria) = 'object'),
  constraint rubrics_criteria_not_empty check (criteria <> '{}'::jsonb)
);

-- ------------------------------------------------------------- contests ----

create table public.contests (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  description      text,
  case_id          uuid not null references public.cases (id) on delete restrict,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  -- Personal timer: once a user starts, they get this long.
  duration_minutes integer not null default 120 check (duration_minutes > 0),
  -- Speed bonus decays linearly from max_speed_bonus at t=0 to 0 at t=duration.
  max_speed_bonus  integer not null default 20 check (max_speed_bonus >= 0),
  status           public.contest_status not null default 'scheduled',
  is_published     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint contests_window_valid check (ends_at > starts_at)
);

create index contests_window_idx on public.contests (starts_at, ends_at);
create index contests_status_idx on public.contests (status);

-- ---------------------------------------------------------- submissions ----

create table public.submissions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete cascade,
  case_id            uuid not null references public.cases (id) on delete cascade,
  contest_id         uuid references public.contests (id) on delete set null,
  answer             text not null check (length(answer) > 0),
  status             public.submission_status not null default 'submitted',
  attempt_number     integer not null default 1,
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  is_public          boolean not null default false,
  upvotes            integer not null default 0,
  error_message      text,
  created_at         timestamptz not null default now(),
  submitted_at       timestamptz not null default now()
);

create index submissions_user_idx on public.submissions (user_id, created_at desc);
create index submissions_case_idx on public.submissions (case_id, created_at desc);
create index submissions_contest_idx on public.submissions (contest_id);
create index submissions_public_idx on public.submissions (case_id, upvotes desc)
  where is_public;

-- --------------------------------------------------------------- scores ----

create table public.scores (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  case_id       uuid not null references public.cases (id) on delete cascade,
  -- {"financial_analysis": 18, "market_analysis": 15, ...}
  breakdown     jsonb not null,
  total_score   integer not null check (total_score >= 0),
  max_score     integer not null check (max_score > 0),
  percentage    numeric(5, 2) generated always as (
    round((total_score::numeric / nullif(max_score, 0)) * 100, 2)
  ) stored,
  -- {"strengths": [], "weaknesses": [], "improvements": []}
  feedback      jsonb not null default '{}'::jsonb,
  model         text,
  tokens_used   integer,
  evaluated_at  timestamptz not null default now()
);

create index scores_user_idx on public.scores (user_id, evaluated_at desc);
create index scores_case_idx on public.scores (case_id);

-- ------------------------------------------------------- learning paths ----

create table public.learning_paths (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  domain       public.domain not null,
  description  text,
  icon         text,
  sort_order   integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.learning_path_steps (
  id                uuid primary key default gen_random_uuid(),
  path_id           uuid not null references public.learning_paths (id) on delete cascade,
  case_id           uuid not null references public.cases (id) on delete cascade,
  step_order        integer not null,
  title             text not null,
  -- Minimum percentage on this step before the next unlocks.
  unlock_threshold  integer not null default 60 check (unlock_threshold between 0 and 100),
  created_at        timestamptz not null default now(),

  unique (path_id, step_order),
  unique (path_id, case_id)
);

create index learning_path_steps_path_idx on public.learning_path_steps (path_id, step_order);

create table public.user_path_progress (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  path_id          uuid not null references public.learning_paths (id) on delete cascade,
  completed_steps  integer not null default 0,
  current_step     integer not null default 1,
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),

  unique (user_id, path_id)
);

-- --------------------------------------------------- contest submissions ----

create table public.contest_submissions (
  id             uuid primary key default gen_random_uuid(),
  contest_id     uuid not null references public.contests (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  submission_id  uuid references public.submissions (id) on delete set null,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  duration_seconds integer,
  base_score     integer,
  speed_bonus    integer not null default 0,
  final_score    integer,
  rank           integer,

  unique (contest_id, user_id)
);

create index contest_submissions_rank_idx
  on public.contest_submissions (contest_id, final_score desc nulls last);

-- --------------------------------------------------------- leaderboards ----

-- Denormalised ranking table, rebuilt by refresh_leaderboards().
create table public.leaderboards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  period       public.leaderboard_period not null,
  period_start date not null,
  period_end   date not null,
  total_points integer not null default 0,
  cases_solved integer not null default 0,
  accuracy     numeric(5, 2) not null default 0,
  rank         integer not null,
  updated_at   timestamptz not null default now(),

  unique (user_id, period, period_start)
);

create index leaderboards_lookup_idx
  on public.leaderboards (period, period_start, rank);

-- ------------------------------------------------------------- comments ----

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references public.cases (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  upvotes    integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_case_idx on public.comments (case_id, created_at desc);
create index comments_parent_idx on public.comments (parent_id);

create table public.comment_votes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.submission_votes (
  submission_id uuid not null references public.submissions (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (submission_id, user_id)
);

-- --------------------------------------------- badges & achievements ------

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null,
  icon        text not null default 'award',
  tier        text not null default 'bronze'
                check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  -- Machine-checkable rule, e.g.
  --   {"type": "cases_solved", "threshold": 10}
  --   {"type": "domain_cases_solved", "domain": "finance", "threshold": 25}
  --   {"type": "streak", "threshold": 7}
  --   {"type": "perfect_score"}
  criteria    jsonb not null,
  xp_reward   integer not null default 0,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.achievements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  badge_id   uuid not null references public.badges (id) on delete cascade,
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index achievements_user_idx on public.achievements (user_id, earned_at desc);

-- ------------------------------------------------------------- activity ----

create table public.user_activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  type       public.activity_type not null,
  case_id    uuid references public.cases (id) on delete set null,
  metadata   jsonb not null default '{}'::jsonb,
  xp_delta   integer not null default 0,
  created_at timestamptz not null default now()
);

create index user_activity_user_idx on public.user_activity (user_id, created_at desc);

-- ----------------------------------------------------------------- views ----

-- Per-user, per-domain progress. Powers the dashboard radar chart.
create view public.domain_progress
with (security_invoker = true) as
select
  s.user_id,
  c.domain,
  count(distinct s.case_id)                       as cases_solved,
  round(avg(s.percentage), 2)                     as avg_percentage,
  coalesce(sum(s.total_score), 0)                 as total_points,
  max(s.evaluated_at)                             as last_solved_at
from public.scores s
join public.cases c on c.id = s.case_id
group by s.user_id, c.domain;

-- Best score per user per case — "solved" state and accuracy are derived here.
create view public.user_case_best
with (security_invoker = true) as
select distinct on (s.user_id, s.case_id)
  s.user_id,
  s.case_id,
  s.total_score,
  s.max_score,
  s.percentage,
  s.submission_id,
  s.evaluated_at
from public.scores s
order by s.user_id, s.case_id, s.percentage desc, s.evaluated_at asc;

-- ---------------------------------------------------------------------------
-- Baseline role privileges.
--
-- Hosted Supabase bootstraps the public schema with GRANT ALL to anon,
-- authenticated and service_role, so the original migrations never stated
-- these and still worked in production. Anywhere without that bootstrap — a
-- local stack, a fresh staging project — every role landed with no table
-- privileges at all: the seeder could not write, and the case library rendered
-- empty because RLS only filters rows *after* a grant has let the role in.
--
-- These are the baseline. 20250101000004_column_privileges.sql runs later and
-- narrows anon and authenticated back down; that migration remains the single
-- source of truth for what those two roles may actually do.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
