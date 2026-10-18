-- ==========================================================================
-- Group discussions: teacher classrooms and custom topics
-- ==========================================================================

alter table public.gd_sessions
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;

create index if not exists gd_sessions_classroom_idx
  on public.gd_sessions (classroom_id)
  where classroom_id is not null;

-- Update visibility to also allow classroom members to view sessions tied to their batch
drop policy if exists "gd sessions visible" on public.gd_sessions;
create policy "gd sessions visible" on public.gd_sessions
  for select using (
    (join_policy = 'open' and status = 'open')
    or host_id = auth.uid()
    or public.is_gd_participant(id)
    or (
      classroom_id is not null
      and exists (
        select 1 from public.classroom_members
        where classroom_id = gd_sessions.classroom_id
          and user_id = auth.uid()
      )
    )
  );
