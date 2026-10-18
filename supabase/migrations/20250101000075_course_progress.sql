-- ============================================================================
-- CaseCode — prep courses before certificate exams
-- ============================================================================
-- Each certificate exam now has a prep course (src/lib/cert-courses.ts). A
-- student must pass every module's knowledge check before an exam attempt can
-- be bought or started (src/lib/course-progress.ts). Progress lives here, on
-- the server: it used to be a localStorage tick the student set themselves,
-- which unlocked nothing and proved nothing.
--
-- It also moves two exams off cases the courses recommend as PRACTICE. The
-- consulting and product courses pointed students at the exact cases their
-- exam used (market-entry-1, operations-capacity-1; prioritization-1,
-- product-launch-1), which would have handed out the exam. The new cases are
-- the same kind and difficulty and appear in no course. An attempt already
-- under way keeps whatever its page has loaded; new attempts get the new cases.
-- ============================================================================

create table if not exists public.course_progress (
  user_id    uuid not null references public.users (id) on delete cascade,
  exam_slug  text not null,
  module_id  text not null,
  correct    integer not null default 0,
  total      integer not null default 0,
  passed     boolean not null default false,
  attempts   integer not null default 0,
  passed_at  timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, exam_slug, module_id)
);

comment on table public.course_progress is
  'Per-module knowledge-check results for the certificate prep courses (075). passed never reverts.';

alter table public.course_progress enable row level security;
revoke all on public.course_progress from public, anon, authenticated;
grant select, insert, update, delete on public.course_progress to service_role;

update public.cert_exams e
   set case_ids = array(select c.id from public.cases c
                         where c.slug in ('market-entry-10', 'operations-capacity-3')
                         order by c.slug)
 where e.slug = 'consulting-case-certificate'
   and (select count(*) from public.cases c where c.slug in ('market-entry-10', 'operations-capacity-3')) = 2;

update public.cert_exams e
   set case_ids = array(select c.id from public.cases c
                         where c.slug in ('prioritization-11', 'product-launch-10')
                         order by c.slug)
 where e.slug = 'product-marketing-certificate'
   and (select count(*) from public.cases c where c.slug in ('prioritization-11', 'product-launch-10')) = 2;
