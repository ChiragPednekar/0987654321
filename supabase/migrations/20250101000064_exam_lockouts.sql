-- ============================================================================
-- CaseCode — the camera can end a test, and the ending sticks
-- ============================================================================
-- Until now every camera finding was evidence for a reviewer and nothing more
-- (src/lib/integrity.ts). From here, a phone in view, a second person, a
-- covered lens, a minute away from the desk, or the camera switched off ENDS
-- the attempt: the page freezes and nothing more can be written.
--
-- A freeze that lives only in the browser is undone by pressing reload. So the
-- ending is written here, and every proctored page asks on load whether this
-- account has been locked out of it. Until a teacher or an admin reopens it,
-- the answer is yes.
--
-- KEYED BY PAGE, NOT BY ATTEMPT
--
-- The surfaces have no common attempt id — a case, a GD room, a quiz and an
-- SQL exercise are all different tables, and threading an id through twelve
-- of them would be twelve chances to get it wrong. The page path is what every
-- surface already has, and it is what a reload returns to.
--
-- WHY A REOPEN AND NOT A DELETE
--
-- The detection is a model reading a webcam frame and it will sometimes be
-- wrong; reopening is how that is put right. Reopened rows are kept, so the
-- history of who was stopped and who let them back in survives the fix.
-- ============================================================================

create table if not exists public.exam_lockouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  path         text not null check (path ~ '^/' and length(path) <= 300),
  reason       text not null
               check (reason in ('phone', 'multiple_faces', 'camera_covered', 'no_face', 'camera_off')),
  signals      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  reopened_at  timestamptz,
  reopened_by  uuid references public.users(id) on delete set null
);

comment on table public.exam_lockouts is
  'Tests the camera ended. A row with reopened_at null keeps that page locked for that account.';

-- One open lock per account and page. The insert relies on it: a second ending
-- from a reload or a double fire is a conflict, not a second row.
create unique index if not exists exam_lockouts_open
  on public.exam_lockouts (user_id, path)
  where reopened_at is null;

create index if not exists exam_lockouts_recent
  on public.exam_lockouts (created_at desc);

alter table public.exam_lockouts enable row level security;

drop policy if exists "admins read exam lockouts" on public.exam_lockouts;
create policy "admins read exam lockouts" on public.exam_lockouts
  for select using (public.is_admin());

-- Every read and write goes through the API routes on the service role, which
-- check who is asking. Nothing here is reachable from the browser directly.
revoke all on public.exam_lockouts from public;
revoke all on public.exam_lockouts from anon, authenticated;
grant select, insert, update on public.exam_lockouts to service_role;
