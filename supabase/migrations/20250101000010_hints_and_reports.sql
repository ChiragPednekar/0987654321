-- Progressive hints, hint reveals, and crowd-sourced case reports.

create table if not exists public.case_hints (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  step        integer not null check (step > 0),
  body        text not null check (length(trim(body)) > 0),
  penalty_pct integer not null default 10 check (penalty_pct between 0 and 50),
  created_at  timestamptz not null default now(),
  unique (case_id, step)
);
create index if not exists case_hints_case_idx on public.case_hints(case_id, step);
alter table public.case_hints enable row level security;
create policy "hints are public" on public.case_hints for select using (true);
create policy "admins manage hints" on public.case_hints
  for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.hint_reveals (
  user_id     uuid not null references public.users(id) on delete cascade,
  hint_id     uuid not null references public.case_hints(id) on delete cascade,
  case_id     uuid not null references public.cases(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (user_id, hint_id)
);
create index if not exists hint_reveals_user_case_idx
  on public.hint_reveals(user_id, case_id);
alter table public.hint_reveals enable row level security;
create policy "own reveals are readable" on public.hint_reveals
  for select using (auth.uid() = user_id);
create policy "own reveals are insertable" on public.hint_reveals
  for insert with check (auth.uid() = user_id);

do $$ begin
  create type case_report_type as enum
    ('wrong_rubric','ambiguous_prompt','data_error','other');
exception when duplicate_object then null; end $$;

create table if not exists public.case_reports (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  type        case_report_type not null default 'other',
  description text not null check (length(trim(description)) between 10 and 1000),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists case_reports_open_idx
  on public.case_reports(created_at desc) where not resolved;
alter table public.case_reports enable row level security;
create policy "own reports are readable" on public.case_reports
  for select using (auth.uid() = user_id or public.is_admin());
create policy "own reports are insertable" on public.case_reports
  for insert with check (auth.uid() = user_id);
create policy "admins resolve reports" on public.case_reports
  for update using (public.is_admin()) with check (public.is_admin());

grant select, insert on public.hint_reveals to authenticated;
grant select, insert on public.case_reports to authenticated;

-- Hint bodies must not be readable over the API.
--
-- The policy above is row-level, so it would expose `body` to anyone with the
-- anon key — a student could read every hint from the REST endpoint and never
-- pay the score penalty. RLS cannot express "these columns but not that one",
-- so this is a column-level grant, matching 20250101000004_column_privileges.
--
-- Metadata stays readable so the locked hint list can render. Bodies are
-- served only by /api/hints/reveal, which uses the service role and records
-- the reveal first.
revoke select on public.case_hints from anon, authenticated;
grant select (id, case_id, step, penalty_pct, created_at)
  on public.case_hints to anon, authenticated;
