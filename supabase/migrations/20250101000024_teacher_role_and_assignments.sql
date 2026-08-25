-- ============================================================================
-- CaseCode — teacher role, richer assignments, full review lifecycle
-- ============================================================================
-- Three related changes, kept in one migration because the assignment columns
-- are meaningless without the role that manages them.
--
-- 1. THE TEACHER ROLE
--
-- `user_role` was student / admin / recruiter. Teaching was purely per-
-- classroom: anyone could create a batch and become its teacher. That is a fine
-- scoping mechanism but it is not a platform role, so there was no way to say
-- "this account is a teacher" or to gate a teacher area.
--
-- Both now exist and do different jobs, deliberately:
--
--   users.role = 'teacher'          -- may open /teacher at all
--   classroom_members.role='teacher'-- which batches they may act on
--
-- The platform role alone would let any teacher open any other teacher's
-- batch; the membership alone gives no way to gate the section. Authorization
-- checks both.
--
-- 2. ASSIGNMENTS AS FIRST-CLASS OBJECTS
--
-- classroom_assignments was a pointer to a case plus a due date. An assignment
-- needs its own identity: teachers set the same case for different batches with
-- different instructions, and a draft must be editable before students see it.
--
-- 3. THE FULL REVIEW LIFECYCLE
--
-- assignment_status was submitted / reviewed. Two states cannot express "the AI
-- has graded it but I have not looked yet" or "I sent this back for a redo",
-- which are exactly the states a teacher filters on.
-- ============================================================================

-- ------------------------------------------------------------ 1. role ------

do $$ begin
  alter type public.user_role add value if not exists 'teacher';
exception when duplicate_object then null; end $$;

-- --------------------------------------------------- 2. assignment fields --

alter table public.classroom_assignments
  add column if not exists title            text,
  add column if not exists instructions     text,
  add column if not exists starts_at        timestamptz,
  add column if not exists allow_resubmission boolean not null default true,
  add column if not exists max_attempts     integer
    check (max_attempts is null or max_attempts > 0),
  -- Drafts are invisible to students. Nothing is published by accident.
  add column if not exists is_published     boolean not null default true,
  add column if not exists created_by       uuid references public.users(id) on delete set null,
  add column if not exists updated_at       timestamptz not null default now();

-- A case could previously be assigned to a batch only once, because the unique
-- key was (classroom_id, case_id). Two assignments of the same case -- a first
-- attempt and a revision later in term -- is normal, so the constraint moves to
-- the row's own identity.
alter table public.classroom_assignments
  drop constraint if exists classroom_assignments_classroom_id_case_id_key;

-- Students must not see drafts. The previous policy exposed every row to every
-- member of the batch.
drop policy if exists "members read assignments" on public.classroom_assignments;
create policy "members read published assignments"
  on public.classroom_assignments
  for select using (
    public.is_classroom_teacher(classroom_id)
    or (is_published and public.is_classroom_member(classroom_id))
  );

-- ------------------------------------------------- 3. review lifecycle ----
-- Postgres cannot add enum values inside a transaction that then uses them, and
-- these are needed by the same deployment, so the column moves to text with a
-- check constraint instead. The set is small, stable and readable in queries.

alter table public.assignment_submissions
  add column if not exists attempt_number integer not null default 1
    check (attempt_number > 0),
  add column if not exists returned_at timestamptz;

alter table public.assignment_submissions
  alter column status type text using status::text;

alter table public.assignment_submissions
  alter column status set default 'submitted';

alter table public.assignment_submissions
  drop constraint if exists assignment_submissions_status_check;

alter table public.assignment_submissions
  add constraint assignment_submissions_status_check check (status in (
    'submitted',               -- handed in, AI has not finished
    'ai_graded',               -- AI score exists, teacher has not looked
    'reviewed',                -- teacher marked and returned it
    'resubmission_requested'   -- sent back for another attempt
  ));

-- ------------------------------------------- attachment trigger, updated ---
/**
 * Attach a submission to the open assignments for its case.
 *
 * Extended from 20250101000023: skips unpublished assignments and ones that
 * have not started, counts attempts, and refuses a further attempt once the
 * teacher's limit is reached — enforced here rather than in the route, because
 * the route is not the only thing that can insert a submission.
 */
create or replace function public.attach_submission_to_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.assignment_submissions
    (assignment_id, user_id, submission_id, submitted_at, is_late, attempt_number, status)
  select
    a.id,
    new.user_id,
    new.id,
    now(),
    a.due_at is not null and now() > a.due_at,
    coalesce(prev.attempt_number, 0) + 1,
    'submitted'
  from public.classroom_assignments a
  join public.classroom_members m
    on m.classroom_id = a.classroom_id
   and m.user_id = new.user_id
   and m.role = 'student'
  left join public.assignment_submissions prev
    on prev.assignment_id = a.id and prev.user_id = new.user_id
  where a.case_id = new.case_id
    and a.is_published
    and (a.starts_at is null or a.starts_at <= now())
    -- A first attempt always lands. A repeat needs resubmission allowed and
    -- room under the cap.
    and (
      prev.id is null
      or (
        a.allow_resubmission
        and (a.max_attempts is null or prev.attempt_number < a.max_attempts)
      )
    )
  on conflict (assignment_id, user_id) do update
    set submission_id   = excluded.submission_id,
        submitted_at    = excluded.submitted_at,
        is_late         = excluded.is_late,
        attempt_number  = excluded.attempt_number,
        status          = 'submitted',
        faculty_marks   = null,
        faculty_remarks = null,
        reviewed_by     = null,
        reviewed_at     = null,
        returned_at     = null;

  return new;
end;
$$;

/**
 * Move an assignment submission to 'ai_graded' when its score lands.
 *
 * Separate from the attachment trigger because grading finishes later, and a
 * teacher filtering for "ready to mark" wants the ones the AI has finished
 * with — not everything that has been handed in.
 */
create or replace function public.mark_assignment_ai_graded()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.assignment_submissions
     set status = 'ai_graded'
   where submission_id = new.submission_id
     -- Never walk backwards over a teacher's verdict.
     and status = 'submitted';
  return new;
end;
$$;

drop trigger if exists scores_mark_assignment_graded on public.scores;
create trigger scores_mark_assignment_graded
  after insert on public.scores
  for each row execute function public.mark_assignment_ai_graded();
