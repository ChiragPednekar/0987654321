-- ============================================================================
-- CaseCode — sales and business-development role-play
-- ============================================================================
-- A student sells to a buyer played by a model: a category manager, a salaried
-- customer, a distributor's owner. It matters for FMCG, BFSI and B2B sales
-- roles, where the interview often is a role-play.
--
-- THE BUYER'S MIND IS SECRET, AND SECRET AT THE GRANT LEVEL
--
-- Each scenario has needs the buyer holds and objections the buyer will raise.
-- Discovering them is the exercise, so buyer_brief, needs, objections and
-- buy_rule are withheld by column grant — the same technique as the
-- negotiation counterparty (20250101000043). They reach the model through the
-- server and the student only in the debrief, after the meeting ends.
--
-- A SALE CANNOT BE PUSHED THROUGH
--
-- Whether the buyer commits is decided in src/lib/sales/engine.ts, not by the
-- model: the student must have uncovered enough needs and resolved the required
-- objections, each proven by a quote of the student's own words. A model that
-- tries to say yes early is overridden. Persistence alone never closes.
-- ============================================================================

create table if not exists public.sales_scenarios (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  sector      text not null,
  difficulty  public.difficulty not null default 'medium',

  -- What the student sees.
  shared_brief  text not null,
  student_role  text not null,
  buyer_role    text not null,
  student_brief text not null,
  max_turns     int not null default 12 check (max_turns between 4 and 30),

  -- Never granted below.
  buyer_brief text not null,
  needs       jsonb not null,
  objections  jsonb not null,
  buy_rule    jsonb not null,

  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.sales_scenarios enable row level security;
drop policy if exists "published sales scenarios readable" on public.sales_scenarios;
create policy "published sales scenarios readable" on public.sales_scenarios
  for select to authenticated using (is_published);
revoke all on public.sales_scenarios from anon, authenticated;
grant select (id, slug, title, sector, difficulty, shared_brief, student_role, buyer_role,
              student_brief, max_turns, is_published, created_at)
  on public.sales_scenarios to authenticated;
grant select, insert, update, delete on public.sales_scenarios to service_role;

create table if not exists public.sales_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  scenario_id uuid not null references public.sales_scenarios(id) on delete cascade,
  status      text not null default 'live' check (status in ('live', 'won', 'lost')),
  -- {need_key: {quote, turn}} and {objection_key: {quote, turn}}: the student's
  -- own words that earned each one. Written only by the turn route.
  uncovered   jsonb not null default '{}'::jsonb,
  resolved    jsonb not null default '{}'::jsonb,
  turns       int not null default 0,
  outcome_reason text,
  -- The end-of-meeting review: criterion scores and feedback. One model call.
  debrief     jsonb not null default '{}'::jsonb,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create index if not exists sales_sessions_user_idx on public.sales_sessions (user_id, started_at desc);

alter table public.sales_sessions enable row level security;
drop policy if exists "own sales sessions" on public.sales_sessions;
create policy "own sales sessions" on public.sales_sessions for select using (user_id = auth.uid());
drop policy if exists "staff read sales sessions" on public.sales_sessions;
create policy "staff read sales sessions" on public.sales_sessions for select using (public.is_admin());
revoke all on public.sales_sessions from anon, authenticated;
grant select on public.sales_sessions to authenticated;
grant select, insert, update, delete on public.sales_sessions to service_role;

create table if not exists public.sales_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sales_sessions(id) on delete cascade,
  role       text not null check (role in ('student', 'buyer')),
  content    text not null,
  -- Set on a buyer turn whose decision to buy was overridden by the engine.
  overridden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sales_messages_session_idx on public.sales_messages (session_id, created_at);

alter table public.sales_messages enable row level security;
drop policy if exists "own sales messages" on public.sales_messages;
create policy "own sales messages" on public.sales_messages for select using (
  exists (select 1 from public.sales_sessions s
          where s.id = sales_messages.session_id and s.user_id = auth.uid())
);
revoke all on public.sales_messages from anon, authenticated;
grant select on public.sales_messages to authenticated;
grant select, insert, update, delete on public.sales_messages to service_role;
