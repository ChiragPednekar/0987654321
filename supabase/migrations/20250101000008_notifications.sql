-- Notifications.
--
-- Inserts are server-side only (service role). A user may read their own rows
-- and mark them read, nothing else — a column-level grant on `read_at` is what
-- enforces that, since a row-level policy alone would let them rewrite the
-- title and href of a notification they were sent.

do $$ begin
  create type notification_type as enum (
    'grade_ready','badge_earned','level_up','contest_starting','contest_result','comment_reply','system'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       notification_type not null default 'system',
  title      text not null,
  body       text,
  -- Relative path within the app. Never an absolute URL: this is rendered as a
  -- link, and an attacker-controlled origin here would be an open redirect.
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "own notifications are readable" on public.notifications
  for select using (auth.uid() = user_id);
create policy "own notifications are updatable" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.notifications to authenticated;
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;
