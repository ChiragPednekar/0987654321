-- ============================================================================
-- CaseCode — function hardening
-- ============================================================================
-- Found by Supabase's database linter after the first deploy. Two real issues:
--
-- 1. Every function in `public` is exposed as a PostgREST RPC endpoint at
--    /rest/v1/rpc/<name>. `sync_contest_statuses()` is a plain SECURITY DEFINER
--    function taking no arguments, so before this migration ANY anonymous
--    visitor could POST to that endpoint and move every contest between
--    scheduled/live/grading. The other maintenance functions were already
--    revoked in 20250101000002_policies.sql; this one was missed.
--
--    Trigger functions are lower risk (Postgres refuses to call them directly),
--    but they are revoked too so the exposed RPC surface is empty by default.
--
-- 2. Functions without a fixed `search_path` can be hijacked by a caller who
--    puts a malicious object earlier in their own search_path. Pin it.
-- ============================================================================

-- ------------------------------------------- 1. close the RPC surface ------

revoke execute on function public.sync_contest_statuses()   from public, anon, authenticated;
revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.on_submission_insert()    from public, anon, authenticated;
revoke execute on function public.after_submission_insert() from public, anon, authenticated;
revoke execute on function public.after_score_insert()      from public, anon, authenticated;
revoke execute on function public.sync_comment_votes()      from public, anon, authenticated;
revoke execute on function public.sync_submission_votes()   from public, anon, authenticated;
revoke execute on function public.set_updated_at()          from public, anon, authenticated;

-- `is_admin()` stays callable by signed-in users: the RLS policies invoke it,
-- and it only ever reports on the caller's own row.

-- --------------------------------------------- 2. pin the search_path ------

alter function public.set_updated_at()      set search_path = public, pg_temp;
alter function public.level_for_xp(integer) set search_path = public, pg_temp;
alter function public.xp_for_level(integer) set search_path = public, pg_temp;
alter function public.compute_speed_bonus(integer, integer, integer)
  set search_path = public, pg_temp;

-- NOTE: the linter also flags `citext` being installed in the `public` schema.
-- Moving it would require rewriting the `users.email` column type, so it is
-- left in place deliberately — it is a namespacing preference, not a
-- vulnerability.
