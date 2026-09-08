-- Emits Cloud SQL-ready CREATE POLICY statements from a live Supabase catalogue.
--
-- Run against SUPABASE (read-only) and redirect into gcp/sql/03_rls_policies.sql:
--   psql "$SUPABASE_DIRECT_URL" -At -f scripts/gcp/generate-rls-port.sql \
--     > gcp/sql/03_rls_policies.sql
--
-- Generated rather than hand-written because there are 75 policies and a single
-- mistyped predicate fails open — a policy that reads `true` where it should
-- read `user_id = app.current_user_id()` exposes every row in the table and
-- still passes a smoke test. Re-run it after any policy change on Supabase and
-- diff the result.
select
  'drop policy if exists ' || quote_ident(p.polname) || ' on public.' || quote_ident(c.relname) || ';' ||
  E'\ncreate policy ' || quote_ident(p.polname) || ' on public.' || quote_ident(c.relname) ||
  ' as ' || case p.polpermissive when true then 'permissive' else 'restrictive' end ||
  ' for ' || case p.polcmd
      when 'r' then 'select' when 'a' then 'insert'
      when 'w' then 'update' when 'd' then 'delete' else 'all' end ||
  ' to casecode_app' ||
  coalesce(E'\n  using (' || replace(pg_get_expr(p.polqual, p.polrelid),
            'auth.uid()', 'app.current_user_id()') || ')', '') ||
  coalesce(E'\n  with check (' || replace(pg_get_expr(p.polwithcheck, p.polrelid),
            'auth.uid()', 'app.current_user_id()') || ')', '') || E';\n'
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, p.polname;
