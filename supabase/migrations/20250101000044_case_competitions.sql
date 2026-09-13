-- ============================================================================
-- CaseCode — team case competitions
-- ============================================================================
-- The format Indian B-schools actually compete in: three or four students, one
-- problem statement, one submission per team, and a ranking against everyone
-- else who entered.
--
-- TEAMS, IN A SCHEMA THAT ASSUMED INDIVIDUALS
--
-- Everything graded here until now has been scoped to a user id. A competition
-- entry belongs to a team, so `competition_entries` is keyed by team rather
-- than by person, and the primary key is the team id — one entry per team,
-- enforced by the database rather than by a check somebody can forget. Any
-- member may submit, and `submitted_by` records who did, because "who actually
-- sent it" is the first question asked when a team disagrees about what went
-- in.
--
-- The (competition_id, user_id) unique key on membership is the other half:
-- nobody can hedge by joining two teams in the same competition.
--
-- RESULTS ARE GATED ON A DEADLINE, IN SQL
--
-- A live leaderboard during an open competition would be gamed — teams would
-- submit early, read their rank, and resubmit against it. So
-- competition_leaderboard() returns nothing until `results_at` has passed, and
-- that check is inside the function rather than in a route. A ranking that
-- leaks because one page forgot a condition is not a ranking.
--
-- DELIBERATELY NOT PROCTORED
--
-- The proctoring built for individual submissions (20250101000035) does not
-- apply here and must not be added. A case competition is a take-home team
-- effort: collaborating, splitting the work and pasting each other's sections
-- into one document is the exercise, not a violation of it. Marking someone
-- down for pasting text their own teammate wrote would be exactly wrong.
-- ============================================================================

create table if not exists public.competitions (
  id      uuid primary key default gen_random_uuid(),
  slug    text unique not null,
  title   text not null,
  sponsor text,

  -- Self-contained rather than pointing at a `cases` row. Competition briefs
  -- are bespoke, usually sponsored, and carry their own judging criteria;
  -- borrowing a practice case would mean every competition shared a rubric
  -- written for something else.
  brief              text not null,
  instructions       text not null,
  expected_framework text,
  criteria    jsonb not null,
  descriptors jsonb not null default '{}'::jsonb,
  max_score   int not null default 100,

  min_team_size int not null default 2 check (min_team_size between 1 and 6),
  max_team_size int not null default 4 check (max_team_size between 1 and 6),

  opens_at   timestamptz not null default now(),
  closes_at  timestamptz not null,
  -- Null means results are not published yet, whatever the clock says.
  results_at timestamptz,

  is_published boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint competitions_team_size_order check (max_team_size >= min_team_size),
  constraint competitions_window_order check (closes_at > opens_at)
);

comment on table public.competitions is
  'A team case competition. Self-contained brief and rubric; ranked after the deadline.';

create table if not exists public.competition_teams (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name           text not null,
  -- Scoped to the competition, so two competitions can reuse a code without
  -- a joiner ever landing in the wrong one.
  join_code      text not null,
  created_by     uuid not null references public.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (competition_id, name),
  unique (competition_id, join_code)
);

comment on table public.competition_teams is
  'A team entered in one competition. Join code is scoped to the competition.';

create table if not exists public.competition_members (
  team_id        uuid not null references public.competition_teams(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  -- Denormalised from the team so the unique key below can exist at all.
  competition_id uuid not null references public.competitions(id) on delete cascade,
  is_lead        boolean not null default false,
  joined_at      timestamptz not null default now(),
  primary key (team_id, user_id),
  -- One team per person per competition: no hedging across entries.
  unique (competition_id, user_id)
);

comment on table public.competition_members is
  'Membership. The (competition_id, user_id) unique key stops anyone entering twice.';

create table if not exists public.competition_entries (
  -- Keyed by team, not by person. This is the line that makes it a team
  -- competition rather than a set of individual submissions.
  team_id        uuid primary key references public.competition_teams(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  answer         text not null,
  submitted_by   uuid not null references public.users(id) on delete cascade,
  submitted_at   timestamptz not null default now(),

  breakdown   jsonb not null default '{}'::jsonb,
  total_score int,
  max_score   int,
  feedback    jsonb not null default '{}'::jsonb,
  graded_at   timestamptz
);

comment on table public.competition_entries is
  'One entry per team, enforced by the primary key. Graded once after the deadline.';

create index if not exists competition_teams_comp_idx on public.competition_teams (competition_id);
create index if not exists competition_members_user_idx on public.competition_members (user_id);
create index if not exists competition_entries_comp_idx
  on public.competition_entries (competition_id, total_score desc nulls last);

alter table public.competitions enable row level security;
alter table public.competition_teams enable row level security;
alter table public.competition_members enable row level security;
alter table public.competition_entries enable row level security;

drop policy if exists "published competitions readable" on public.competitions;
create policy "published competitions readable" on public.competitions for select using (is_published);
drop policy if exists "admins manage competitions" on public.competitions;
create policy "admins manage competitions" on public.competitions
  for all using (public.is_admin()) with check (public.is_admin());
grant select on public.competitions to authenticated;
grant select, insert, update, delete on public.competitions to service_role;

-- A team is visible to its own members and to whoever created it. Rival teams
-- are not listed: knowing who else entered is not part of the exercise, and
-- the roster becomes public in the leaderboard once results are out.
drop policy if exists "teams visible to entrants" on public.competition_teams;
create policy "teams visible to entrants" on public.competition_teams for select using (
  created_by = auth.uid()
  or exists (select 1 from public.competition_members m
             where m.team_id = competition_teams.id and m.user_id = auth.uid())
);
drop policy if exists "staff read teams" on public.competition_teams;
create policy "staff read teams" on public.competition_teams for select using (public.is_admin());
revoke all on public.competition_teams from anon, authenticated;
grant select on public.competition_teams to authenticated;
grant select, insert, update, delete on public.competition_teams to service_role;

drop policy if exists "members visible to teammates" on public.competition_members;
create policy "members visible to teammates" on public.competition_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.competition_members me
             where me.team_id = competition_members.team_id and me.user_id = auth.uid())
);
drop policy if exists "staff read members" on public.competition_members;
create policy "staff read members" on public.competition_members for select using (public.is_admin());
revoke all on public.competition_members from anon, authenticated;
grant select on public.competition_members to authenticated;
grant select, insert, update, delete on public.competition_members to service_role;

drop policy if exists "entries visible to the team" on public.competition_entries;
create policy "entries visible to the team" on public.competition_entries for select using (
  exists (select 1 from public.competition_members m
          where m.team_id = competition_entries.team_id and m.user_id = auth.uid())
);
drop policy if exists "staff read entries" on public.competition_entries;
create policy "staff read entries" on public.competition_entries for select using (public.is_admin());
revoke all on public.competition_entries from anon, authenticated;
grant select on public.competition_entries to authenticated;
grant select, insert, update, delete on public.competition_entries to service_role;

-- ----------------------------------------------------------------------------
-- The ranking, with the embargo built in.
-- ----------------------------------------------------------------------------
-- The `results_at` condition lives here rather than in a route, so there is
-- exactly one place that decides whether a competition's ranking exists yet.
-- Every caller inherits the embargo whether or not it remembered to.
create or replace function public.competition_leaderboard(p_competition uuid)
returns table (
  rank bigint, team_id uuid, team_name text, total_score int, max_score int, member_count bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    rank() over (order by e.total_score desc nulls last) as rank,
    t.id, t.name, e.total_score, e.max_score,
    (select count(*) from public.competition_members m where m.team_id = t.id) as member_count
  from public.competition_entries e
  join public.competition_teams t on t.id = e.team_id
  join public.competitions c on c.id = e.competition_id
  where e.competition_id = p_competition
    and e.total_score is not null
    and c.results_at is not null
    and c.results_at <= now()
  order by e.total_score desc nulls last;
$$;

comment on function public.competition_leaderboard(uuid) is
  'Ranked entries, but only once the competition results_at has passed.';

-- Takes a competition id rather than a user id, and reveals nothing that is
-- not already public once results are out — so authenticated may call it.
revoke execute on function public.competition_leaderboard(uuid) from public, anon;
grant execute on function public.competition_leaderboard(uuid) to authenticated, service_role;
