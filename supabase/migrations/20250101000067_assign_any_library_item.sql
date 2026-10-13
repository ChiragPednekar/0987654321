-- ============================================================================
-- CaseCode — teachers assign anything in the library, and write their own
-- ============================================================================
-- Until now an assignment was a case and nothing else: `case_id not null`.
-- Teachers could see the Aptitude, SQL and Excel libraries but could not set
-- any of it for their batch. This widens an assignment to four kinds:
--
--   case      a case (or a teacher's own written question) — unchanged
--   sql       one SQL exercise; handed in by solving it
--   excel     one Excel exercise; handed in by solving it
--   aptitude  a quiz of hand-picked aptitude questions, marked on submit
--
-- Learning paths are not a kind. Adding a path to a batch creates one case
-- assignment per step, so a path's cases are graded, reviewed and marked
-- through the same machinery as any other case.
--
-- Hand-in works the way cases already do: a database trigger attaches the
-- student's attempt to every matching published assignment in the batches
-- they belong to. Nothing in the student's flow changes — they solve the
-- exercise the normal way and it lands with their teacher.
-- ============================================================================

-- ------------------------------------------------------- 1. assignment kinds --

alter table public.classroom_assignments
  alter column case_id drop not null;

alter table public.classroom_assignments
  add column if not exists kind              text not null default 'case',
  add column if not exists sql_exercise_id   uuid references public.sql_exercises(id) on delete cascade,
  add column if not exists excel_exercise_id uuid references public.excel_exercises(id) on delete cascade,
  add column if not exists question_ids      uuid[];

-- Exactly one target, and the right one for the kind. Without this a row could
-- point at a case and an exercise at once, and every reader would have to
-- guess which one the teacher meant.
alter table public.classroom_assignments
  drop constraint if exists classroom_assignments_kind_target;
alter table public.classroom_assignments
  add constraint classroom_assignments_kind_target check (
    (kind = 'case'
      and case_id is not null and sql_exercise_id is null
      and excel_exercise_id is null and question_ids is null)
    or (kind = 'sql'
      and sql_exercise_id is not null and case_id is null
      and excel_exercise_id is null and question_ids is null)
    or (kind = 'excel'
      and excel_exercise_id is not null and case_id is null
      and sql_exercise_id is null and question_ids is null)
    or (kind = 'aptitude'
      and question_ids is not null
      and cardinality(question_ids) between 1 and 50
      and case_id is null and sql_exercise_id is null and excel_exercise_id is null)
  );

create index if not exists classroom_assignments_sql_idx
  on public.classroom_assignments (sql_exercise_id) where sql_exercise_id is not null;
create index if not exists classroom_assignments_excel_idx
  on public.classroom_assignments (excel_exercise_id) where excel_exercise_id is not null;

-- ------------------------------------------- 2. what a hand-in points at --

alter table public.assignment_submissions
  add column if not exists sql_attempt_id       uuid references public.sql_attempts(id) on delete set null,
  add column if not exists excel_attempt_id     uuid references public.excel_attempts(id) on delete set null,
  add column if not exists objective_session_id uuid references public.objective_sessions(id) on delete set null,
  -- Marked by the platform, not by a model: correct answers out of the total
  -- for a quiz, 1 out of 1 for a solved exercise. The faculty mark, when
  -- given, still sits in faculty_marks and is the one that counts.
  add column if not exists auto_score numeric(6,2),
  add column if not exists auto_max   numeric(6,2);

-- An assigned quiz is sat as its own session, so the session has to know
-- which assignment it belongs to.
alter table public.objective_sessions
  add column if not exists assignment_id uuid
    references public.classroom_assignments(id) on delete set null;

create index if not exists objective_sessions_assignment_idx
  on public.objective_sessions (assignment_id, user_id) where assignment_id is not null;

-- ------------------------------------------------- 3. attach on hand-in --

-- A solved SQL or Excel exercise is handed in once: the first correct answer.
-- Later correct answers change nothing, so a mark already given cannot be
-- wiped by the student running the query again.
create or replace function public.attach_exercise_to_assignments()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_kind text := tg_argv[0];
  v_tries integer;
begin
  if not new.correct then
    return new;
  end if;

  if v_kind = 'sql' then
    select count(*) into v_tries from public.sql_attempts
     where user_id = new.user_id and exercise_id = new.exercise_id;
  else
    select count(*) into v_tries from public.excel_attempts
     where user_id = new.user_id and exercise_id = new.exercise_id;
  end if;

  insert into public.assignment_submissions
    (assignment_id, user_id, sql_attempt_id, excel_attempt_id,
     submitted_at, is_late, attempt_number, status, auto_score, auto_max)
  select
    a.id,
    new.user_id,
    case when v_kind = 'sql' then new.id end,
    case when v_kind = 'excel' then new.id end,
    now(),
    a.due_at is not null and now() > a.due_at,
    greatest(v_tries, 1),
    'submitted',
    1,
    1
  from public.classroom_assignments a
  join public.classroom_members m
    on m.classroom_id = a.classroom_id
   and m.user_id = new.user_id
   and m.role = 'student'
  where a.kind = v_kind
    and (
      (v_kind = 'sql' and a.sql_exercise_id = new.exercise_id)
      or (v_kind = 'excel' and a.excel_exercise_id = new.exercise_id)
    )
    and a.is_published
    and (a.starts_at is null or a.starts_at <= now())
  on conflict (assignment_id, user_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists sql_attempts_attach_assignments on public.sql_attempts;
create trigger sql_attempts_attach_assignments
  after insert on public.sql_attempts
  for each row execute function public.attach_exercise_to_assignments('sql');

drop trigger if exists excel_attempts_attach_assignments on public.excel_attempts;
create trigger excel_attempts_attach_assignments
  after insert on public.excel_attempts
  for each row execute function public.attach_exercise_to_assignments('excel');

-- An assigned quiz is handed in when its session is submitted. Resubmission
-- follows the assignment's rules, as for cases: a retake replaces the last
-- hand-in only if resubmission is allowed and the attempt cap is not reached,
-- and a replaced hand-in loses its faculty mark, which was for the old answer.
create or replace function public.attach_quiz_to_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.assignment_id is null
     or new.submitted_at is null
     or old.submitted_at is not null then
    return new;
  end if;

  insert into public.assignment_submissions
    (assignment_id, user_id, objective_session_id, submitted_at, is_late,
     attempt_number, status, auto_score, auto_max)
  select
    a.id,
    new.user_id,
    new.id,
    new.submitted_at,
    a.due_at is not null and new.submitted_at > a.due_at,
    coalesce(prev.attempt_number, 0) + 1,
    'submitted',
    new.correct_count,
    new.total
  from public.classroom_assignments a
  join public.classroom_members m
    on m.classroom_id = a.classroom_id
   and m.user_id = new.user_id
   and m.role = 'student'
  left join public.assignment_submissions prev
    on prev.assignment_id = a.id and prev.user_id = new.user_id
  where a.id = new.assignment_id
    and a.kind = 'aptitude'
    and a.is_published
    and (
      prev.id is null
      or (
        a.allow_resubmission
        and (a.max_attempts is null or prev.attempt_number < a.max_attempts)
      )
    )
  on conflict (assignment_id, user_id) do update
    set objective_session_id = excluded.objective_session_id,
        submitted_at         = excluded.submitted_at,
        is_late              = excluded.is_late,
        attempt_number       = excluded.attempt_number,
        auto_score           = excluded.auto_score,
        auto_max             = excluded.auto_max,
        status               = 'submitted',
        faculty_marks        = null,
        faculty_remarks      = null,
        reviewed_by          = null,
        reviewed_at          = null,
        returned_at          = null;

  return new;
end;
$function$;

drop trigger if exists objective_sessions_attach_assignment on public.objective_sessions;
create trigger objective_sessions_attach_assignment
  after update of submitted_at on public.objective_sessions
  for each row execute function public.attach_quiz_to_assignment();

-- Trigger functions do not belong on the RPC surface (see 066). Triggers fire
-- without EXECUTE, so revoking it costs nothing.
revoke execute on function public.attach_exercise_to_assignments() from public, anon, authenticated;
revoke execute on function public.attach_quiz_to_assignment() from public, anon, authenticated;

-- ------------------------------ 4. a teacher's question, in any of their batches --

-- A teacher may now write a question without choosing a batch first; it then
-- belongs to them alone (owner_classroom_id null) and can be assigned to any
-- batch they teach. Students in that batch must be able to read it — before,
-- only the question's own batch could. A published assignment of the case in
-- a batch the student belongs to is the grant.
drop policy if exists "published cases are public" on public.cases;
create policy "published cases are public" on public.cases
  for select using (
    is_admin()
    or (
      is_published
      and (
        visibility = 'platform'
        or created_by = auth.uid()
        or (owner_classroom_id is not null and is_classroom_member(owner_classroom_id))
        or exists (
          select 1 from public.classroom_assignments a
          where a.case_id = cases.id and a.is_published and a.is_public
        )
        or exists (
          select 1 from public.classroom_assignments a
          where a.case_id = cases.id
            and a.is_published
            and is_classroom_member(a.classroom_id)
        )
      )
    )
  );

-- Aptitude questions a teacher writes stay unpublished — out of the public
-- practice pool, served only inside their own quizzes by the service role.
create index if not exists objective_questions_created_by_idx
  on public.objective_questions (created_by) where created_by is not null;
