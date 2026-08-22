-- ============================================================================
-- CaseCode — Model Workspace, Case Chat, Classrooms, Groups, Subscriptions
-- ============================================================================
-- Spec sections §5, §6, §8, §10, §11, §16. Every table here follows the two
-- conventions the schema already established:
--
--   * RLS on, with an explicit policy per access path.
--   * Anything that would let a student see an answer early is withheld by a
--     column GRANT, not by a row policy — policies are row-level, and these
--     rows are legitimately readable (see 20250101000011_drills.sql).
-- ============================================================================

-- ------------------------------------------------- §5 Model Workspace ------
-- A `model` case is a spreadsheet build. Cells are graded arithmetically
-- against a tolerance band, exactly as drills are: instant, free, repeatable.
-- Only cells the student must produce live here; label/static cells are part
-- of the case's supporting_data.

create table if not exists public.model_cells (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases(id) on delete cascade,
  row_index     integer not null check (row_index >= 0),
  col_index     integer not null check (col_index >= 0),
  label         text not null check (length(trim(label)) > 0),
  -- The number the student is expected to arrive at.
  expected      numeric not null,
  tolerance_pct numeric not null default 2 check (tolerance_pct >= 0 and tolerance_pct <= 100),
  unit          text,
  -- Shown only after the attempt is submitted.
  formula       text,
  explanation   text,
  created_at    timestamptz not null default now(),
  unique (case_id, row_index, col_index)
);
create index if not exists model_cells_case_idx
  on public.model_cells(case_id, row_index, col_index);
alter table public.model_cells enable row level security;
create policy "model cells are public" on public.model_cells
  for select using (true);
create policy "admins manage model cells" on public.model_cells
  for all using (public.is_admin()) with check (public.is_admin());

revoke select on public.model_cells from anon, authenticated;
grant select (id, case_id, row_index, col_index, label, tolerance_pct, unit, created_at)
  on public.model_cells to anon, authenticated;

create table if not exists public.model_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  case_id          uuid not null references public.cases(id) on delete cascade,
  cells            jsonb not null default '{}'::jsonb,
  correct          integer not null default 0,
  total            integer not null default 0,
  duration_seconds integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists model_attempts_user_idx
  on public.model_attempts(user_id, created_at desc);
alter table public.model_attempts enable row level security;
create policy "own model attempts are readable" on public.model_attempts
  for select using (auth.uid() = user_id);
grant select on public.model_attempts to authenticated;
revoke insert, update, delete on public.model_attempts from anon, authenticated;

-- ------------------------------------------------------ §6 Case Chat ------
-- A live interviewer. Sessions are per user per case; messages are append-only.
-- Written by the route handler under the service role so a client cannot forge
-- an interviewer turn and grade itself into a better transcript.

do $$ begin create type public.chat_role as enum ('interviewer', 'candidate'); exception when duplicate_object then null; end $$;

create table if not exists public.chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  case_id    uuid not null references public.cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at   timestamptz,
  -- Set when the session is closed and the transcript assessed.
  verdict    text,
  score      integer check (score between 0 and 100)
);
create index if not exists chat_sessions_user_idx
  on public.chat_sessions(user_id, created_at desc);
alter table public.chat_sessions enable row level security;
create policy "own chat sessions" on public.chat_sessions
  for select using (auth.uid() = user_id);
grant select on public.chat_sessions to authenticated;
revoke insert, update, delete on public.chat_sessions from anon, authenticated;

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role       public.chat_role not null,
  content    text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx
  on public.chat_messages(session_id, created_at);
alter table public.chat_messages enable row level security;
create policy "own chat messages" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );
grant select on public.chat_messages to authenticated;
revoke insert, update, delete on public.chat_messages from anon, authenticated;

-- ------------------------------------------------------ §11 Classroom -----

do $$ begin create type public.classroom_role as enum ('teacher', 'student'); exception when duplicate_object then null; end $$;

create table if not exists public.classrooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 120),
  description text,
  owner_id    uuid not null references public.users(id) on delete cascade,
  -- Short human-typable code. Unique so a join is unambiguous.
  join_code   text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists classrooms_owner_idx on public.classrooms(owner_id);
alter table public.classrooms enable row level security;

create table if not exists public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  role         public.classroom_role not null default 'student',
  joined_at    timestamptz not null default now(),
  primary key (classroom_id, user_id)
);
create index if not exists classroom_members_user_idx
  on public.classroom_members(user_id);
alter table public.classroom_members enable row level security;

-- Membership test as a function so the policies below do not recurse through
-- each other's row filters.
create or replace function public.is_classroom_member(p_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classroom_members m
    where m.classroom_id = p_classroom and m.user_id = auth.uid()
  );
$$;
grant execute on function public.is_classroom_member(uuid) to authenticated;

create or replace function public.is_classroom_teacher(p_classroom uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.classroom_members m
    where m.classroom_id = p_classroom
      and m.user_id = auth.uid()
      and m.role = 'teacher'
  );
$$;
grant execute on function public.is_classroom_teacher(uuid) to authenticated;

create policy "members read their classroom" on public.classrooms
  for select using (public.is_classroom_member(id) or owner_id = auth.uid());
create policy "members read the roster" on public.classroom_members
  for select using (public.is_classroom_member(classroom_id));

grant select on public.classrooms       to authenticated;
grant select on public.classroom_members to authenticated;
-- Creating classrooms, joining and assigning all run through route handlers
-- under the service role, so join codes can be generated and rate-limited
-- server-side rather than guessed at from the browser.
revoke insert, update, delete on public.classrooms        from anon, authenticated;
revoke insert, update, delete on public.classroom_members from anon, authenticated;

create table if not exists public.classroom_assignments (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  case_id      uuid not null references public.cases(id) on delete cascade,
  due_at       timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  unique (classroom_id, case_id)
);
create index if not exists classroom_assignments_class_idx
  on public.classroom_assignments(classroom_id, due_at);
alter table public.classroom_assignments enable row level security;
create policy "members read assignments" on public.classroom_assignments
  for select using (public.is_classroom_member(classroom_id));
grant select on public.classroom_assignments to authenticated;
revoke insert, update, delete on public.classroom_assignments from anon, authenticated;

-- -------------------------------------------------- §10 Community groups --

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name        text not null check (length(trim(name)) between 2 and 80),
  description text,
  owner_id    uuid not null references public.users(id) on delete cascade,
  is_private  boolean not null default false,
  member_count integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);
alter table public.group_members enable row level security;

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group and m.user_id = auth.uid()
  );
$$;
grant execute on function public.is_group_member(uuid) to authenticated, anon;

-- Public groups are browsable by anyone; private ones only by members.
create policy "public groups are visible" on public.groups
  for select using (not is_private or public.is_group_member(id));
create policy "group roster visible to members" on public.group_members
  for select using (public.is_group_member(group_id));

grant select on public.groups        to anon, authenticated;
grant select on public.group_members to authenticated;
revoke insert, update, delete on public.groups        from anon, authenticated;
revoke insert, update, delete on public.group_members from anon, authenticated;

create table if not exists public.group_posts (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  body       text not null check (length(trim(body)) between 2 and 5000),
  upvotes    integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists group_posts_group_idx
  on public.group_posts(group_id, created_at desc);
alter table public.group_posts enable row level security;
create policy "group posts follow group visibility" on public.group_posts
  for select using (
    exists (
      select 1 from public.groups g
      where g.id = group_posts.group_id
        and (not g.is_private or public.is_group_member(g.id))
    )
  );
grant select on public.group_posts to anon, authenticated;
revoke insert, update, delete on public.group_posts from anon, authenticated;

-- Keep groups.member_count honest in both directions, so this one does not
-- repeat the one-directional-counter bug fixed in 20250101000016.
create or replace function public.sync_group_member_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.groups g
     set member_count = (
       select count(*) from public.group_members m where m.group_id = g.id
     )
   where g.id = coalesce(new.group_id, old.group_id);
  return null;
end;
$$;

drop trigger if exists group_members_sync_count on public.group_members;
create trigger group_members_sync_count
  after insert or delete on public.group_members
  for each row execute function public.sync_group_member_count();

-- ------------------------------------- §8 Recruiter view / §16 billing ----

-- Recruiters see an opt-in candidate list. Students are invisible there unless
-- they deliberately switch this on, and it defaults to off.
alter table public.users
  add column if not exists open_to_opportunities boolean not null default false;

-- Students may set their own flag; everything else on users stays locked down
-- by 20250101000004_column_privileges.sql.
grant update (open_to_opportunities) on public.users to authenticated;
grant select (open_to_opportunities) on public.users to anon, authenticated;

do $$ begin create type public.plan_tier as enum ('free', 'pro'); exception when duplicate_object then null; end $$;

alter table public.users
  add column if not exists plan public.plan_tier not null default 'free';
grant select (plan) on public.users to anon, authenticated;

create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  plan                  public.plan_tier not null default 'pro',
  status                text not null check (status in (
                          'created','authenticated','active','pending',
                          'halted','cancelled','completed','expired')),
  razorpay_subscription_id text unique,
  razorpay_payment_id      text,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists subscriptions_user_idx
  on public.subscriptions(user_id, created_at desc);
alter table public.subscriptions enable row level security;
create policy "own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);
grant select on public.subscriptions to authenticated;
-- Written only by the checkout route and the Razorpay webhook, both service
-- role. A client that could insert here could grant itself Pro.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
