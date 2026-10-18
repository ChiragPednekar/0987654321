-- ==========================================================================
-- Group discussions as shareable meetings
-- ==========================================================================

alter table public.gd_sessions
  add column if not exists join_policy text not null default 'open'
  check (join_policy in ('open', 'approval'));

alter table public.gd_participants
  add column if not exists admission_status text not null default 'approved'
  check (admission_status in ('pending', 'approved', 'rejected'));

create index if not exists gd_participants_pending_idx
  on public.gd_participants (session_id, joined_at)
  where admission_status = 'pending';

-- Pending requests are not room members. This helper is used by the RLS
-- policies for sessions, participant lists, transcripts and messages.
create or replace function public.is_gd_participant(p_session uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.gd_participants
    where session_id = p_session
      and user_id = auth.uid()
      and admission_status = 'approved'
      and left_at is null
  );
$$;

revoke execute on function public.is_gd_participant(uuid) from public, anon;
grant execute on function public.is_gd_participant(uuid) to authenticated, service_role;

drop policy if exists "gd participants visible to the room" on public.gd_participants;
create policy "gd participants visible to the room" on public.gd_participants
  for select using (
    user_id = auth.uid()
    or (
      admission_status = 'approved'
      and left_at is null
      and public.is_gd_participant(session_id)
    )
  );

drop policy if exists "gd sessions visible" on public.gd_sessions;
create policy "gd sessions visible" on public.gd_sessions
  for select using (
    (join_policy = 'open' and status = 'open')
    or host_id = auth.uid()
    or public.is_gd_participant(id)
  );

-- Call signaling and reactions use the same topic as the room presence. Make
-- it a private Realtime channel and require an active, approved participant
-- for both receiving and sending broadcast or presence messages.
drop policy if exists "GD room members can receive realtime" on realtime.messages;
create policy "GD room members can receive realtime" on realtime.messages
  for select to authenticated using (
    extension in ('broadcast', 'presence')
    and case
      when realtime.topic() ~ '^gd:[0-9a-fA-F-]{36}$'
        then public.is_gd_participant(substring(realtime.topic() from 4)::uuid)
      else false
    end
  );

drop policy if exists "GD room members can send realtime" on realtime.messages;
create policy "GD room members can send realtime" on realtime.messages
  for insert to authenticated with check (
    extension in ('broadcast', 'presence')
    and case
      when realtime.topic() ~ '^gd:[0-9a-fA-F-]{36}$'
        then public.is_gd_participant(substring(realtime.topic() from 4)::uuid)
      else false
    end
  );

create table if not exists public.gd_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.gd_sessions(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  body         text check (body is null or length(body) between 1 and 2000),
  media_path   text,
  media_kind   text check (media_kind is null or media_kind in ('image', 'video')),
  media_name   text,
  created_at   timestamptz not null default now(),
  constraint gd_messages_have_content check (body is not null or media_path is not null),
  constraint gd_messages_media_pair check (
    (media_path is null and media_kind is null)
    or (media_path is not null and media_kind is not null)
  )
);

create index if not exists gd_messages_session_created_idx
  on public.gd_messages (session_id, created_at desc);

alter table public.gd_messages enable row level security;
drop policy if exists "gd messages visible to the room" on public.gd_messages;
create policy "gd messages visible to the room" on public.gd_messages
  for select using (public.is_gd_participant(session_id));

revoke all on public.gd_messages from public, anon, authenticated;
grant select on public.gd_messages to authenticated;
grant select, insert, update, delete on public.gd_messages to service_role;

-- Attachments stay private. Server routes issue short-lived upload and
-- download URLs only to approved room members. Storage itself caps files at
-- 25 MB and restricts uploads to common image/video formats.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gd-chat-media',
  'gd-chat-media',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'gd_messages'
     ) then
    alter publication supabase_realtime add table public.gd_messages;
  end if;
end $$;
