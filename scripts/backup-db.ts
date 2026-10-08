import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";

config({ path: ".env.local" });
config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const TABLES_TO_BACKUP = [
  "users",
  "role_grants",
  "solve_allowlist",
  "classrooms",
  "classroom_members",
  "classroom_assignments",
  "assignment_submissions",
  "submissions",
  "scores",
  "submission_integrity",
  "proctor_photos",
  "competitions",
  "competition_teams",
  "competition_members",
  "competition_entries",
  "gd_sessions",
  "gd_participants",
  "gd_messages",
  "gd_scores",
  "negotiation_sessions",
  "negotiation_messages",
  "sales_sessions",
  "sales_messages",
  "pi_sessions",
  "pi_messages",
  "pi_scores",
  "pi_profiles",
  "objective_sessions",
  "objective_answers",
  "peer_sessions",
  "peer_feedback",
  "daily_answers",
  "companies",
  "cases",
  "rubrics",
] as const;

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(process.cwd(), "backups");
  mkdirSync(backupDir, { recursive: true });

  const backupData: Record<string, unknown[]> = {};
  console.log(`Starting database backup at ${timestamp}...`);

  for (const table of TABLES_TO_BACKUP) {
    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(table as any)
        .select("*")
        .limit(10000);

      if (error) {
        console.warn(`  - [${table}] query warning: ${error.message}`);
        backupData[table] = [];
      } else {
        backupData[table] = data ?? [];
        console.log(`  ✓ [${table}]: ${data?.length ?? 0} rows`);
      }
    } catch (err) {
      console.warn(`  - [${table}] skipped: ${(err as Error).message}`);
    }
  }

  const outFile = join(backupDir, `casecode_backup_${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`\nBackup saved successfully to ${outFile}`);
}

runBackup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
