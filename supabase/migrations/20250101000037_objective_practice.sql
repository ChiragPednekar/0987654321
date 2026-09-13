-- ============================================================================
-- CaseCode — objective practice (aptitude, concepts, current affairs)
-- ============================================================================
-- Everything the platform graded until now was free text judged by a model.
-- That is the right tool for a case and the wrong one for "what is 17% of
-- 340?", and it left the widest part of an MBA placement funnel unserved: most
-- students are eliminated by an aptitude test before anyone reads a case
-- answer of theirs.
--
-- Two properties make this worth its own engine rather than another case
-- format:
--
--   1. It is marked by comparing an integer, so a session costs nothing. No
--      model call, no tokens, no quota. That matters commercially — it is
--      volume we can give away inside a campus licence without the unit cost
--      moving, and volume is what turns weekly usage into daily usage.
--   2. It has an answer key, which free-text grading does not. That key is the
--      whole product, and it must never reach the browser before the student
--      has answered.
--
-- (2) is enforced with column grants rather than RLS. A row policy decides
-- WHICH rows you may read; it cannot hide a column within a row you are
-- allowed to read, and `options` has to be readable for the question to be
-- answerable at all. So `correct_index` and `explanation` are withheld at the
-- grant level and only ever travel back through the submit route, after the
-- answer is recorded. See 20250101000004_column_privileges.sql for the same
-- technique on users.
-- ============================================================================

do $$ begin
  create type public.objective_track as enum (
    -- The four sections nearly every Indian placement aptitude paper uses.
    'quant',
    'data_interpretation',
    'logical_reasoning',
    'verbal',
    -- Domain knowledge that is also asked as short objective questions.
    'finance_concepts',
    'accounting',
    'marketing_concepts',
    'current_affairs'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.objective_questions (
  id uuid primary key default gen_random_uuid(),
  track public.objective_track not null,
  -- Free text rather than a second enum: topics are how a student thinks
  -- ("time speed distance", "ratio"), they differ per track, and enumerating
  -- them now would be guessing at a taxonomy we do not have yet.
  topic text not null,
  difficulty public.difficulty not null default 'medium',

  /**
   * Shared stimulus — the passage a verbal question refers to, or the table a
   * data-interpretation set is read from. Several questions point at the same
   * context, which is exactly how DI is examined.
   */
  context text,
  stem text not null,
  -- ["...", "...", "...", "..."] — 2 to 6 options.
  options jsonb not null,

  -- The answer key. Deliberately NOT granted to anon or authenticated below.
  correct_index int not null,
  explanation text not null,

  source text,
  is_published boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint objective_options_shape check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  ),
  constraint objective_correct_in_range check (
    correct_index >= 0 and correct_index < jsonb_array_length(options)
  )
);

comment on table public.objective_questions is
  'Auto-marked practice questions. correct_index and explanation are never granted to clients.';

create index if not exists objective_questions_pick_idx
  on public.objective_questions (track, difficulty)
  where is_published;

create index if not exists objective_questions_topic_idx
  on public.objective_questions (track, topic) where is_published;

alter table public.objective_questions enable row level security;

drop policy if exists "published objective questions readable" on public.objective_questions;
create policy "published objective questions readable" on public.objective_questions
  for select using (is_published);

drop policy if exists "admins manage objective questions" on public.objective_questions;
create policy "admins manage objective questions" on public.objective_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- The point of the whole migration. Note what is absent: correct_index and
-- explanation. A client may read everything needed to ANSWER a question and
-- nothing that would let it mark itself.
revoke all on public.objective_questions from anon, authenticated;
grant select (id, track, topic, difficulty, context, stem, options, is_published)
  on public.objective_questions to authenticated;
grant select, insert, update, delete on public.objective_questions to service_role;

-- ----------------------------------------------------------------------------
-- One sitting.
-- ----------------------------------------------------------------------------
create table if not exists public.objective_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  track public.objective_track not null,
  difficulty public.difficulty,

  -- Fixed at start so the set cannot be reshuffled into an easier one by
  -- retrying, and so the order the student saw is reproducible afterwards.
  question_ids uuid[] not null,

  /**
   * {"<question_id>": <chosen index>}. Absent key means skipped, which is a
   * real answer in a negatively-marked paper and must stay distinguishable
   * from a wrong one.
   */
  answers jsonb not null default '{}'::jsonb,

  correct_count int,
  total int not null,
  seconds int,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,

  constraint objective_sessions_total_positive check (total > 0)
);

comment on table public.objective_sessions is
  'One objective practice sitting. Marked server-side; the client never sees the key.';

create index if not exists objective_sessions_user_idx
  on public.objective_sessions (user_id, started_at desc);

alter table public.objective_sessions enable row level security;

drop policy if exists "own objective sessions" on public.objective_sessions;
create policy "own objective sessions" on public.objective_sessions
  for select using (user_id = auth.uid());

drop policy if exists "staff read objective sessions" on public.objective_sessions;
create policy "staff read objective sessions" on public.objective_sessions
  for select using (public.is_admin());

-- Read-only for the student. Starting and submitting both go through routes
-- that run as the service role, because a client that could write `answers`
-- or `correct_count` could write itself a perfect score.
revoke all on public.objective_sessions from anon, authenticated;
grant select on public.objective_sessions to authenticated;
grant select, insert, update, delete on public.objective_sessions to service_role;

-- ----------------------------------------------------------------------------
-- Per-track standing, for the dashboard and for a placement cell's report.
-- ----------------------------------------------------------------------------
create or replace function public.objective_summary(p_user uuid)
returns table (
  track public.objective_track,
  sittings bigint,
  questions bigint,
  correct bigint,
  accuracy_pct numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.track,
    count(*)                                        as sittings,
    coalesce(sum(s.total), 0)                       as questions,
    coalesce(sum(s.correct_count), 0)               as correct,
    case
      when coalesce(sum(s.total), 0) = 0 then 0
      else round(100.0 * sum(s.correct_count) / sum(s.total), 1)
    end                                             as accuracy_pct
  from public.objective_sessions s
  where s.user_id = p_user
    and s.submitted_at is not null
  group by s.track
  order by s.track;
$$;

comment on function public.objective_summary(uuid) is
  'Per-track accuracy for one account, over submitted sittings only.';

-- Takes a user id as an argument, so service-role only — the rule has_pro()
-- was breaking. See 20250101000029_lock_down_rpc_surface.sql.
revoke execute on function public.objective_summary(uuid) from public, anon, authenticated;
grant execute on function public.objective_summary(uuid) to service_role;
