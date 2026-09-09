-- ============================================================================
-- CaseCode — peer interviews
-- ============================================================================
-- A case interview has two sides, and until now the platform only had one. A
-- student wrote an answer and a model marked it. Nobody ever had to ask the
-- follow-up question, sit through a silence, or push back on a number — which
-- is most of what the real interview is.
--
-- Two students take a case together: one interviews, one answers, then they
-- swap. The platform supplies the asymmetry that makes it work.
--
-- The asymmetry is the point. `cases.model_answer` and `expected_framework` are
-- revoked from ordinary reads precisely so a candidate cannot see them. In a
-- peer session the *interviewer* needs them — that is what lets an ordinary
-- student run a competent interview — while the candidate must keep seeing only
-- the scenario. So the room is served per-role from the server, and the
-- candidate's page never receives the answer at all. Hiding it in the client
-- would put it one devtools tab away.
-- ============================================================================

create type public.peer_session_status as enum (
  'open',       -- waiting for someone to join
  'live',       -- both present
  'completed',  -- finished, feedback may exist
  'cancelled'
);

create type public.peer_role as enum ('interviewer', 'candidate');

create table if not exists public.peer_sessions (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references public.cases(id) on delete cascade,
  host_id      uuid not null references public.users(id) on delete cascade,
  guest_id     uuid references public.users(id) on delete set null,
  -- Which side the host takes; the guest gets the other one.
  host_role    public.peer_role not null default 'candidate',
  status       public.peer_session_status not null default 'open',
  scheduled_at timestamptz,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),
  -- A host cannot join their own session, which is the obvious way to farm
  -- feedback on yourself.
  constraint peer_sessions_distinct_participants check (guest_id is null or guest_id <> host_id)
);

comment on table public.peer_sessions is
  'A two-person live case interview. One interviews, one answers.';

create index if not exists peer_sessions_open_idx
  on public.peer_sessions (status, created_at desc) where status = 'open';
create index if not exists peer_sessions_host_idx on public.peer_sessions (host_id);
create index if not exists peer_sessions_guest_idx on public.peer_sessions (guest_id);

-- ----------------------------------------------------------------------------
-- Feedback, scored against the same rubric the AI uses.
-- ----------------------------------------------------------------------------
-- Deliberately the same criteria as AI grading, so a student can compare what a
-- human saw against what the model saw on the same axes. Divergence between the
-- two is the most useful thing in the whole feature.
create table if not exists public.peer_feedback (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.peer_sessions(id) on delete cascade,
  from_user   uuid not null references public.users(id) on delete cascade,
  to_user     uuid not null references public.users(id) on delete cascade,
  breakdown   jsonb not null default '{}'::jsonb,
  total_score integer,
  max_score   integer,
  notes       text,
  created_at  timestamptz not null default now(),
  -- One verdict per person per session; editing replaces it.
  unique (session_id, from_user),
  constraint peer_feedback_not_self check (from_user <> to_user)
);

create index if not exists peer_feedback_to_user_idx on public.peer_feedback (to_user);

-- ----------------------------------------------------------------------------
-- Row security
-- ----------------------------------------------------------------------------
alter table public.peer_sessions enable row level security;
alter table public.peer_feedback enable row level security;

-- Open sessions are a public lobby — you cannot join what you cannot see. Once
-- matched, a session is visible only to its two participants and admins.
drop policy if exists "peer sessions are visible to the lobby and participants"
  on public.peer_sessions;
create policy "peer sessions are visible to the lobby and participants"
  on public.peer_sessions for select
  using (
    status = 'open'
    or host_id = auth.uid()
    or guest_id = auth.uid()
    or public.is_admin()
  );

-- Feedback is between the two people in the room. Nobody else reads it — a
-- leaderboard of who marks harshly would change how people mark.
drop policy if exists "peer feedback is visible to its two parties" on public.peer_feedback;
create policy "peer feedback is visible to its two parties"
  on public.peer_feedback for select
  using (from_user = auth.uid() or to_user = auth.uid() or public.is_admin());

-- Writes go through the API with the service role, which checks entitlement and
-- participation. Nothing is granted to `authenticated` directly.
revoke all on public.peer_sessions from anon, authenticated;
revoke all on public.peer_feedback from anon, authenticated;
grant select on public.peer_sessions to authenticated;
grant select on public.peer_feedback to authenticated;
grant select, insert, update, delete on public.peer_sessions to service_role;
grant select, insert, update, delete on public.peer_feedback to service_role;
