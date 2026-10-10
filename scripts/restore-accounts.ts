/**
 * Recreates login accounts from a sealed backup, each with its ORIGINAL ID.
 *
 *   BACKUP_PASSPHRASE=… npx tsx scripts/restore-accounts.ts backups/casecode_….ccbk
 *   … --only someone@example.com     restore one account
 *   … --dry-run                      say what would happen, change nothing
 *
 * Targets whichever project NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY point at — after a disaster, the NEW project.
 *
 * WHY THE ID IS THE WHOLE POINT
 *
 * Every submission, score, attempt and integrity record is keyed to the
 * account's ID. Recreate the account with a new ID and the person signs in to
 * an empty profile while their history sits orphaned. The Auth admin API
 * accepts an ID on create, so each account comes back as itself. They sign in
 * with Google as usual and Supabase links the login to the account by email.
 *
 * ORDER MATTERS
 *
 * The invite list, role grants and licences are restored first. An unlisted
 * address cannot become an account at all (20250101000060), and the roles
 * attach through triggers at creation — so an account restored before its
 * grant would come back unlisted-and-refused, or as a plain student.
 *
 * Restore accounts BEFORE the other tables: creating an account fires the
 * trigger that makes its public.users row, and the tables restored afterwards
 * then refer to accounts that exist.
 *
 * Accounts that already exist are skipped, so this is safe to run twice.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { open } from "./lib/backup-format";

config({ path: ".env.local" });
config({ path: ".env" });

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--only");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1]?.toLowerCase() : null;
const dryRun = args.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!file || !url || !key || !passphrase) {
  console.error(
    "Usage: BACKUP_PASSPHRASE=… npx tsx scripts/restore-accounts.ts <file.ccbk> [--only email] [--dry-run]\n" +
      "Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the project to restore INTO.",
  );
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

interface Account {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface Backup {
  format: string;
  started: string;
  accounts?: Account[];
  tables: Record<string, Record<string, unknown>[]>;
}

const backup = open(readFileSync(file), passphrase) as Backup;
if (!backup.accounts) {
  console.error(`This backup (${backup.format}) has no accounts in it — it predates casecode-backup/3.`);
  process.exit(1);
}

const pick = <T extends { email?: unknown }>(rows: T[] = []) =>
  only ? rows.filter((r) => String(r.email ?? "").toLowerCase() === only) : rows;

async function upsert(table: string, rows: Record<string, unknown>[], conflict: string) {
  if (rows.length === 0) return;
  if (dryRun) return console.log(`  would restore ${rows.length} row(s) into ${table}`);
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
  console.log(`  ✓ ${table}: ${rows.length} row(s)`);
}

async function main() {
  console.log(`Backup from ${backup.started}${only ? `, only ${only}` : ""}${dryRun ? " (dry run)" : ""}`);

  // 1. Who may exist, and as what — before anyone is created.
  await upsert("access_allowlist", pick(backup.tables.access_allowlist), "email");
  await upsert("role_grants", pick(backup.tables.role_grants), "email");
  await upsert("solve_allowlist", pick(backup.tables.solve_allowlist), "email");

  // 2. The accounts themselves, with their original IDs.
  let created = 0;
  let skipped = 0;
  for (const a of pick(backup.accounts)) {
    const exists = await fetch(`${url}/auth/v1/admin/users/${a.id}`, { headers });
    if (exists.ok) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  would recreate ${a.email} as ${a.id}`);
      continue;
    }
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: a.id,
        email: a.email,
        email_confirm: Boolean(a.email_confirmed_at),
        app_metadata: a.app_metadata,
        user_metadata: a.user_metadata,
      }),
    });
    const body = (await res.json()) as { id?: string; msg?: string; message?: string };
    if (!res.ok || body.id !== a.id) {
      throw new Error(`${a.email}: ${res.status} ${body.msg ?? body.message ?? `came back as ${body.id}`}`);
    }
    created++;
    console.log(`  ✓ ${a.email} restored as ${a.id}`);
  }
  console.log(`\n${created} account(s) recreated, ${skipped} already present.`);
}

main().catch((error) => {
  console.error("Restore FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
