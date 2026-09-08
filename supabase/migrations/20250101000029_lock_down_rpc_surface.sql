-- ============================================================================
-- CaseCode — stop exposing helper functions over the public REST API
-- ============================================================================
-- Every function in `public` is published by PostgREST as an RPC endpoint, and
-- the anon key ships inside the browser bundle. So "callable by anon" means
-- "callable by anybody on the internet", and SECURITY DEFINER means the
-- function answers with the owner's privileges — RLS never gets a say.
--
-- Verified against production before writing this:
--
--   POST /rest/v1/rpc/has_pro {"p_user":"<another user's id>"}
--     as anon           -> true
--   POST /rest/v1/rpc/quota_status {"p_user":"<the admin's id>", ...}
--     as a signed-in student
--     -> [{"is_pro":true,"grading_limit":60,"interview_limit":10, ...}]
--
-- Neither takes the caller from auth.uid(); both take the user id as an
-- argument and trust it. So anyone could enumerate which accounts are Pro, and
-- any signed-in user could read anyone else's plan and remaining AI allowance.
-- That is commercial information about another customer.
--
-- Nothing legitimate breaks by revoking:
--   * The application calls quota_status() through the service-role client
--     (src/lib/quota.ts), which is not subject to these grants.
--   * has_pro() is not called over RPC by the application at all.
--   * Neither is referenced by any RLS policy, view, or other function —
--     checked against pg_policy, pg_views and pg_proc.
--
-- That last point is why this migration does NOT touch is_admin(),
-- is_group_member(), is_classroom_member(), is_classroom_teacher(),
-- is_institution_staff() or institution_role_of(), which the linter flags for
-- the same reason. RLS policies are evaluated as the querying role, so
-- `authenticated` genuinely needs EXECUTE on them — is_admin() alone backs 23
-- policies. Revoking those would deny every policy that calls them and take
-- the platform down. They are SECURITY DEFINER precisely so they can read the
-- tables the policy protects.
-- ============================================================================

-- `from public` matters, and is not belt-and-braces. Postgres grants EXECUTE on
-- every new function to the PUBLIC pseudo-role, which anon and authenticated
-- inherit. Revoking from those two roles by name leaves the PUBLIC grant in
-- place and changes nothing — verified the hard way: after revoking from anon
-- and authenticated alone, an unauthenticated /rest/v1/rpc/has_pro still
-- answered `true`. The ACL showed why — `=X/postgres` is the PUBLIC grant.
-- quota_status() was already immune because 20250101000028 revoked it from
-- `public` explicitly, which is the pattern to copy.
revoke execute on function public.has_pro(uuid) from public, anon, authenticated;
revoke execute on function public.quota_status(uuid, integer, integer, integer)
  from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Trigger functions are not API.
-- ----------------------------------------------------------------------------
-- These four exist only to be fired by triggers, but they are still granted to
-- anon and authenticated and still listed on the REST surface. Postgres checks
-- EXECUTE on a trigger function when the trigger is *created*, not each time it
-- fires, so revoking here does not affect the triggers that use them.
revoke execute on function public.sync_group_member_count() from public, anon, authenticated;
revoke execute on function public.attach_submission_to_assignments() from public, anon, authenticated;
revoke execute on function public.mark_assignment_ai_graded() from public, anon, authenticated;
revoke execute on function public.on_rows_deleted_recompute_cases() from public, anon, authenticated;
