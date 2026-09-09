-- ============================================================================
-- CaseCode — who may actually solve a case
-- ============================================================================
-- Until now anyone who signed up could attempt anything. That is the wrong
-- shape for a campus licensing business: the library is the shop window, and
-- the thing being sold is the right to practise against it and be graded.
--
-- So browsing stays open to everyone — the case library, learning paths,
-- leaderboards and a case's own scenario text are all still public, because
-- they are what convinces a placement cell to buy. Submitting an answer,
-- running a drill, building a model or talking to the AI interviewer now
-- require an entitled account.
--
-- Three ways to be entitled, in the order they are checked:
--
--   1. An elevated role grant (teacher, admin, recruiter). The people running
--      the platform must be able to use it.
--   2. An explicit entry in solve_allowlist. For individuals — the owner's own
--      student account, a pilot user, a reviewer — without inventing an
--      institution for one person.
--   3. Membership of an institution whose licence is live and not suspended.
--      This is the path that matters commercially: a college buys, its domain
--      is registered, and its students are entitled on signup.
--
-- Deliberately NOT role-based on its own. The owner's personal student account
-- is a plain `student` like any stranger's, so a role check would either lock
-- him out or let everybody in.
-- ============================================================================

create table if not exists public.solve_allowlist (
  email      citext primary key,
  note       text,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.solve_allowlist is
  'Individual accounts entitled to solve, outside any institution licence.';

alter table public.solve_allowlist enable row level security;

-- Admins manage it through the app. anon and authenticated get nothing, so the
-- list of entitled people cannot be enumerated over the REST API.
drop policy if exists "admins manage solve allowlist" on public.solve_allowlist;
create policy "admins manage solve allowlist" on public.solve_allowlist
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.solve_allowlist from anon, authenticated;
grant select, insert, update, delete on public.solve_allowlist to service_role;

-- ----------------------------------------------------------------------------
-- The entitlement check.
-- ----------------------------------------------------------------------------
create or replace function public.can_solve(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_user
      and u.deactivated_at is null
      and (
        -- 1. Runs the platform.
        exists (select 1 from public.role_grants g where g.email = u.email::citext)

        -- 2. Named individually.
        or exists (select 1 from public.solve_allowlist a where a.email = u.email::citext)

        -- 3. Covered by a live campus licence. Matched on membership rather
        --    than on the email domain alone, so revoking a seat actually
        --    revokes access — a domain check would keep letting them in.
        or exists (
          select 1
          from public.institution_members m
          join public.institutions i on i.id = m.institution_id
          where m.user_id = u.id
            and not i.is_suspended
            and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
            and (i.licence_ends_on is null or i.licence_ends_on >= current_date)
        )
      )
  );
$$;

comment on function public.can_solve(uuid) is
  'True when the account may submit answers, run drills, build models or use the interviewer.';

-- Takes a user id as an argument rather than from auth.uid(), so it must not be
-- reachable by anon or authenticated — that is exactly how has_pro() leaked
-- every account''s plan to the internet. The application calls it with the
-- service-role client only.
revoke execute on function public.can_solve(uuid) from public, anon, authenticated;
grant execute on function public.can_solve(uuid) to service_role;

create index if not exists institution_members_user_idx
  on public.institution_members (user_id);
