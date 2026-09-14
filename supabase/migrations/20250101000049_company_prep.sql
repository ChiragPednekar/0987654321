-- ============================================================================
-- CaseCode — company-specific prep
-- ============================================================================
-- A page per firm: how its process usually runs, what it tends to look for, and
-- links straight into the practice on this platform that matches. Plus the one
-- thing no profile can supply — questions students were actually asked.
--
-- PROFILES ARE GUIDANCE, NOT CLAIMS
--
-- The profiles are written from widely reported, stable descriptions of each
-- firm's campus process and say so on the page. They name no cut-offs, pay or
-- quotas, which change every year and would be wrong by the next placement
-- season. CaseCode is not affiliated with any firm listed (see the Terms).
--
-- REPORTED QUESTIONS ARE NEVER INVENTED, AND NEVER UNMODERATED
--
-- "What McKinsey asks" is only worth reading if a real candidate was asked it.
-- So every question on a company page comes from a student who reports it,
-- with the role, round and year, and appears only once an admin approves it.
-- Nothing is seeded into this table.
--
-- The reporter is never shown. user_id exists for rate limiting and for
-- showing a student their own pending reports, and it is withheld from clients
-- by column grant, so another student cannot find out who reported what — a
-- candidate who shares a question should not have to worry about the firm
-- reading their name next to it.
-- ============================================================================

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  sector      text not null check (sector in ('Consulting', 'FMCG', 'Banking & finance', 'Technology', 'Conglomerate')),
  roles       text[] not null default '{}',
  summary     text not null,
  -- [{name, detail}] — the usual stages, in order.
  rounds      jsonb not null default '[]'::jsonb,
  look_for    text[] not null default '{}',
  -- [{label, href, why}] — internal links only, validated by the seeder.
  practice    jsonb not null default '[]'::jsonb,
  reviewed_on date not null,
  is_published boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.companies enable row level security;
drop policy if exists "published companies readable" on public.companies;
create policy "published companies readable" on public.companies
  for select to authenticated using (is_published);
revoke all on public.companies from anon, authenticated;
grant select on public.companies to authenticated;
grant select, insert, update, delete on public.companies to service_role;

create table if not exists public.company_question_reports (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- Set null, not cascade: an approved question outlives the account that
  -- reported it. It was a real question either way.
  user_id     uuid references public.users(id) on delete set null,
  role        text not null check (char_length(role) between 2 and 80),
  round       text not null check (round in ('online_test', 'group_discussion', 'case_interview', 'technical', 'personal_interview', 'hr', 'other')),
  year        smallint not null check (year between 2018 and 2100),
  question    text not null check (char_length(question) between 15 and 1000),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.company_question_reports is
  'Interview questions reported by students. Shown only once approved; the reporter is never exposed.';

create index if not exists company_reports_company_idx
  on public.company_question_reports (company_id, status, year desc);
create index if not exists company_reports_pending_idx
  on public.company_question_reports (created_at) where status = 'pending';
create index if not exists company_reports_user_idx
  on public.company_question_reports (user_id, created_at desc);

alter table public.company_question_reports enable row level security;

drop policy if exists "approved or own reports" on public.company_question_reports;
create policy "approved or own reports" on public.company_question_reports
  for select to authenticated using (status = 'approved' or user_id = auth.uid());

-- Created through /api/companies/[slug]/reports and moderated through the admin
-- route, both as the service role. user_id, review_note and reviewed_by are
-- absent from the grant.
revoke all on public.company_question_reports from anon, authenticated;
grant select (id, company_id, role, round, year, question, status, created_at)
  on public.company_question_reports to authenticated;
grant select, insert, update, delete on public.company_question_reports to service_role;
