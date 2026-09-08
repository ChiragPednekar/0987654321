/**
 * Compares Supabase against Cloud SQL and exits non-zero on any difference.
 *
 *   SUPABASE_DIRECT_URL=... CLOUDSQL_URL=... npx tsx scripts/gcp/validate-migration.ts
 *
 * Exists because "the deploy succeeded" is not evidence that the data arrived.
 * A restore can report success having silently skipped rows a constraint
 * rejected, and a table that came back empty looks identical to a table that
 * was always empty until someone signs in and finds their work gone.
 *
 * Read-only against both databases.
 */
import { Client } from "pg";

const SUPABASE = process.env.SUPABASE_DIRECT_URL;
const CLOUDSQL = process.env.CLOUDSQL_URL;

if (!SUPABASE || !CLOUDSQL) {
  console.error("Set SUPABASE_DIRECT_URL and CLOUDSQL_URL.");
  process.exit(2);
}

type Row = Record<string, unknown>;

const QUERIES: { name: string; sql: string; key: (r: Row) => string }[] = [
  {
    name: "table row counts",
    // Exact counts, not pg_stat estimates: n_live_tup is approximate and drifts
    // between vacuums, which is precisely the margin a migration bug hides in.
    sql: `select relname as t,
                 (xpath('/row/c/text()',
                   query_to_xml(format('select count(*) as c from public.%I', relname),
                                false, true, '')))[1]::text::bigint as n
          from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
          where ns.nspname='public' and c.relkind='r' order by relname`,
    key: (r) => `${r.t}=${r.n}`,
  },
  {
    name: "columns and types",
    sql: `select table_name||'.'||column_name||':'||data_type||
                 case when is_nullable='YES' then '?' else '' end as sig
          from information_schema.columns
          where table_schema='public' order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "primary and unique keys",
    sql: `select conrelid::regclass::text||' '||conname as sig
          from pg_constraint where contype in ('p','u')
            and connamespace='public'::regnamespace order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "foreign keys",
    // users_id_fkey is expected to differ: it pointed at auth.users, which
    // Cloud SQL does not have. Filtered so the real diffs are visible.
    sql: `select conrelid::regclass::text||' '||conname as sig
          from pg_constraint where contype='f'
            and connamespace='public'::regnamespace
            and conname <> 'users_id_fkey' order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "indexes",
    sql: `select indexname as sig from pg_indexes
          where schemaname='public' order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "enums and values",
    sql: `select t.typname||':'||e.enumlabel as sig
          from pg_type t join pg_enum e on e.enumtypid=t.oid
          join pg_namespace n on n.oid=t.typnamespace
          where n.nspname='public' order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "functions",
    sql: `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as sig
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "triggers",
    sql: `select c.relname||'.'||t.tgname as sig
          from pg_trigger t join pg_class c on c.oid=t.tgrelid
          join pg_namespace n on n.oid=c.relnamespace
          where not t.tgisinternal and n.nspname='public' order by 1`,
    key: (r) => String(r.sig),
  },
  {
    name: "rls policy names",
    sql: `select c.relname||'.'||p.polname as sig
          from pg_policy p join pg_class c on c.oid=p.polrelid
          join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' order by 1`,
    key: (r) => String(r.sig),
  },
];

async function main() {
  const a = new Client({ connectionString: SUPABASE });
  const b = new Client({ connectionString: CLOUDSQL });
  await a.connect();
  await b.connect();

  let failures = 0;

  for (const q of QUERIES) {
    const [ra, rb] = await Promise.all([a.query(q.sql), b.query(q.sql)]);
    const sa = new Set(ra.rows.map(q.key));
    const sb = new Set(rb.rows.map(q.key));
    const missing = [...sa].filter((x) => !sb.has(x));
    const extra = [...sb].filter((x) => !sa.has(x));

    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ok    ${q.name} (${sa.size})`);
    } else {
      failures++;
      console.log(`  FAIL  ${q.name}`);
      for (const m of missing.slice(0, 15)) console.log(`          missing in Cloud SQL: ${m}`);
      for (const e of extra.slice(0, 15)) console.log(`          only in Cloud SQL:   ${e}`);
      if (missing.length > 15) console.log(`          …${missing.length - 15} more missing`);
      if (extra.length > 15) console.log(`          …${extra.length - 15} more extra`);
    }
  }

  await a.end();
  await b.end();

  console.log(
    failures === 0
      ? "\nDatabases match. Safe to proceed to application cutover."
      : `\n${failures} check(s) failed — do NOT cut over.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
