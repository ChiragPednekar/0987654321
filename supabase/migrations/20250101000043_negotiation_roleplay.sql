-- ============================================================================
-- CaseCode — negotiation role-play
-- ============================================================================
-- The student negotiates a multi-issue deal against a counterparty played by a
-- model. Two things make it an exercise rather than a chat.
--
-- THE COUNTERPARTY'S POSITION IS SECRET, AND SECRET AT THE GRANT LEVEL
--
-- The whole exercise is discovering what the other side values. If the student
-- can read `counterparty_payoffs` there is nothing to discover and nothing to
-- trade for — they simply look up the answer. RLS cannot help: the row has to
-- be readable for the student's own brief and the issue list to load. So the
-- counterparty's brief, payoff table and walk-away are withheld by column
-- grant, exactly as the answer key is on objective_questions
-- (20250101000037), and only ever reach the model through the server.
--
-- THE WALK-AWAY IS ARITHMETIC, NOT AN INSTRUCTION
--
-- A model can be talked into anything: flattery, persistence, a confident
-- claim that its position is unreasonable. If the counterparty could be argued
-- below its own reservation value, the exercise would teach that pressure
-- always works — which is false, and harmful advice to take into a real
-- negotiation.
--
-- So acceptance is decided in src/lib/negotiation/engine.ts by comparing the
-- offered value against the BATNA, and the route enforces it. The model
-- chooses what to say and what to counter with; it does not get to decide
-- whether a deal clears its own bottom line.
--
-- MULTI-ISSUE, SO THERE IS SOMETHING TO LEARN
--
-- One number is haggling, and the only skill is nerve. Three or four issues
-- ranked differently by each side means a cheap concession can buy an
-- expensive one, and the scorecard reports claiming and creating separately —
-- a student can win the argument and still have left value unfound.
-- ============================================================================

create table if not exists public.negotiation_cases (
  id      uuid primary key default gen_random_uuid(),
  slug    text unique not null,
  title   text not null,
  -- What both sides can see.
  shared_brief      text not null,
  student_role      text not null,
  counterparty_role text not null,

  -- The student's side: readable.
  student_brief   text not null,
  issues          jsonb not null,
  student_payoffs jsonb not null,
  student_batna   int not null,

  -- The other side: never granted below.
  counterparty_brief    text not null,
  counterparty_payoffs  jsonb not null,
  counterparty_batna    int not null,

  difficulty   public.difficulty not null default 'medium',
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.negotiation_cases is
  'Two-sided negotiation exercises. The counterparty columns are never granted to clients.';

alter table public.negotiation_cases enable row level security;

drop policy if exists "published negotiation cases readable" on public.negotiation_cases;
create policy "published negotiation cases readable" on public.negotiation_cases
  for select using (is_published);

drop policy if exists "admins manage negotiation cases" on public.negotiation_cases;
create policy "admins manage negotiation cases" on public.negotiation_cases
  for all using (public.is_admin()) with check (public.is_admin());

-- Note what is absent: counterparty_brief, counterparty_payoffs and
-- counterparty_batna. counterparty_role is granted because "you are
-- negotiating with the seller" is not a secret.
revoke all on public.negotiation_cases from anon, authenticated;
grant select (id, slug, title, shared_brief, student_role, counterparty_role,
              student_brief, issues, student_payoffs, student_batna,
              difficulty, is_published, created_at)
  on public.negotiation_cases to authenticated;
grant select, insert, update, delete on public.negotiation_cases to service_role;

create table if not exists public.negotiation_sessions (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  case_id uuid not null references public.negotiation_cases(id) on delete cascade,
  status  text not null default 'live' check (status in ('live', 'deal', 'no_deal')),

  agreed_terms      jsonb,
  student_score     int,
  counterparty_score int,
  -- Claiming and creating, kept apart: the first is your share, the second is
  -- whether the pair found the value that was there to find.
  joint_value       int,
  max_joint         int,
  efficiency_pct    numeric,
  beat_batna        boolean,

  debrief    jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

comment on table public.negotiation_sessions is
  'One negotiation. Scored deterministically from the payoff tables when a deal closes.';

create index if not exists negotiation_sessions_user_idx
  on public.negotiation_sessions (user_id, started_at desc);

alter table public.negotiation_sessions enable row level security;
drop policy if exists "own negotiation sessions" on public.negotiation_sessions;
create policy "own negotiation sessions" on public.negotiation_sessions
  for select using (user_id = auth.uid());
drop policy if exists "staff read negotiation sessions" on public.negotiation_sessions;
create policy "staff read negotiation sessions" on public.negotiation_sessions
  for select using (public.is_admin());
revoke all on public.negotiation_sessions from anon, authenticated;
grant select on public.negotiation_sessions to authenticated;
grant select, insert, update, delete on public.negotiation_sessions to service_role;

create table if not exists public.negotiation_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.negotiation_sessions(id) on delete cascade,
  role       text not null check (role in ('student', 'counterparty')),
  content    text not null,
  -- Set when the turn actually put terms on the table, rather than merely
  -- talking about them. Structured so the deal is never parsed out of prose.
  offer      jsonb,
  created_at timestamptz not null default now()
);

comment on table public.negotiation_messages is
  'Turns of one negotiation. `offer` is set when the turn put terms on the table.';

create index if not exists negotiation_messages_session_idx
  on public.negotiation_messages (session_id, created_at);

alter table public.negotiation_messages enable row level security;
drop policy if exists "own negotiation messages" on public.negotiation_messages;
create policy "own negotiation messages" on public.negotiation_messages for select using (
  exists (select 1 from public.negotiation_sessions s
          where s.id = negotiation_messages.session_id and s.user_id = auth.uid())
);
revoke all on public.negotiation_messages from anon, authenticated;
grant select on public.negotiation_messages to authenticated;
grant select, insert, update, delete on public.negotiation_messages to service_role;
