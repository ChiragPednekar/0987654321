-- ============================================================================
-- CaseCode — column-level READ privileges
-- ============================================================================
-- 20250101000004_column_privileges.sql locked down who may WRITE which column.
-- It never touched SELECT, and hosted Supabase bootstraps the public schema
-- with GRANT ALL to anon and authenticated. Combined with two deliberately
-- permissive row policies:
--
--   users              for select using (true)
--   cases              for select using (is_published or public.is_admin())
--
-- ...every column of both tables was world-readable through PostgREST with
-- nothing but the anon key, which ships inside the client bundle. Verified
-- against production on 2026-08-21:
--
--   GET /rest/v1/users?select=email          -> every registered email address
--   GET /rest/v1/cases?select=model_answer   -> all 504 worked solutions
--
-- RLS cannot fix this: policies are row-level, and both rows are legitimately
-- public. The leaderboard genuinely needs to show other people's names and XP,
-- and the case library genuinely needs to show other people's cases. Only a
-- column-level GRANT can separate "this row is public" from "this column is".
-- ============================================================================

-- ---------------------------------------------------------------- users ----

revoke select on public.users from anon, authenticated;

-- The leaderboard, public profile pages and campus rankings all read these,
-- for users other than the viewer. They are the intended public surface.
grant select (
  id, full_name, avatar_url, university, career_goal,
  xp, level, total_score, cases_solved, cases_attempted,
  current_streak, longest_streak, last_solved_on,
  created_at, updated_at
) on public.users to anon, authenticated;

-- `role` drives the admin guards in middleware and the (app)/admin pages,
-- which run under the caller's own JWT and so must be able to read it. It stays
-- readable to signed-in users but not to anonymous ones, so the set of
-- administrators is not enumerable from a logged-out browser.
grant select (role) on public.users to authenticated;

-- `email` is granted to nobody. It is not in either list above, so it is now
-- reachable only by the service role. The signed-in user's own address comes
-- from auth.getUser() — the session already carries it, so no feature loses
-- anything by this column becoming unreadable.

-- ---------------------------------------------------------------- cases ----

revoke select on public.cases from anon, authenticated;

-- Everything a student is meant to see: the problem, the data, the metadata
-- and the aggregate stats. `model_answer` is deliberately absent.
grant select (
  id, slug, title, domain, difficulty, category_id, company_track,
  estimated_minutes, scenario, supporting_data, attachments, instructions,
  expected_framework, tags, is_published, created_by,
  total_submissions, total_solved, avg_score, completion_rate,
  created_at, updated_at, format, firm_style, is_pro
) on public.cases to anon, authenticated;

-- `model_answer` is granted to nobody, including admins. The two places that
-- legitimately need it — grading in /api/submissions and the admin case editor
-- — both read it through the service-role client, which bypasses grants. An
-- admin editing a case is still shown the field; it simply arrives via a
-- server component that has already checked `role = 'admin'` rather than
-- through PostgREST under the browser's own JWT.
