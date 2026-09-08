-- ============================================================================
-- CaseCode — email allowlist as the single source of role truth
-- ============================================================================
-- Until now every account was a student by default (users.role defaults to
-- 'student') and teacher/admin was conferred by hand-editing the row in SQL.
-- That is fine while there are five accounts and one person editing them, and
-- it stops being fine the moment a campus signs up: there is no record of who
-- granted what, no way to prepare access before someone signs up, and the only
-- audit trail is a psql history nobody kept.
--
-- Roles now come from an allowlist keyed on email:
--
--   not listed  -> student. This is the public path: anyone who finds the site
--                  and signs up gets the student dashboard, and nothing else.
--   listed      -> the role in the row, applied at signup AND to an account
--                  that already exists.
--
-- The table is the source of truth in both directions: adding a row promotes,
-- removing one demotes back to student. That matters because access you cannot
-- revoke is not access control.
--
-- `citext` so Chirag@Example.com and chirag@example.com are the same person —
-- OAuth providers do not agree on case, and an allowlist that misses on
-- capitalisation fails open into a support ticket.
-- ============================================================================

create table if not exists public.role_grants (
  email      citext primary key,
  role       public.user_role not null,
  note       text,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_grants_role_is_elevated
    -- 'student' is the default for everyone; a row saying "this person is a
    -- student" would imply the absence of a row means something else.
    check (role <> 'student')
);

comment on table public.role_grants is
  'Email allowlist for elevated roles. Absent = student.';

alter table public.role_grants enable row level security;

-- Readable and writable only by admins through the app; the anon and
-- authenticated roles get nothing at all, so the allowlist cannot be
-- enumerated by someone probing the REST API for who the admins are.
create policy "admins manage role grants" on public.role_grants
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.role_grants from anon, authenticated;
grant select, insert, update, delete on public.role_grants to service_role;

-- ----------------------------------------------------------------------------
-- The role an email is entitled to.
-- ----------------------------------------------------------------------------
create or replace function public.role_for_email(p_email citext)
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select g.role from public.role_grants g where g.email = p_email),
    'student'::public.user_role
  );
$$;

revoke execute on function public.role_for_email(citext) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Signup honours the allowlist.
-- ----------------------------------------------------------------------------
-- Supersedes the version that let users.role fall to its default. Everything
-- else — the profile insert and the institution seat claim — is unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_domain text;
  v_inst   public.institutions%rowtype;
  v_used   integer;
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    -- The allowlist, not the client. Nothing a person can put in the signup
    -- form influences this.
    public.role_for_email(new.email::citext)
  )
  on conflict (id) do nothing;

  v_domain := lower(split_part(new.email, '@', 2));

  select * into v_inst
  from public.institutions
  where email_domain = v_domain
    and (licence_ends_on is null or licence_ends_on >= current_date)
  limit 1;

  if found then
    select count(*) into v_used
    from public.institution_members
    where institution_id = v_inst.id;

    if v_inst.seats_licensed = 0 or v_used < v_inst.seats_licensed then
      insert into public.institution_members (institution_id, user_id, role)
      values (v_inst.id, new.id, 'student')
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Changing the allowlist changes the account, immediately.
-- ----------------------------------------------------------------------------
-- Without this the table would only affect people who had not signed up yet,
-- which is the opposite of useful: the person you want to promote is usually
-- the one already waiting on the wrong dashboard.
create or replace function public.sync_role_from_grants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.users set role = 'student' where email = old.email;
    return old;
  end if;

  update public.users set role = new.role where email = new.email;

  -- An email changing owner mid-grant would otherwise leave the old account
  -- elevated for ever.
  if tg_op = 'UPDATE' and new.email <> old.email then
    update public.users set role = 'student' where email = old.email;
  end if;

  return new;
end;
$$;

drop trigger if exists role_grants_sync on public.role_grants;
create trigger role_grants_sync
  after insert or update or delete on public.role_grants
  for each row execute function public.sync_role_from_grants();

-- ----------------------------------------------------------------------------
-- Do not let the platform lose its last administrator.
-- ----------------------------------------------------------------------------
-- Same failure the self-deactivation guard prevents: recovering from it needs
-- direct database access, and it would be discovered at the worst moment.
create or replace function public.protect_last_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
  from public.role_grants
  where role = 'admin'
    and email <> coalesce(old.email, '');

  if v_remaining = 0 and (tg_op = 'DELETE' or new.role <> 'admin') then
    raise exception
      'Refusing to remove the last admin grant — promote another admin first.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists role_grants_protect_last_admin on public.role_grants;
create trigger role_grants_protect_last_admin
  before update or delete on public.role_grants
  for each row when (old.role = 'admin')
  execute function public.protect_last_admin_grant();

create index if not exists role_grants_role_idx on public.role_grants (role);
