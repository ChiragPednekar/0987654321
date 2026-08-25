-- ============================================================================
-- CaseCode — faculty review: submissions, marks and remarks
-- ============================================================================
-- Classrooms already had groups, join codes and assignments. What was missing
-- is the half that makes it a course rather than a reading list: seeing who
-- actually submitted, and marking it.
--
-- The design decision worth recording: a student does not submit *to the
-- faculty* separately. They solve the case the normal way, the AI grades it
-- instantly as it does for everyone, and a trigger attaches that submission to
-- any open assignment for that case in a classroom they belong to.
--
-- One submission, two readers. The student is not made to do the work twice,
-- the AI feedback arrives in seconds rather than whenever the faculty gets to
-- it, and the faculty mark sits alongside as the one that counts for the
-- course. A separate "submit to faculty" step would have doubled the work and
-- delayed the feedback that actually drives improvement.
-- ============================================================================

-- What the faculty marks out of. Null means the assignment is practice only
-- and carries no marks — a legitimate and common case.
alter table public.classroom_assignments
  add column if not exists max_marks numeric(6,2)
    check (max_marks is null or max_marks > 0);

do $$ begin
  create type public.assignment_status as enum ('submitted', 'reviewed');
exception when duplicate_object then null; end $$;

create table if not exists public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.classroom_assignments(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  -- The student's actual attempt. Nullable so a row survives if the submission
  -- is ever removed; the mark a teacher gave should not vanish with it.
  submission_id uuid references public.submissions(id) on delete set null,
  status        public.assignment_status not null default 'submitted',
  submitted_at  timestamptz not null default now(),
  is_late       boolean not null default false,

  faculty_marks   numeric(6,2) check (faculty_marks is null or faculty_marks >= 0),
  faculty_remarks text,
  reviewed_by     uuid references public.users(id) on delete set null,
  reviewed_at     timestamptz,

  -- One row per student per assignment. A resubmission updates the attempt
  -- rather than stacking, so the faculty marks one thing.
  unique (assignment_id, user_id)
);
create index if not exists assignment_submissions_assignment_idx
  on public.assignment_submissions(assignment_id, submitted_at desc);
create index if not exists assignment_submissions_user_idx
  on public.assignment_submissions(user_id);
alter table public.assignment_submissions enable row level security;

create policy "students read their own, teachers read the class"
  on public.assignment_submissions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.classroom_assignments a
      where a.id = assignment_submissions.assignment_id
        and public.is_classroom_teacher(a.classroom_id)
    )
  );

grant select on public.assignment_submissions to authenticated;
-- Marks are written by the review route after an explicit teacher check. A
-- student who could write here could mark their own work.
revoke insert, update, delete on public.assignment_submissions
  from anon, authenticated;

-- ------------------------------------------------------- auto-attachment ---
/**
 * Attach a new submission to any open assignment for the same case, in any
 * classroom the student belongs to.
 *
 * Runs on the submission itself rather than on the score, so an assignment
 * registers as submitted the moment the student hands it in — even if grading
 * later fails. The teacher should see "submitted, not yet graded" rather than
 * nothing at all.
 */
create or replace function public.attach_submission_to_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.assignment_submissions
    (assignment_id, user_id, submission_id, submitted_at, is_late)
  select
    a.id,
    new.user_id,
    new.id,
    now(),
    a.due_at is not null and now() > a.due_at
  from public.classroom_assignments a
  join public.classroom_members m
    on m.classroom_id = a.classroom_id
   and m.user_id = new.user_id
   and m.role = 'student'
  where a.case_id = new.case_id
  on conflict (assignment_id, user_id) do update
    set submission_id = excluded.submission_id,
        submitted_at  = excluded.submitted_at,
        is_late       = excluded.is_late,
        -- A resubmission reopens the review. Leaving it marked 'reviewed'
        -- against a newer answer would show the teacher a stale verdict.
        status        = 'submitted',
        faculty_marks = null,
        faculty_remarks = null,
        reviewed_by   = null,
        reviewed_at   = null;

  return new;
end;
$$;

drop trigger if exists submissions_attach_assignments on public.submissions;
create trigger submissions_attach_assignments
  after insert on public.submissions
  for each row execute function public.attach_submission_to_assignments();

-- ------------------------------------------------------------- rollups ----
/**
 * The review queue for one assignment: every enrolled student, whether they
 * submitted, what the AI said, and what the teacher has marked.
 *
 * Left join from the roster rather than from submissions, so students who have
 * NOT submitted appear. Those are the rows a teacher most needs to see, and an
 * inner join would silently hide exactly them.
 */
create or replace function public.assignment_review_queue(p_assignment uuid)
returns table (
  user_id         uuid,
  full_name       text,
  email           text,
  submission_id   uuid,
  answer          text,
  submitted_at    timestamptz,
  is_late         boolean,
  status          public.assignment_status,
  ai_score        integer,
  ai_max          integer,
  ai_percentage   numeric,
  faculty_marks   numeric,
  faculty_remarks text,
  reviewed_at     timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    u.id, u.full_name, u.email,
    asub.submission_id,
    s.answer,
    asub.submitted_at,
    coalesce(asub.is_late, false),
    asub.status,
    sc.total_score, sc.max_score, sc.percentage,
    asub.faculty_marks, asub.faculty_remarks, asub.reviewed_at
  from public.classroom_assignments a
  join public.classroom_members m
    on m.classroom_id = a.classroom_id and m.role = 'student'
  join public.users u on u.id = m.user_id
  left join public.assignment_submissions asub
    on asub.assignment_id = a.id and asub.user_id = u.id
  left join public.submissions s on s.id = asub.submission_id
  left join public.scores sc on sc.submission_id = asub.submission_id
  where a.id = p_assignment
  -- Unsubmitted first: they are the ones needing a nudge.
  order by asub.submitted_at asc nulls first, u.full_name;
$$;
revoke execute on function public.assignment_review_queue(uuid)
  from public, anon, authenticated;

/** Per-assignment counts for the teacher's classroom view. */
create or replace function public.classroom_assignment_stats(p_classroom uuid)
returns table (
  assignment_id uuid,
  enrolled      bigint,
  submitted     bigint,
  reviewed      bigint,
  avg_ai        numeric,
  avg_marks     numeric
)
language sql stable security definer set search_path = public, pg_temp as $$
  with roster as (
    select count(*) as n from public.classroom_members
    where classroom_id = p_classroom and role = 'student'
  )
  select
    a.id,
    (select n from roster),
    count(asub.id),
    count(asub.id) filter (where asub.status = 'reviewed'),
    round(avg(sc.percentage), 1),
    round(avg(asub.faculty_marks), 1)
  from public.classroom_assignments a
  left join public.assignment_submissions asub on asub.assignment_id = a.id
  left join public.scores sc on sc.submission_id = asub.submission_id
  where a.classroom_id = p_classroom
  group by a.id;
$$;
revoke execute on function public.classroom_assignment_stats(uuid)
  from public, anon, authenticated;
