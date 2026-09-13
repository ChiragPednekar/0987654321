-- ============================================================================
-- CaseCode — the business simulation
-- ============================================================================
-- Eight quarters running a manufacturer against two computer rivals. Each
-- round the student sets price, marketing, R&D and capacity investment, and
-- sees a P&L, a market share and a balance sheet come back.
--
-- WHERE THE MODEL LIVES, AND WHY NOT HERE
--
-- The market is a closed-form model in src/lib/sim/engine.ts — pure,
-- deterministic and unit-tested — not a model call and not SQL. A simulation
-- teaches by having a causal structure the student can infer: cutting price
-- must move share the same way every time, or there is nothing to learn from
-- trying it. An LLM asked the same question twice will not answer the same
-- way, and would also cost a call per round per player on a feature whose
-- appeal is running it ten times in an evening.
--
-- These tables only record what happened. Decisions and the resulting state
-- are both stored per round, so a run can be replayed exactly and so the
-- end-of-run debrief can read the whole sequence of choices rather than just
-- the final number.
--
-- The AI appears once, at the end, to say what the pattern of decisions
-- reveals — a judgement about a person rather than arithmetic.
-- ============================================================================

create table if not exists public.sim_runs (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.users(id) on delete cascade,
  status   text not null default 'live' check (status in ('live', 'completed', 'bankrupt')),

  -- Denormalised from the last round so the list does not need every round.
  current_round int not null default 1,
  cumulative_profit bigint not null default 0,
  final_score bigint,

  -- {strengths: [], weaknesses: [], verdict: ""} once the run is debriefed.
  debrief jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

comment on table public.sim_runs is
  'One eight-quarter playthrough. The market model is in src/lib/sim/engine.ts.';

create index if not exists sim_runs_user_idx on public.sim_runs (user_id, started_at desc);

alter table public.sim_runs enable row level security;
drop policy if exists "own sim runs" on public.sim_runs;
create policy "own sim runs" on public.sim_runs for select using (user_id = auth.uid());
drop policy if exists "staff read sim runs" on public.sim_runs;
create policy "staff read sim runs" on public.sim_runs for select using (public.is_admin());
revoke all on public.sim_runs from anon, authenticated;
grant select on public.sim_runs to authenticated;
grant select, insert, update, delete on public.sim_runs to service_role;

create table if not exists public.sim_rounds (
  run_id   uuid not null references public.sim_runs(id) on delete cascade,
  /**
   * Round 0 holds the opening state — the firms as they exist before anyone
   * has decided anything. Without it round 1 has no input to read and the run
   * cannot be replayed from the start. An earlier version constrained this to
   * 1..20 and every run failed on its first quarter with "run state is
   * missing", which is why the bound starts at zero.
   */
  round    int not null check (round between 0 and 20),

  -- What the student chose, and what the market did with it. Both kept: the
  -- outcome alone cannot be replayed, and the decision alone cannot be marked.
  decisions jsonb not null,
  outcome   jsonb not null,
  /** Every firm's state after this round, which is the next round's input. */
  states    jsonb not null,

  created_at timestamptz not null default now(),
  primary key (run_id, round)
);

comment on table public.sim_rounds is
  'Decisions and results per quarter. Stored so a run replays exactly.';

alter table public.sim_rounds enable row level security;
drop policy if exists "own sim rounds" on public.sim_rounds;
create policy "own sim rounds" on public.sim_rounds for select using (
  exists (select 1 from public.sim_runs r where r.id = sim_rounds.run_id and r.user_id = auth.uid())
);
revoke all on public.sim_rounds from anon, authenticated;
grant select on public.sim_rounds to authenticated;
grant select, insert, update, delete on public.sim_rounds to service_role;
