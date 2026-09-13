-- ============================================================================
-- CaseCode — Excel exercises
-- ============================================================================
-- The other half of the analytics round. SQL (20250101000045) is asked of
-- people going into data roles; Excel is asked of nearly everyone else, and it
-- is the one skill a finance or operations interviewer will actually test at
-- the desk.
--
-- HOW A FORMULA IS MARKED
--
-- By evaluating it, not by reading it. src/lib/excel/runner.ts parses the
-- formula and computes it against the exercise's grid, so SUMIFS(...) and
-- SUMIF(...) and a hand-rolled SUMPRODUCT all score the same if they produce
-- the same number — which is correct, because they are the same answer.
--
-- Marking by string match would have been far less code and would have been
-- wrong: it would fail a student for writing the ranges in a different order,
-- and pass one who typed the reference formula without understanding it.
--
-- THE SECOND GRID IS THE WHOLE DESIGN
--
-- Same hole as SQL, worse here: the answer to "total units sold in the West"
-- is a single number, and a student can read it off the screen and type it in.
-- Comparing values on one grid cannot tell 17 from SUMIFS(...)=17.
--
-- So every exercise carries a second grid with the same columns and different
-- numbers, and a submission is marked on both. A formula answers both; a typed
-- constant answers the first and fails the second. That is why hidden_grid and
-- solution_formula are withheld by COLUMN GRANT rather than by RLS — the row
-- has to be readable for the visible grid and the prompt to load at all, and a
-- row policy cannot hide a column inside a row you are allowed to read.
--
-- The seeder enforces the other half: it evaluates every reference formula on
-- both grids, refuses an exercise whose answer is the same on both (which
-- would make the check useless), and runs a hardcoded control to prove the
-- second grid actually discriminates.
--
-- WHY THERE IS AN ALLOW-LIST
--
-- The evaluator is two libraries stitched together, and they disagree about
-- argument shape in ways that fail silently rather than loudly: COUNTIFS
-- returned 1 where Excel returns 2, and SUMIF returned 0, with no error in
-- either case. So a function is offered to students only once a test pins it
-- to a hand-computed Excel value. The list shown beside the grid is that same
-- ALLOWED set in src/lib/excel/functions.ts rather than a column, so what a
-- student is told they may use cannot drift from what the marker accepts.
-- ============================================================================

create table if not exists public.excel_exercises (
  id      uuid primary key default gen_random_uuid(),
  slug    text unique not null,
  title   text not null,
  prompt  text not null,
  topic   text not null default 'lookup',
  difficulty public.difficulty not null default 'medium',

  -- Shown to the student: the grid they can see, as an array of rows.
  grid jsonb not null,
  -- What the answer cell is called in the prompt, e.g. "H2".
  answer_label text not null default 'the answer cell',

  -- Never granted below.
  hidden_grid       jsonb not null,
  solution_formula  text not null,

  /**
   * Rounding is part of some answers ("to the nearest rupee") and not part of
   * others. Where the question does not ask for it, a tolerance keeps an
   * honest formula from failing on float drift.
   */
  tolerance numeric not null default 0.000001 check (tolerance >= 0),

  hint text,

  is_published boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.excel_exercises is
  'Excel exercises. solution_formula and hidden_grid are never granted to clients.';

create index if not exists excel_exercises_order_idx
  on public.excel_exercises (sort_order) where is_published;

alter table public.excel_exercises enable row level security;

drop policy if exists "published excel exercises readable" on public.excel_exercises;
create policy "published excel exercises readable" on public.excel_exercises
  for select using (is_published);
drop policy if exists "admins manage excel exercises" on public.excel_exercises;
create policy "admins manage excel exercises" on public.excel_exercises
  for all using (public.is_admin()) with check (public.is_admin());

-- Note the two absent columns. Same technique as the answer key on
-- objective_questions (20250101000037), the counterparty's hand on
-- negotiation_cases (20250101000043) and the solution on sql_exercises.
revoke all on public.excel_exercises from anon, authenticated;
grant select (id, slug, title, prompt, topic, difficulty, grid, answer_label,
              tolerance, hint, is_published, sort_order, created_at)
  on public.excel_exercises to authenticated;
grant select, insert, update, delete on public.excel_exercises to service_role;

create table if not exists public.excel_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  exercise_id uuid not null references public.excel_exercises(id) on delete cascade,
  formula     text not null,
  correct     boolean not null,
  -- 'hidden' is the interesting one: the formula was right on the numbers the
  -- student could see and wrong on the ones they could not, which is what a
  -- typed-in constant looks like.
  failed_on   text check (failed_on in ('visible', 'hidden', 'error', 'refused')),
  created_at  timestamptz not null default now()
);

comment on table public.excel_attempts is
  'Every submission. failed_on = hidden means the answer was typed in rather than computed.';

create index if not exists excel_attempts_user_idx
  on public.excel_attempts (user_id, created_at desc);
create index if not exists excel_attempts_solved_idx
  on public.excel_attempts (user_id, exercise_id) where correct;

alter table public.excel_attempts enable row level security;
drop policy if exists "own excel attempts" on public.excel_attempts;
create policy "own excel attempts" on public.excel_attempts for select using (user_id = auth.uid());
drop policy if exists "staff read excel attempts" on public.excel_attempts;
create policy "staff read excel attempts" on public.excel_attempts for select using (public.is_admin());
revoke all on public.excel_attempts from anon, authenticated;
grant select on public.excel_attempts to authenticated;
grant select, insert, update, delete on public.excel_attempts to service_role;
