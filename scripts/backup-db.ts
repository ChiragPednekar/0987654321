/**
 * Encrypted snapshot of every table the API exposes.
 *
 * ---------------------------------------------------------------------------
 * Why it encrypts, and why nothing plaintext is ever written
 * ---------------------------------------------------------------------------
 * The repository is public, and a public repository's workflow artifacts can
 * be downloaded by any signed-in GitHub user. An unencrypted backup artifact
 * is every student's email, answers and integrity record, published. So the
 * data is gzipped and sealed with AES-256-GCM in memory, and only the sealed
 * file reaches the disk — there is no plaintext copy for a later step to
 * upload by mistake. GCM also authenticates: a damaged or tampered file fails
 * to decrypt instead of restoring garbage.
 *
 * The key comes from BACKUP_PASSPHRASE. Whoever holds the passphrase can read
 * the backup and nobody else can, so it must be stored somewhere outside
 * GitHub (GitHub secrets cannot be read back). Lose it and every backup is
 * unreadable. scripts/decrypt-backup.ts reverses this.
 *
 * ---------------------------------------------------------------------------
 * Why it discovers tables instead of listing them
 * ---------------------------------------------------------------------------
 * The hand-written list it replaced had 35 names for 87 relations, five of
 * them wrong, and missed the invite list, institutions, bookmarks and
 * notifications. A list maintained by hand is wrong by the next migration. The
 * API's own OpenAPI document names every exposed relation and marks primary
 * keys, which is everything needed to page through them.
 *
 * ---------------------------------------------------------------------------
 * Why it pages, and why it fails loudly
 * ---------------------------------------------------------------------------
 * Supabase caps a response at 1,000 rows regardless of the limit requested, so
 * one select per table silently truncates every table past that size. Rows are
 * read in pages ordered by primary key until a short page comes back.
 *
 * A table that cannot be read fails the whole run. A backup that reports
 * success while missing a table is discovered at restore time — the worst
 * possible moment — so it must not exist.
 *
 * ---------------------------------------------------------------------------
 * Login accounts
 * ---------------------------------------------------------------------------
 * auth.users is not reachable through the table API, so accounts are read
 * from the Auth admin API instead and stored alongside the tables. Every
 * account is Google sign-in only, so there are no passwords to lose. The
 * point is the ID: every row a student ever wrote is keyed to it, and the
 * admin API will recreate an account with its original ID — tested — so
 * scripts/restore-accounts.ts brings each one back with its history attached.
 * Google links to the restored account by email on the next sign-in.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { seal } from "./lib/backup-format";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const passphrase = process.env.BACKUP_PASSPHRASE;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!passphrase || passphrase.length < 16) {
  // Refuses rather than falling back to plaintext: the fallback is the leak.
  console.error("BACKUP_PASSPHRASE must be set (16+ characters). Refusing to write an unencrypted backup.");
  process.exit(1);
}

const PAGE = 1000;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

interface Relation {
  name: string;
  orderBy: string | null;
}

async function discover(): Promise<Relation[]> {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { ...headers, Accept: "application/openapi+json" },
  });
  if (!res.ok) throw new Error(`could not read the API schema: HTTP ${res.status}`);
  const spec = (await res.json()) as {
    definitions?: Record<string, { properties?: Record<string, { description?: string }> }>;
  };

  return Object.entries(spec.definitions ?? {})
    .map(([name, def]) => {
      const props = def.properties ?? {};
      // PostgREST marks primary-key columns with <pk/> in the description.
      const pk = Object.entries(props).find(([, p]) => p.description?.includes("<pk/>"))?.[0];
      const orderBy = pk ?? (props.id ? "id" : props.created_at ? "created_at" : null);
      return { name, orderBy };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function dump(rel: Relation): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const params = new URLSearchParams({ select: "*" });
    if (rel.orderBy) params.set("order", `${rel.orderBy}.asc`);
    const res = await fetch(`${url}/rest/v1/${rel.name}?${params}`, {
      headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" },
    });
    if (!res.ok) throw new Error(`${rel.name}: HTTP ${res.status} ${await res.text()}`);
    const page = (await res.json()) as unknown[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** Every login account, paged until a short page. */
async function dumpAccounts(): Promise<unknown[]> {
  const accounts: unknown[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${PAGE}`, { headers });
    if (!res.ok) throw new Error(`accounts: HTTP ${res.status} ${await res.text()}`);
    const batch = ((await res.json()) as { users?: unknown[] }).users ?? [];
    accounts.push(...batch);
    if (batch.length < PAGE) return accounts;
  }
}

async function main() {
  const started = new Date().toISOString();
  const relations = await discover();
  console.log(`Backing up ${relations.length} relations…`);

  const tables: Record<string, unknown[]> = {};
  let total = 0;
  for (const rel of relations) {
    const rows = await dump(rel);
    tables[rel.name] = rows;
    total += rows.length;
    console.log(`  ✓ ${rel.name.padEnd(28)} ${String(rows.length).padStart(7)} rows`);
  }

  const accounts = await dumpAccounts();
  console.log(`  ✓ ${"login accounts (auth)".padEnd(28)} ${String(accounts.length).padStart(7)}`);

  const sealed = seal({ format: "casecode-backup/3", started, url, accounts, tables }, passphrase!);

  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `casecode_${started.replace(/[:.]/g, "-")}.ccbk`);
  writeFileSync(file, sealed);
  console.log(`\n${total} rows from ${relations.length} relations + ${accounts.length} accounts → ${file} (${sealed.length} bytes, encrypted)`);
}

main().catch((error) => {
  console.error("Backup FAILED — nothing usable was written:", error instanceof Error ? error.message : error);
  process.exit(1);
});
