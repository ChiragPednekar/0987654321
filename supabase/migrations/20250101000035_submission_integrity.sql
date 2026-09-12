-- ============================================================================
-- CaseCode — submission integrity and proctoring
-- ============================================================================
-- A graded answer is only worth something if the student wrote it. Two things
-- were making that unenforceable:
--
--   1. Nothing recorded HOW an answer arrived. A 4,000-character response
--      pasted in one keystroke and one typed over forty minutes were
--      indistinguishable by the time they reached the grader.
--   2. `time_spent_seconds` comes from the client, so the one number that
--      could have exposed an instant answer was the number a cheat would
--      forge first.
--
-- This migration fixes both, and adds the consequence ladder on top.
--
-- WHAT IS AND IS NOT POSSIBLE
--
-- A web page cannot stop someone switching tabs, and it cannot see the tab
-- they switched to. Browsers deliberately refuse both — a page that could pin
-- the user in place or read its neighbours would be a weapon. So this is
-- detection and deterrence, not prevention, which is also all that HackerRank,
-- Codility and Mettl do behind their "lockdown" wording.
--
-- Two independent families of evidence, because the first is tamperable:
--
--   * Behavioural (`signals`) — paste sizes, keystroke counts, focus losses.
--     Collected in the browser, so a determined student with devtools can send
--     whatever they like. Good enough for the overwhelming majority, and
--     useless against an expert. Treated accordingly: never trusted alone for
--     a block.
--   * Server-side — `solve_attempts.started_at` below is stamped by the server
--     when the case is opened, so elapsed time cannot be forged, and the
--     grader's own read of the text (ai_likelihood) never passes through the
--     client at all.
--
-- WHY AI-LIKENESS ALONE NEVER PENALISES
--
-- Stylometric AI detection has a false-positive problem that falls hardest on
-- exactly this product's users: students writing careful, formal English as a
-- second language read as "AI" to every detector on the market. Marking such a
-- student down for writing well would be worse than missing a cheat. So the
-- model's opinion can raise a flag and inform a teacher, but a mark is only
-- reduced when behavioural evidence — an answer that was pasted, or never
-- typed — corroborates it. That rule lives in src/lib/integrity.ts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Server-stamped attempt start.
-- ----------------------------------------------------------------------------
-- The client already reports elapsed time and always will, because it drives
-- the on-screen timer. This is the copy that decides anything: written when the
-- student opens the solve view, read when they submit, and never accepted from
-- the request body.
create table if not exists public.solve_attempts (
  user_id    uuid not null references public.users(id) on delete cascade,
  case_id    uuid not null references public.cases(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, case_id)
);

comment on table public.solve_attempts is
  'Server-stamped open time per (user, case), so elapsed time cannot be forged.';

alter table public.solve_attempts enable row level security;

-- No policy for authenticated at all: the row is written and read by the
-- service role from the two routes that own it. A student who could update
-- started_at could rewind their own clock, which is the whole point of having
-- it.
revoke all on public.solve_attempts from anon, authenticated;
grant select, insert, update, delete on public.solve_attempts to service_role;

-- ----------------------------------------------------------------------------
-- The verdict on one graded submission.
-- ----------------------------------------------------------------------------
create table if not exists public.submission_integrity (
  submission_id uuid primary key
    references public.submissions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,

  -- Raw client telemetry, kept verbatim. Untrusted, but it is the audit trail
  -- a teacher reads when a student disputes a penalty, and discarding it would
  -- leave only a number nobody could argue with.
  signals jsonb not null default '{}'::jsonb,

  flags text[] not null default '{}',
  -- 100 is clean. Deductions are defined in src/lib/integrity.ts.
  score int not null check (score between 0 and 100),
  penalty_pct int not null default 0 check (penalty_pct between 0 and 100),
  severity text not null check (severity in ('clean', 'suspect', 'severe')),

  -- The grader's own read of the prose, 0-100. Null when the model did not
  -- return one, which must never be read as "clean" or as "cheated".
  ai_likelihood int check (ai_likelihood between 0 and 100),

  -- From solve_attempts. Null when the student reached submit without the
  -- start ever being stamped (an old draft, a restored tab).
  server_elapsed_seconds int,

  -- Set when a human overturns the automatic verdict. The row is never
  -- deleted: an unfair penalty that vanishes teaches nobody anything.
  cleared_at timestamptz,
  cleared_by uuid references public.users(id) on delete set null,
  cleared_note text,

  created_at timestamptz not null default now()
);

comment on table public.submission_integrity is
  'Per-submission proctoring evidence and the penalty derived from it.';

create index if not exists submission_integrity_user_idx
  on public.submission_integrity (user_id, created_at desc);

create index if not exists submission_integrity_severe_idx
  on public.submission_integrity (user_id)
  where severity = 'severe' and cleared_at is null;

alter table public.submission_integrity enable row level security;

-- A student may read the verdict on their own work — being marked down by a
-- process you are not allowed to see is not a process, it is an accusation.
drop policy if exists "own integrity readable" on public.submission_integrity;
create policy "own integrity readable" on public.submission_integrity
  for select using (user_id = auth.uid());

drop policy if exists "staff read integrity" on public.submission_integrity;
create policy "staff read integrity" on public.submission_integrity
  for select using (public.is_admin());

-- Nobody but the service role writes one. There is deliberately no insert or
-- update policy, exactly as with `scores`.
revoke all on public.submission_integrity from anon, authenticated;
grant select on public.submission_integrity to authenticated;
grant select, insert, update, delete on public.submission_integrity to service_role;

-- ----------------------------------------------------------------------------
-- Strike count.
-- ----------------------------------------------------------------------------
-- Counted live from the table rather than cached on users, so clearing a
-- wrongly-flagged submission immediately restores the student's standing
-- instead of leaving a counter that has to be separately remembered.
--
-- Rolling twelve months: a student who was caught once in first year should
-- not still be one mistake from a block in their final term.
create or replace function public.integrity_strikes(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.submission_integrity si
  where si.user_id = p_user
    and si.severity = 'severe'
    and si.cleared_at is null
    and si.created_at > now() - interval '365 days';
$$;

comment on function public.integrity_strikes(uuid) is
  'Uncleared severe integrity findings for this account in the last year.';

-- Takes a user id rather than reading auth.uid(), so it is service-role only —
-- the same rule that has_pro() was leaking by ignoring. See
-- 20250101000029_lock_down_rpc_surface.sql.
revoke execute on function public.integrity_strikes(uuid) from public, anon, authenticated;
grant execute on function public.integrity_strikes(uuid) to service_role;
