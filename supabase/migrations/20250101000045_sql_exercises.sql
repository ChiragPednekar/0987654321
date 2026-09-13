-- ============================================================================
-- CaseCode — SQL exercises
-- ============================================================================
-- Grading a query means running it, which is why this was the last thing built
-- and the only feature here that executes untrusted code.
--
-- WHERE IT RUNS
--
-- Not in Postgres. A read-only role against the production database would
-- still expose the whole schema to anyone who can type information_schema, and
-- one careless cross join would take the site down for everybody. A separate
-- sandboxed Postgres is the textbook answer and is infrastructure this stack
-- does not have.
--
-- So SQLite compiled to WebAssembly, in memory, built fresh per request from
-- the exercise's own fixture and thrown away. No filesystem, no network, no
-- other tenant's data to reach. The runner in src/lib/sql/runner.ts also
-- refuses anything that writes or reaches outside the fixture, and refuses a
-- second statement smuggled after a semicolon.
--
-- THE SECOND DATASET IS THE WHOLE DESIGN
--
-- Comparing a result set to an expected one has a famous hole: skip the
-- question and write the answer out as literals. It produces the right rows
-- without querying anything, and a grader that only checks the visible data
-- cannot tell the difference.
--
-- So every exercise carries a hidden fixture with the same schema and
-- different rows, and a submission is marked against both. A correct query
-- answers both; a hardcoded one answers the first and fails the second. That
-- is why hidden_setup_sql and solution_sql are withheld by column grant rather
-- than merely by RLS — the row has to be readable for the visible fixture and
-- the prompt to load at all.
--
-- The seeder enforces the other half: it runs every reference solution against
-- both datasets and refuses one that fails or returns nothing on either, and
-- it runs a deliberately hardcoded control to prove the hidden variant
-- actually discriminates. A first draft had no Mumbai customer in the hidden
-- set, so two exercises returned nothing there — which would have failed
-- students whose correct query also returned nothing.
-- ============================================================================

create table if not exists public.sql_exercises (
  id      uuid primary key default gen_random_uuid(),
  slug    text unique not null,
  title   text not null,
  prompt  text not null,
  topic   text not null default 'basics',
  difficulty public.difficulty not null default 'medium',

  -- Shown to the student: the schema, and the data they can see.
  schema_note text not null,
  setup_sql   text not null,

  -- Never granted below.
  hidden_setup_sql text not null,
  solution_sql     text not null,

  -- True only when the question asks for a specific order, which is exactly
  -- when the student was told to write an ORDER BY.
  order_matters boolean not null default false,
  hint          text,

  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.sql_exercises is
  'SQL exercises. solution_sql and hidden_setup_sql are never granted to clients.';

create index if not exists sql_exercises_order_idx
  on public.sql_exercises (sort_order) where is_published;

alter table public.sql_exercises enable row level security;

drop policy if exists "published sql exercises readable" on public.sql_exercises;
create policy "published sql exercises readable" on public.sql_exercises for select using (is_published);
drop policy if exists "admins manage sql exercises" on public.sql_exercises;
create policy "admins manage sql exercises" on public.sql_exercises
  for all using (public.is_admin()) with check (public.is_admin());

-- Note the two absent columns. Same technique as the answer key on
-- objective_questions (20250101000037) and the counterparty's hand on
-- negotiation_cases (20250101000043).
revoke all on public.sql_exercises from anon, authenticated;
grant select (id, slug, title, prompt, topic, difficulty, schema_note,
              setup_sql, order_matters, hint, is_published, sort_order, created_at)
  on public.sql_exercises to authenticated;
grant select, insert, update, delete on public.sql_exercises to service_role;

create table if not exists public.sql_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  exercise_id uuid not null references public.sql_exercises(id) on delete cascade,
  query       text not null,
  correct     boolean not null,
  -- 'hidden' is the interesting one: the query worked on the rows the student
  -- could see and failed on the ones they could not.
  failed_on   text check (failed_on in ('visible', 'hidden', 'error')),
  created_at  timestamptz not null default now()
);

comment on table public.sql_attempts is
  'Every submission. failed_on = hidden means the query only worked on the data they could see.';

create index if not exists sql_attempts_user_idx on public.sql_attempts (user_id, created_at desc);
create index if not exists sql_attempts_solved_idx
  on public.sql_attempts (user_id, exercise_id) where correct;

alter table public.sql_attempts enable row level security;
drop policy if exists "own sql attempts" on public.sql_attempts;
create policy "own sql attempts" on public.sql_attempts for select using (user_id = auth.uid());
drop policy if exists "staff read sql attempts" on public.sql_attempts;
create policy "staff read sql attempts" on public.sql_attempts for select using (public.is_admin());
revoke all on public.sql_attempts from anon, authenticated;
grant select on public.sql_attempts to authenticated;
grant select, insert, update, delete on public.sql_attempts to service_role;
