/**
 * Opens a sealed backup made by scripts/backup-db.ts.
 *
 *   BACKUP_PASSPHRASE=… npx tsx scripts/decrypt-backup.ts backups/casecode_….ccbk
 *
 * Writes the decrypted JSON next to the input. That file is the whole
 * database in plaintext: keep it off shared drives and delete it once used.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { open } from "./lib/backup-format";

const [input] = process.argv.slice(2);
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!input || !passphrase) {
  console.error("Usage: BACKUP_PASSPHRASE=… npx tsx scripts/decrypt-backup.ts <file.ccbk>");
  process.exit(1);
}

const data = open(readFileSync(input), passphrase) as {
  started: string;
  tables: Record<string, unknown[]>;
};
const out = input.replace(/\.ccbk$/, "") + ".json";
writeFileSync(out, JSON.stringify(data, null, 2));
const rows = Object.values(data.tables).reduce((n, t) => n + t.length, 0);
console.log(`Decrypted backup from ${data.started}: ${Object.keys(data.tables).length} tables, ${rows} rows → ${out}`);
