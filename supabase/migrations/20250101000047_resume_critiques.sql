-- ============================================================================
-- CaseCode — resume bullet critique
-- ============================================================================
-- A student pastes their CV bullets and gets each one judged and rewritten, in
-- one model call. The cheapest AI feature on the platform and the one with the
-- highest perceived value, because the CV is the document every shortlist is
-- made from.
--
-- A REWRITE NEVER INVENTS A NUMBER
--
-- Asked to "add impact", a model turns "improved onboarding" into "cut
-- onboarding time by 40%". Pasted into a CV, that is a claim the student never
-- measured and will be asked about. So any number in a rewrite that was not in
-- the original is replaced with [X] before the result is stored — in code, in
-- src/lib/resume.ts, not as a request in the prompt. `result` is only ever
-- written after that pass.
--
-- IT SPENDS THE GRADING ALLOWANCE
--
-- A critique is a graded piece of work with a model cost, so it counts against
-- the same annual grading quota as a case answer: quota_status() below now adds
-- critiques to scores. Resubmitting the same bullets for the same role returns
-- the stored critique rather than paying, or charging the student, twice.
--
-- DELETING ERASES THE CONTENT, NOT THE ROW
--
-- A CV is personal data and a student must be able to remove it. But if a
-- deleted row stopped counting, deleting old critiques would hand back quota.
-- So deletion (done by the route, as the service role) clears bullets, role and
-- result and stamps `erased_at`, leaving a row that holds nothing about the
-- person and still counts. Students therefore get SELECT only — no DELETE.
-- ============================================================================

create table if not exists public.resume_critiques (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  target_role text,
  bullets     text[],
  -- sha256 of the role and bullets, for returning a stored critique instead of
  -- paying for the same one again. Cleared on erasure along with the content.
  input_hash  text,
  result      jsonb,
  model       text,
  erased_at   timestamptz,
  created_at  timestamptz not null default now(),

  constraint resume_critiques_erased_is_empty check (
    erased_at is null
    or (bullets is null and result is null and target_role is null and input_hash is null)
  )
);

comment on table public.resume_critiques is
  'Resume bullet critiques. Erased rows keep no content but still count toward the grading quota.';

create index if not exists resume_critiques_user_idx
  on public.resume_critiques (user_id, created_at desc);
create index if not exists resume_critiques_hash_idx
  on public.resume_critiques (user_id, input_hash) where erased_at is null;

alter table public.resume_critiques enable row level security;

drop policy if exists "own resume critiques" on public.resume_critiques;
create policy "own resume critiques" on public.resume_critiques
  for select using (user_id = auth.uid());

-- Created and erased only through /api/resume/critiques, as the service role.
revoke all on public.resume_critiques from anon, authenticated;
grant select on public.resume_critiques to authenticated;
grant select, insert, update, delete on public.resume_critiques to service_role;

/**
 * quota_status(), counting resume critiques as gradings.
 *
 * Supersedes 20250101000026. Identical except for gradings_used, which now adds
 * critiques in the window to scores — erased ones included, which is the point.
 */
create or replace function public.quota_status(
  p_user               uuid,
  p_window_days        integer,
  p_default_gradings   integer,
  p_default_interviews integer
)
returns table (
  is_pro          boolean,
  grading_limit   integer,
  interview_limit integer,
  gradings_used   bigint,
  interviews_used bigint
)
language sql stable security definer set search_path = public, pg_temp as $$
  with deactivated as (
    select exists (
      select 1 from public.users u
      where u.id = p_user and u.deactivated_at is not null
    ) as off
  ),
  pro as (
    select public.has_pro(p_user) as ok
  ),
  override as (
    select max(i.grading_quota) as g, max(i.interview_quota) as v
    from public.institution_members m
    join public.institutions i on i.id = m.institution_id
    where m.user_id = p_user
      and not i.is_suspended
      and (i.licence_starts_on is null or i.licence_starts_on <= current_date)
      and (i.licence_ends_on   is null or i.licence_ends_on   >= current_date)
  )
  select
    pro.ok,
    case when deactivated.off then 0
         else coalesce(override.g, p_default_gradings) end,
    case when deactivated.off then 0
         else coalesce(override.v, p_default_interviews) end,
    (select count(*) from public.scores s
      where s.user_id = p_user
        and s.evaluated_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.resume_critiques r
      where r.user_id = p_user
        and r.created_at > now() - make_interval(days => p_window_days)),
    (select count(*) from public.chat_sessions c
      where c.user_id = p_user
        and c.created_at > now() - make_interval(days => p_window_days))
  from pro, override, deactivated;
$$;

-- `create or replace` keeps the existing ACL, but restate it: 20250101000029
-- established that this takes a user id and must be unreachable except by the
-- service role. Revoking from PUBLIC is the part that actually closes it.
revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, anon, authenticated;
