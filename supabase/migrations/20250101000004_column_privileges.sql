-- ============================================================================
-- CaseCode — column-level privileges
-- ============================================================================
-- RLS policies are ROW level. A policy of the form
--
--   using (auth.uid() = id) with check (auth.uid() = id)
--
-- correctly stops a student updating *someone else's* row, but does nothing to
-- stop them updating any COLUMN of their own row — including `role`, `xp` and
-- `total_score`. With only the public anon key and their own session, a student
-- could run:
--
--   update users set role = 'admin', xp = 999999 where id = auth.uid();
--
-- and it would succeed under those policies alone.
--
-- Column-level GRANTs are what actually closes this. They also leave SECURITY
-- DEFINER functions unaffected — the triggers that legitimately maintain xp,
-- streaks and counters run as the function owner, not as the caller.
--
-- Note on scope: tables that admins write from the browser under their own JWT
-- (cases, rubrics, categories, contests, learning paths) deliberately keep their
-- table-level grants and are governed by the `public.is_admin()` policies in
-- 20250101000002_policies.sql. Admins are trusted with every column there.
-- ============================================================================

-- ---------------------------------------------------------------- users ----

revoke update on public.users from authenticated, anon;

-- Exactly the fields the profile form is allowed to touch. `role`, `xp`,
-- `level`, `total_score`, `cases_solved`, streaks and `email` are not here,
-- and so cannot be written by a student under any circumstances.
grant update (full_name, avatar_url, university, career_goal)
  on public.users to authenticated;

-- ---------------------------------------------------------- submissions ----

revoke update on public.submissions from authenticated, anon;

-- A user may publish or unpublish their own solution. They may not rewrite the
-- answer after it has been graded, nor move it between statuses, nor edit the
-- recorded time spent.
grant update (is_public) on public.submissions to authenticated;

-- ------------------------------------------------------------- comments ----

revoke update on public.comments from authenticated, anon;

-- Edit your own text; the upvote counter is trigger-maintained.
grant update (body) on public.comments to authenticated;

-- -------------------------------------------------- contest submissions ----

-- Entries are created by /api/contests/[id]/start using the service role, so
-- that `started_at` — the basis of the speed bonus — is stamped by the server
-- and can never be backdated by the client. Remove the now-redundant insert
-- policy so the intent is unambiguous.
drop policy if exists "users register themselves for contests"
  on public.contest_submissions;

revoke insert, update, delete on public.contest_submissions
  from authenticated, anon;

-- --------------------------------------------------- score integrity -------

-- Scores, achievements, leaderboards, badges and activity are service-role or
-- trigger-only. They already have no INSERT/UPDATE policy; revoking the
-- privilege as well means the protection does not rest on a single mechanism.
revoke insert, update, delete on public.scores        from authenticated, anon;
revoke insert, update, delete on public.achievements  from authenticated, anon;
revoke insert, update, delete on public.leaderboards  from authenticated, anon;
revoke insert, update, delete on public.user_activity from authenticated, anon;
revoke insert, update, delete on public.badges        from anon;
revoke update, delete         on public.user_path_progress from authenticated, anon;

-- ------------------------------------------------- anon stays read-only ----

revoke insert, update, delete on public.submissions      from anon;
revoke insert, update, delete on public.comments         from anon;
revoke insert, update, delete on public.comment_votes    from anon;
revoke insert, update, delete on public.submission_votes from anon;
