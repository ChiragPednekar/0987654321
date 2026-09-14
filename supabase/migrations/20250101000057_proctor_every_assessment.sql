-- ============================================================================
-- CaseCode — proctoring for every assessed activity, not just cases
-- ============================================================================
-- 20250101000035 built exam mode, the integrity verdict and the strike ladder,
-- and wired them to one surface: the case editor. Contests were added later.
-- Everything built since — aptitude, the daily quiz, SQL, Excel, the HR
-- interview, negotiation, the simulation, competition entries, sales role-play
-- — was graded with no supervision at all.
--
-- That is a worse hole than having no proctoring anywhere, because the student
-- learns exactly where it is not watching. An aptitude paper is the easiest
-- thing on the platform to cheat: four options, one tab away from the answer,
-- and until now nothing recorded that the tab was ever left.
--
-- WHAT THIS CHANGES
--
-- One ledger, not two. `submission_integrity` becomes the record for any
-- assessed activity rather than only for rows in `submissions`:
--
--   * `submission_id` and `case_id` become nullable, because an aptitude
--     session or a SQL attempt is neither.
--   * `activity` says what was being done, and `activity_ref` points at the
--     row it produced (an objective_sessions id, a sql_attempts id, ...).
--   * The primary key moves to a surrogate id, with submission_id kept unique
--     where it is present so a case submission still cannot be scored twice.
--
-- Keeping one table is the point. `integrity_strikes()` counts severe,
-- uncleared findings per account, and the consequence ladder reads that one
-- number. A second table would mean two places to count, and the first time
-- someone forgot the union a student would quietly get twice the allowance
-- before being blocked.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not extend AI-likeness scoring to activities that have no prose.
-- There is nothing stylometric to read in `=SUMIFS(C2:C60,A2:A60,"West")` or
-- in option C, and inventing a number for them would be the false-positive
-- problem from 000035 with none of the evidence. On those surfaces the
-- cheating question is answered by things that are actually true: the hidden
-- second dataset for SQL and Excel, and the focus counters for multiple
-- choice.
-- ============================================================================

do $$ begin
  create type public.integrity_activity as enum (
    'case',
    'contest',
    'objective',
    'daily_quiz',
    'sql',
    'excel',
    'interview',
    'negotiation',
    'simulation',
    'competition',
    'group_discussion',
    'sales'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Generalise the verdict table.
-- ----------------------------------------------------------------------------
alter table public.submission_integrity
  add column if not exists activity public.integrity_activity;

alter table public.submission_integrity
  add column if not exists activity_ref uuid;

-- Existing rows predate the column and are all case submissions by definition,
-- since that was the only surface wired up.
update public.submission_integrity set activity = 'case' where activity is null;

alter table public.submission_integrity
  alter column activity set default 'case',
  alter column activity set not null;

-- The surrogate key. Added before the old primary key is dropped so the table
-- is never without one.
alter table public.submission_integrity
  add column if not exists id uuid not null default gen_random_uuid();

do $$ begin
  alter table public.submission_integrity
    drop constraint if exists submission_integrity_pkey;
  alter table public.submission_integrity
    add constraint submission_integrity_pkey primary key (id);
exception when others then null; end $$;

alter table public.submission_integrity
  alter column submission_id drop not null,
  alter column case_id drop not null;

-- A case submission still gets exactly one verdict; the other activities have
-- no submission row to be unique on.
create unique index if not exists submission_integrity_submission_uniq
  on public.submission_integrity (submission_id)
  where submission_id is not null;

create index if not exists submission_integrity_activity_idx
  on public.submission_integrity (user_id, activity, created_at desc);

/**
 * Every verdict must point at something a human can go and look at.
 *
 * Without this an activity could be recorded with no reference at all, and the
 * appeal a student is entitled to under 000035 ("being marked down by a
 * process you are not allowed to see is not a process, it is an accusation")
 * would have nothing to show them.
 */
do $$ begin
  alter table public.submission_integrity
    add constraint submission_integrity_has_subject
    check (submission_id is not null or activity_ref is not null);
exception when duplicate_object then null; end $$;

comment on table public.submission_integrity is
  'Proctoring evidence and penalty for any assessed activity. One row per attempt; `activity` says which surface.';

-- ----------------------------------------------------------------------------
-- Server-stamped starts for activities that are not cases.
-- ----------------------------------------------------------------------------
-- `solve_attempts` is keyed (user_id, case_id) and stays as it is. This is the
-- same idea for everything else: the client's elapsed time drives its own
-- timer and decides nothing, exactly as in 000035.
create table if not exists public.activity_attempts (
  user_id      uuid not null references public.users(id) on delete cascade,
  activity     public.integrity_activity not null,
  activity_ref uuid not null,
  started_at   timestamptz not null default now(),
  primary key (user_id, activity, activity_ref)
);

comment on table public.activity_attempts is
  'Server-stamped open time per (user, activity, subject), so elapsed time cannot be forged.';

alter table public.activity_attempts enable row level security;

-- No policy for authenticated, exactly as with solve_attempts: a student who
-- could update started_at could rewind their own clock.
revoke all on public.activity_attempts from anon, authenticated;
grant select, insert, update, delete on public.activity_attempts to service_role;
