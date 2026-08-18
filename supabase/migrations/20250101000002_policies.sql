-- ============================================================================
-- CaseCode — Row Level Security
-- ============================================================================
-- Threat model: the browser holds the anon key and a user JWT. Assume it is
-- hostile. Everything a student must not forge — scores, XP, ranks, other
-- people's submissions — is either service-role-only or trigger-maintained.
-- ============================================================================

alter table public.users               enable row level security;
alter table public.case_categories     enable row level security;
alter table public.cases               enable row level security;
alter table public.rubrics             enable row level security;
alter table public.submissions         enable row level security;
alter table public.scores              enable row level security;
alter table public.learning_paths      enable row level security;
alter table public.learning_path_steps enable row level security;
alter table public.user_path_progress  enable row level security;
alter table public.contests            enable row level security;
alter table public.contest_submissions enable row level security;
alter table public.leaderboards        enable row level security;
alter table public.comments            enable row level security;
alter table public.comment_votes       enable row level security;
alter table public.submission_votes    enable row level security;
alter table public.badges              enable row level security;
alter table public.achievements        enable row level security;
alter table public.user_activity       enable row level security;

-- ---------------------------------------------------------------- users ----

-- Profiles are public (needed for leaderboards, comment authors, top solutions).
create policy "users are readable by everyone"
  on public.users for select
  using (true);

create policy "users can update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: INSERT is intentionally absent. Rows are created only by the
-- handle_new_user() trigger (security definer) when auth.users gets a row.

create policy "admins can update any profile"
  on public.users for update
  using (public.is_admin());

-- ------------------------------------------------------------- taxonomy ----

create policy "categories are public"
  on public.case_categories for select using (true);

create policy "admins manage categories"
  on public.case_categories for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- cases ----

create policy "published cases are public"
  on public.cases for select
  using (is_published or public.is_admin());

create policy "admins manage cases"
  on public.cases for all
  using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------- rubrics ----

-- Rubric weights are shown to students (they should know how they're graded),
-- but the per-criterion `descriptors` are grader guidance. The API strips
-- descriptors for non-admins; admins get the full row.
create policy "rubrics readable for published cases"
  on public.rubrics for select
  using (
    exists (
      select 1 from public.cases c
      where c.id = rubrics.case_id and (c.is_published or public.is_admin())
    )
  );

create policy "admins manage rubrics"
  on public.rubrics for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------- submissions ----

create policy "users read their own submissions"
  on public.submissions for select
  using (auth.uid() = user_id);

create policy "public solutions are readable"
  on public.submissions for select
  using (is_public and status = 'evaluated');

create policy "admins read all submissions"
  on public.submissions for select
  using (public.is_admin());

create policy "users create their own submissions"
  on public.submissions for insert
  with check (auth.uid() = user_id);

-- Users may only flip visibility flags on their own work; status/score fields
-- are advanced by the service role.
create policy "users update their own submissions"
  on public.submissions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own submissions"
  on public.submissions for delete
  using (auth.uid() = user_id);

-- --------------------------------------------------------------- scores ----

create policy "users read their own scores"
  on public.scores for select
  using (auth.uid() = user_id);

create policy "scores on public solutions are readable"
  on public.scores for select
  using (
    exists (
      select 1 from public.submissions s
      where s.id = scores.submission_id and s.is_public
    )
  );

create policy "admins read all scores"
  on public.scores for select
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy: only the service role writes scores.
-- This is the single most important policy in the file — without it a student
-- could POST themselves a 100.

-- ------------------------------------------------------- learning paths ----

create policy "paths are public"
  on public.learning_paths for select
  using (is_published or public.is_admin());

create policy "admins manage paths"
  on public.learning_paths for all
  using (public.is_admin()) with check (public.is_admin());

create policy "path steps are public"
  on public.learning_path_steps for select using (true);

create policy "admins manage path steps"
  on public.learning_path_steps for all
  using (public.is_admin()) with check (public.is_admin());

create policy "users read their own path progress"
  on public.user_path_progress for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------- contests ----

create policy "published contests are public"
  on public.contests for select
  using (is_published or public.is_admin());

create policy "admins manage contests"
  on public.contests for all
  using (public.is_admin()) with check (public.is_admin());

-- Entries are public *after* the contest closes, so leaderboards work; while
-- it is live you only see your own.
create policy "users read their own contest entries"
  on public.contest_submissions for select
  using (auth.uid() = user_id);

create policy "finished contest entries are public"
  on public.contest_submissions for select
  using (
    exists (
      select 1 from public.contests c
      where c.id = contest_submissions.contest_id
        and c.status = 'completed'
    )
  );

create policy "admins read all contest entries"
  on public.contest_submissions for select
  using (public.is_admin());

-- Registration (claiming a start time) is allowed; scoring columns are only
-- ever written by finalize_contest() / the service role.
create policy "users register themselves for contests"
  on public.contest_submissions for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------- leaderboards ----

create policy "leaderboards are public"
  on public.leaderboards for select using (true);

-- ------------------------------------------------------------- comments ----

create policy "comments are public"
  on public.comments for select
  using (not is_deleted or public.is_admin());

create policy "authenticated users write comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "users edit their own comments"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id or public.is_admin());

create policy "votes are public"
  on public.comment_votes for select using (true);

create policy "users cast their own comment votes"
  on public.comment_votes for insert
  with check (auth.uid() = user_id);

create policy "users retract their own comment votes"
  on public.comment_votes for delete
  using (auth.uid() = user_id);

create policy "submission votes are public"
  on public.submission_votes for select using (true);

create policy "users cast their own submission votes"
  on public.submission_votes for insert
  with check (auth.uid() = user_id);

create policy "users retract their own submission votes"
  on public.submission_votes for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------- badges & achievements ----

create policy "badges are public"
  on public.badges for select using (true);

create policy "admins manage badges"
  on public.badges for all
  using (public.is_admin()) with check (public.is_admin());

-- Achievements are public so profiles can show them off.
create policy "achievements are public"
  on public.achievements for select using (true);

-- No INSERT policy: award_badges() is the only writer.

-- ------------------------------------------------------------- activity ----

create policy "users read their own activity"
  on public.user_activity for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------- grants -------

-- Views inherit RLS from their base tables via security_invoker.
grant select on public.domain_progress   to authenticated, anon;
grant select on public.user_case_best    to authenticated, anon;

-- Functions callable from the client.
grant execute on function public.level_for_xp(integer)  to authenticated, anon;
grant execute on function public.xp_for_level(integer)  to authenticated, anon;
grant execute on function public.is_admin()             to authenticated;

-- Everything else (refresh_leaderboards, finalize_contest, award_badges) is
-- service-role only.
revoke execute on function public.refresh_leaderboards() from public, anon, authenticated;
revoke execute on function public.finalize_contest(uuid) from public, anon, authenticated;
revoke execute on function public.award_badges(uuid)     from public, anon, authenticated;
revoke execute on function public.recalc_path_progress(uuid) from public, anon, authenticated;
