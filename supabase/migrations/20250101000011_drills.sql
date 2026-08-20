-- Drills: timed quantitative sprints (spec §6d).
--
-- Graded arithmetically against a tolerance band rather than by the AI:
-- instant, free, and perfectly repeatable — the right trade-off for mental
-- maths, and the opposite of the one case grading makes.

create table if not exists public.drill_questions (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases(id) on delete cascade,
  position      integer not null check (position > 0),
  prompt        text not null check (length(trim(prompt)) > 0),
  expected      numeric not null,
  tolerance_pct numeric not null default 5 check (tolerance_pct >= 0 and tolerance_pct <= 100),
  unit          text,
  explanation   text,
  created_at    timestamptz not null default now(),
  unique (case_id, position)
);
create index if not exists drill_questions_case_idx
  on public.drill_questions(case_id, position);
alter table public.drill_questions enable row level security;
create policy "drill questions are public" on public.drill_questions
  for select using (true);
create policy "admins manage drill questions" on public.drill_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- `expected` and `explanation` are withheld by column grant, exactly as hint
-- bodies are: the policy above is row-level, so without this the answers would
-- be one REST call away and the drill pointless.
revoke select on public.drill_questions from anon, authenticated;
grant select (id, case_id, position, prompt, tolerance_pct, unit, created_at)
  on public.drill_questions to anon, authenticated;

create table if not exists public.drill_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  case_id          uuid not null references public.cases(id) on delete cascade,
  answers          jsonb not null default '{}'::jsonb,
  correct          integer not null default 0,
  total            integer not null default 0,
  duration_seconds integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists drill_attempts_user_idx
  on public.drill_attempts(user_id, created_at desc);
alter table public.drill_attempts enable row level security;
create policy "own drill attempts are readable" on public.drill_attempts
  for select using (auth.uid() = user_id);
grant select on public.drill_attempts to authenticated;
