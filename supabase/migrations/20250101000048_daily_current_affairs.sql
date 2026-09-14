-- ============================================================================
-- CaseCode — the daily current affairs quiz
-- ============================================================================
-- Five questions a day, written from official press releases, marked
-- automatically. A habit-builder: zero cost per attempt, one model call a day
-- for the whole platform.
--
-- A QUESTION IS ONLY AS TRUE AS ITS SOURCE
--
-- A model cannot know today's news, and asked to invent "current affairs" it
-- will produce plausible, dated, wrong facts. So it is never asked to. A daily
-- job stores the RBI's press releases (ca_source_items, full text), and the
-- model writes questions from that text only, quoting the sentence that proves
-- each answer. src/lib/current-affairs/questions.ts then refuses any question
-- whose quote is not in the release or whose answer contains a figure the
-- release does not. The quote and the source link are kept on the question, so
-- a student reviewing an answer can see exactly where it came from.
--
-- An admin can still pull a question. A pulled question vanishes from every
-- attempt's score — past and future — rather than silently staying wrong.
--
-- THE ANSWER KEY IS WITHHELD BY GRANT
--
-- correct_index, explanation and evidence (which quotes the answer) are not
-- granted to clients, on the same pattern as objective_questions. They travel
-- only through /api/daily/submit, after the attempt is recorded.
-- ============================================================================

create table if not exists public.ca_source_items (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('rbi')),
  url           text not null unique,
  title         text not null,
  published_at  timestamptz not null,
  body          text not null,
  first_seen_at timestamptz not null default now()
);

comment on table public.ca_source_items is
  'Official press releases, stored in full as the only material daily questions may be written from.';

create index if not exists ca_source_items_published_idx
  on public.ca_source_items (published_at desc);

create table if not exists public.ca_quizzes (
  id         uuid primary key default gen_random_uuid(),
  -- The Indian calendar date the quiz belongs to. One per day, enforced here
  -- rather than trusted to a cron that might run twice.
  quiz_date  date not null unique,
  model      text,
  created_at timestamptz not null default now()
);

create table if not exists public.ca_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.ca_quizzes(id) on delete cascade,
  position       smallint not null check (position >= 0),
  stem           text not null,
  options        text[] not null,
  correct_index  smallint not null,
  explanation    text not null,
  evidence       text not null,
  source_item_id uuid not null references public.ca_source_items(id),
  is_pulled      boolean not null default false,
  pulled_at      timestamptz,
  pulled_by      uuid references public.users(id) on delete set null,

  unique (quiz_id, position),
  constraint ca_questions_four_options check (array_length(options, 1) = 4),
  constraint ca_questions_correct_in_range check (correct_index between 0 and 3)
);

create index if not exists ca_questions_quiz_idx on public.ca_questions (quiz_id, position);
create index if not exists ca_questions_source_idx on public.ca_questions (source_item_id);

create table if not exists public.ca_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  quiz_id      uuid not null references public.ca_quizzes(id) on delete cascade,
  -- By position; -1 for a question left unanswered.
  answers      smallint[] not null,
  -- Taken on the quiz's own Indian date. Only these build a streak, so doing
  -- last week's quizzes today is practice, not a retroactive streak.
  on_the_day   boolean not null,
  submitted_at timestamptz not null default now(),

  -- One attempt per quiz. A second go after seeing the answers is not a score.
  unique (user_id, quiz_id)
);

create index if not exists ca_attempts_user_idx on public.ca_attempts (user_id, submitted_at desc);

alter table public.ca_source_items enable row level security;
alter table public.ca_quizzes      enable row level security;
alter table public.ca_questions    enable row level security;
alter table public.ca_attempts     enable row level security;

drop policy if exists "signed-in read sources" on public.ca_source_items;
create policy "signed-in read sources" on public.ca_source_items
  for select to authenticated using (true);

drop policy if exists "signed-in read quizzes" on public.ca_quizzes;
create policy "signed-in read quizzes" on public.ca_quizzes
  for select to authenticated using (true);

drop policy if exists "signed-in read questions" on public.ca_questions;
create policy "signed-in read questions" on public.ca_questions
  for select to authenticated using (true);

drop policy if exists "own ca attempts" on public.ca_attempts;
create policy "own ca attempts" on public.ca_attempts
  for select using (user_id = auth.uid());

revoke all on public.ca_source_items, public.ca_quizzes, public.ca_questions, public.ca_attempts
  from anon, authenticated;

grant select (id, source, url, title, published_at) on public.ca_source_items to authenticated;
grant select (id, quiz_date, created_at) on public.ca_quizzes to authenticated;
-- correct_index, explanation, evidence and source_item_id absent: the last would
-- let a student open the release and find the answer before submitting.
grant select (id, quiz_id, position, stem, options, is_pulled) on public.ca_questions to authenticated;
grant select on public.ca_attempts to authenticated;

grant select, insert, update, delete on
  public.ca_source_items, public.ca_quizzes, public.ca_questions, public.ca_attempts
  to service_role;

-- The generation call belongs to no student. usage_events.user_id is already
-- nullable; the operation list needs the new kind.
alter table public.usage_events drop constraint if exists usage_events_operation_check;
alter table public.usage_events add constraint usage_events_operation_check
  check (operation in ('grading', 'interview', 'content'));
