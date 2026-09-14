-- ============================================================================
-- CaseCode — every kind of interview counts, and a GD room can see itself
-- ============================================================================
-- Two repairs.
--
-- 1. THE INTERVIEW ALLOWANCE COUNTED ONE KIND OF INTERVIEW
--
-- The HR interview (20250101000041), negotiation (20250101000043) and sales
-- role-play (20250101000052) routes all refuse to start once `interviewsLeft`
-- reaches zero. But quota_status() only ever counted chat_sessions, so none of
-- the three moved that number. The check was real and the meter behind it was
-- not: a student could start as many of them as they liked, each one a
-- multi-turn model conversation, while the case interviewer beside them stayed
-- correctly metered.
--
-- Each session is counted when it starts, like a chat session. Starting is the
-- moment the route spends the allowance check, and counting on completion
-- instead would let an abandoned session cost model calls and nothing else.
-- None of the three can be deleted by the student, so nothing refunds.
--
-- 2. GD ROOM POLICIES RECURSED
--
-- "gd participants visible to the room" answered "is this user in the room?"
-- by reading gd_participants — from inside the policy on gd_participants.
-- Postgres refuses that outright ("infinite recursion detected in policy"),
-- and because the policies on gd_sessions, gd_utterances and gd_scores all
-- read gd_participants too, every signed-in read of any of the four failed.
-- The pages were unaffected because they read through the service role; the
-- live transcript was not, because Realtime checks each change against the
-- subscriber's own policies. So other participants' lines never arrived.
--
-- The membership question moves into a SECURITY DEFINER helper, the same
-- pattern as is_group_member(): it reads the table without re-entering its
-- policy. It only ever answers for auth.uid(), so it reveals nothing about
-- anyone else.
--
-- Separately, gd_utterances was never added to the Realtime publication, so
-- the subscription had nothing to receive even before a policy was consulted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. quota_status()
-- ----------------------------------------------------------------------------

/**
 * quota_status(), counting every interview kind.
 *
 * Supersedes 20250101000053. Identical except that interviews_used now adds
 * HR interviews, negotiations and sales role-plays started in the window.
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
        and r.created_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.deck_reviews d
      where d.user_id = p_user
        and d.created_at > now() - make_interval(days => p_window_days)),
    (select count(*) from public.chat_sessions c
      where c.user_id = p_user
        and c.created_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.pi_sessions p
      where p.user_id = p_user
        and p.started_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.negotiation_sessions n
      where n.user_id = p_user
        and n.started_at > now() - make_interval(days => p_window_days))
    + (select count(*) from public.sales_sessions x
      where x.user_id = p_user
        and x.started_at > now() - make_interval(days => p_window_days))
  from pro, override, deactivated;
$$;

-- Restated for the same reason as in 20250101000047: 20250101000029
-- established that this takes a user id and must be unreachable except by the
-- service role. Revoking from PUBLIC is the part that actually closes it.
revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. GD room membership, without recursion
-- ----------------------------------------------------------------------------

create or replace function public.is_gd_participant(p_session uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.gd_participants
    where session_id = p_session and user_id = auth.uid()
  );
$$;

-- An RLS helper: policies run as the querying role, so `authenticated` needs
-- EXECUTE (see 20250101000029 on why the other helpers keep theirs). anon has
-- no grant on any GD table, so it never reaches these policies.
revoke execute on function public.is_gd_participant(uuid) from public, anon;
grant execute on function public.is_gd_participant(uuid) to authenticated, service_role;

drop policy if exists "gd participants visible to the room" on public.gd_participants;
create policy "gd participants visible to the room" on public.gd_participants
  for select using (user_id = auth.uid() or public.is_gd_participant(session_id));

drop policy if exists "gd sessions visible" on public.gd_sessions;
create policy "gd sessions visible" on public.gd_sessions
  for select using (
    status = 'open'
    or host_id = auth.uid()
    or public.is_gd_participant(id)
  );

drop policy if exists "gd transcript visible to the room" on public.gd_utterances;
create policy "gd transcript visible to the room" on public.gd_utterances
  for select using (public.is_gd_participant(session_id));

drop policy if exists "gd scores visible to the room" on public.gd_scores;
create policy "gd scores visible to the room" on public.gd_scores
  for select using (public.is_gd_participant(session_id));

-- The live transcript subscribes to inserts here. Guarded because a plain
-- Postgres without Supabase has no such publication.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'gd_utterances'
     ) then
    alter publication supabase_realtime add table public.gd_utterances;
  end if;
end $$;
