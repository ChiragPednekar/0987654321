-- Run against CLOUD SQL after applying 03_rls_policies.sql.
-- Fails loudly if anything still references the Supabase auth schema, or if the
-- policy count does not match what Supabase had (75 at time of migration).
select 'policies_referencing_auth_schema' as check, count(*) as value, 0 as expected
from pg_policy p
where coalesce(pg_get_expr(p.polqual,p.polrelid),'') || coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')
      like '%auth.%'
union all
select 'functions_referencing_auth_schema', count(*), 0
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) like '%auth.uid()%'
union all
select 'total_policies', count(*), 75 from pg_policy
union all
select 'tables_with_rls_forced', count(*), (select count(*) from pg_class c
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relrowsecurity and c.relforcerowsecurity;
