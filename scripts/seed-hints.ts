/**
 * Seeds progressive hints for every case from its expected approach
 * (src/lib/hints.ts).
 *
 *   npm run seed:hints
 *   npm run seed:hints -- --dry-run
 *
 * Idempotent on (case_id, step): re-running rewrites the hints in place, so an
 * edited approach is picked up. Drills and spreadsheet models have no written
 * approach and get no hints. A case whose approach now yields fewer hints has
 * the extra steps removed — unless a student has already revealed them.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { buildHints } from "../src/lib/hints";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  const admin = createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const cases: { id: string; slug: string; expected_framework: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("cases")
      .select("id, slug, expected_framework")
      .eq("is_published", true)
      .order("slug")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    cases.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const rows = cases.flatMap((c) => buildHints(c.expected_framework).map((h) => ({ case_id: c.id, ...h })));
  const perCase = cases.map((c) => buildHints(c.expected_framework).length);
  const spread = perCase.reduce<Record<number, number>>((acc, n) => ({ ...acc, [n]: (acc[n] ?? 0) + 1 }), {});
  console.log(`${cases.length} cases → ${rows.length} hints. Cases by hint count:`, spread);

  if (dryRun) {
    const sample = cases.find((c) => c.slug === "comps-valuation-6") ?? cases[0];
    console.log(`\nSample — ${sample.slug}:\n`);
    for (const h of buildHints(sample.expected_framework)) console.log(`[${h.step}, −${h.penalty_pct}%] ${h.body}\n`);
    return;
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("case_hints").upsert(rows.slice(i, i + 500), { onConflict: "case_id,step" });
    if (error) throw new Error(error.message);
  }
  console.log(`Seeded ${rows.length} hints.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
