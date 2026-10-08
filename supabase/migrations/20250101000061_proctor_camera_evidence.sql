-- ============================================================================
-- CaseCode — evidence photos for camera proctoring
-- ============================================================================
-- Camera detection runs in the student's browser and reports only counters
-- (see src/lib/camera-proctor.ts). A counter saying "a phone appeared twice" is
-- a model's claim, and a reviewer asked to act on a model's claim with nothing
-- to look at will either ignore every flag or trust every flag. Both are worse
-- than seeing the frame.
--
-- So at the moment a finding starts the browser sends one small photo — 320px
-- wide, capped at six per attempt — and this is where it lives.
--
-- PRIVACY, WHICH IS MOST OF THE DESIGN
--
--   * The bucket is private and storage.objects has no policy that reaches it,
--     so only the service role can read or write a photo. Students upload
--     through /api/proctor/snapshot; admins see them through short-lived signed
--     URLs on the integrity page. Nothing is ever public.
--
--   * Photos are deleted after 30 days by the daily cron, which is the period
--     the consent notice promises. Long enough to review and appeal a flag,
--     short enough that a room photo does not outlive its purpose.
--
--   * user_id carries no foreign key, on purpose. With ON DELETE CASCADE a
--     deleted account would drop these rows while its photos stayed in the
--     bucket, unreachable by the purge and kept indefinitely — the exact
--     opposite of what deleting an account is for. Without the key the row
--     survives until the purge removes the photo and the row together.
--
--   * No link to the attempt. The photo is matched to an integrity finding by
--     account and time window, which avoids threading an activity id through
--     ten surfaces and keeps this table write-only from the browser's side.
-- ============================================================================

create table if not exists public.proctor_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  kind         text not null
               check (kind in ('phone', 'multiple_faces', 'no_face', 'book')),
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);

comment on table public.proctor_snapshots is
  'One photo per camera finding. Private bucket proctor-evidence; purged after 30 days.';

-- The integrity page reads "this account, in this window"; the purge reads
-- "everything older than 30 days".
create index if not exists proctor_snapshots_user_time
  on public.proctor_snapshots (user_id, created_at desc);
create index if not exists proctor_snapshots_created
  on public.proctor_snapshots (created_at);

alter table public.proctor_snapshots enable row level security;

drop policy if exists "admins read proctor snapshots" on public.proctor_snapshots;
create policy "admins read proctor snapshots" on public.proctor_snapshots
  for select using (public.is_admin());

revoke all on public.proctor_snapshots from public;
revoke all on public.proctor_snapshots from anon, authenticated;
grant select, insert, delete on public.proctor_snapshots to service_role;

-- ---------------------------------------------------------------------------
-- The bucket. Private, JPEG only, and small enough that a request cannot use
-- it as free file hosting: 128 KB is roughly four times a 320px photo.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proctor-evidence', 'proctor-evidence', false, 131072, array['image/jpeg'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
