-- ============================================================================
-- CaseCode — a flagged test cools off for 24 hours; the third flag is final.
--            Teachers write their own SQL and Excel exercises.
-- ============================================================================
--
-- 1. LOCKOUTS EXPIRE
--
-- Until now a test the proctor ended stayed ended until a teacher reopened it
-- (064). That was the right default while the camera was new, and the wrong
-- one for a student with no teacher watching the queue: one misread frame and
-- the question was gone for good.
--
-- Now each ending is a strike against that account on that page:
--
--   strike 1, 2   the page is locked for 24 hours, then opens again under
--                 the same proctoring rules (expires_at = created_at + 24h)
--   strike 3      locked for good (expires_at null)
--
-- A lock a teacher reopened does not count as a strike: reopening says the
-- flag was wrong. An expired lock does count — it lapsed, nobody forgave it.
-- Rows are still never deleted, so the history survives.
--
-- The old unique index allowed one open row per (account, page). An expired
-- row is still "open" (nobody reopened it), so the index moves to the strike:
-- one row per (account, page, strike) among the unforgiven. Two endings fired
-- at once both compute the same next strike and the second is a conflict —
-- the same idempotency 064 relied on.
-- ============================================================================

alter table public.exam_lockouts
  add column if not exists strike     smallint not null default 1 check (strike between 1 and 100),
  add column if not exists expires_at timestamptz;

comment on column public.exam_lockouts.expires_at is
  'When the lock lifts by itself. Null on the strike that blocks the page for good.';

-- Locks already in place become first strikes, lifting 24 hours after they
-- were written. Before this, each (account, page) had at most one open row.
update public.exam_lockouts
   set expires_at = created_at + interval '24 hours'
 where reopened_at is null
   and expires_at is null
   and strike = 1;

drop index if exists public.exam_lockouts_open;
create unique index if not exists exam_lockouts_strike
  on public.exam_lockouts (user_id, path, strike)
  where reopened_at is null;

-- ------------------------------------------------- 2. teacher exercises --
--
-- A teacher-written exercise is an ordinary row with created_by set and
-- is_published false: out of the public library, opened only by its author
-- and by students in a batch it is assigned to (checked by the app on the
-- service role, as the platform exercises already are). The withheld columns
-- stay withheld — the column grants from 045/046 are unchanged.

alter table public.sql_exercises
  add column if not exists created_by uuid references public.users(id) on delete set null;
alter table public.excel_exercises
  add column if not exists created_by uuid references public.users(id) on delete set null;

create index if not exists sql_exercises_created_by_idx
  on public.sql_exercises (created_by) where created_by is not null;
create index if not exists excel_exercises_created_by_idx
  on public.excel_exercises (created_by) where created_by is not null;
