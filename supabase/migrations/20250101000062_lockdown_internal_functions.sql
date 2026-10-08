-- ============================================================================
-- CaseCode — lock down remaining internal trigger functions
-- ============================================================================
-- protect_last_admin_grant() and sync_role_from_grants() were introduced in
-- migration 20250101000031_role_grants.sql to safeguard the platform's last
-- administrator and synchronize roles between auth/public users and grants.
--
-- Both exist solely to be fired by triggers on public.role_grants:
--   - role_grants_protect_last_admin
--   - role_grants_sync_users
--
-- Postgres defaults to granting EXECUTE to the PUBLIC pseudo-role on new
-- functions, which causes PostgREST to expose them as callable RPC endpoints:
--   /rest/v1/rpc/protect_last_admin_grant
--   /rest/v1/rpc/sync_role_from_grants
--
-- While benign in practice (trigger functions error when called outside a
-- trigger context without TG_* variables), internal functions should not be
-- accessible over public REST RPCs.
--
-- Revoking `from public, anon, authenticated` closes the RPC endpoint while
-- leaving the triggers intact (Postgres verifies execute permissions at
-- trigger definition time).
-- ============================================================================

revoke execute on function public.protect_last_admin_grant() from public, anon, authenticated;
revoke execute on function public.sync_role_from_grants() from public, anon, authenticated;
