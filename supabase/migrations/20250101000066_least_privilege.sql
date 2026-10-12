-- ============================================================================
-- CaseCode — least privilege for the public API roles
-- ============================================================================
-- Row-level security decides WHICH rows a role reaches. Table grants decide
-- WHAT it may do at all, and Supabase's defaults grant `anon` (anyone holding
-- the public key) and `authenticated` nearly everything, leaving RLS as the
-- only wall. This removes what neither role has any use for, so a policy
-- written too loosely tomorrow is not automatically an open door.
--
-- Deploy the code that ships with this BEFORE applying it: /api/submissions
-- must already insert with the service role, or every graded answer fails.
-- ============================================================================

-- 1. Powers no API caller needs. TRUNCATE in particular ignores RLS entirely.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- 2. Signed-out visitors read; they never write. No write policy admits them
--    today (every one requires auth.uid()), and now no grant does either.
revoke insert, update, delete on all tables in schema public from anon;

-- 3. Submissions are created only by /api/submissions, as the service role.
--    A direct insert through the public API skipped the licence, quota,
--    contest-window, proctoring and lockout checks — and the assignment
--    trigger still filed the answer with the student's teacher.
revoke insert on public.submissions from authenticated;

-- 4. Comments: the four columns a comment is written with, and nothing else.
--    Previously `upvotes` and `is_deleted` could be set on insert.
revoke insert on public.comments from authenticated;
grant insert (case_id, user_id, parent_id, body) on public.comments to authenticated;

-- 5. The same for every table created from now on.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

-- 6. A trigger function has no business on the RPC surface. Triggers fire
--    without the EXECUTE privilege, so the signup gate keeps working.
revoke execute on function public.reject_unlisted_signup() from public, anon, authenticated;

-- 7. has_access(user) answered for ANY user id, so anyone could ask whether a
--    given account is on the invite list. It now answers only for the caller
--    — which is all the RLS policies (no argument) and the proxy (its own id)
--    ever ask — or for the service role.
create or replace function public.has_access(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.users u
    join public.access_allowlist a on a.email = u.email::citext
    where u.id = p_user
      and (p_user = auth.uid() or auth.role() = 'service_role')
  );
$function$;

-- 8. The platform-wide daily AI cap (src/lib/ai/providers.ts) counts the last
--    24 hours of usage before every model call; this keeps that count cheap.
create index if not exists usage_events_created
  on public.usage_events (created_at);
