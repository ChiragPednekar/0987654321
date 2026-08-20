-- Bookmarks, the university registry, and structured answer sections.

-- ---------------------------------------------------------------------------
-- Bookmarks: save a case for later.
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  user_id    uuid not null references public.users(id) on delete cascade,
  case_id    uuid not null references public.cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, case_id)
);

create index if not exists bookmarks_user_idx on public.bookmarks(user_id, created_at desc);

alter table public.bookmarks enable row level security;

create policy "own bookmarks are readable" on public.bookmarks
  for select using (auth.uid() = user_id);
create policy "own bookmarks are insertable" on public.bookmarks
  for insert with check (auth.uid() = user_id);
create policy "own bookmarks are deletable" on public.bookmarks
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Universities: a registry with email domains, so campus boards can later be
-- verified rather than self-reported.
-- ---------------------------------------------------------------------------
create table if not exists public.universities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text,
  domain      text unique,          -- e.g. 'iimb.ac.in'; null until known
  country     text default 'India',
  created_at  timestamptz not null default now()
);

create index if not exists universities_domain_idx on public.universities(domain);

alter table public.universities enable row level security;

create policy "universities are public" on public.universities
  for select using (true);
create policy "admins manage universities" on public.universities
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Structured answers.
--
-- `answer` stays the canonical text the grader reads, so the whole evaluation
-- path is unchanged. When a student uses the structured editor, the individual
-- sections are kept here too, which is what lets feedback and history show the
-- parts separately rather than re-splitting prose.
-- ---------------------------------------------------------------------------
alter table public.submissions
  add column if not exists answer_sections jsonb not null default '{}'::jsonb;

comment on column public.submissions.answer_sections is
  'Structured answer parts (framework/analysis/recommendation). Empty when the student wrote free text.';

grant select, insert, delete on public.bookmarks to authenticated;
grant select on public.universities to anon, authenticated;
