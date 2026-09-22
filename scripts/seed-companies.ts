/**
 * Seeds company profiles.
 *
 *   npm run seed:companies
 *   npm run seed:companies -- --dry-run
 *
 * Refuses to write anything if a profile has a practice link outside this
 * platform's own sections, a duplicate slug, no rounds, look-fors or links, or a
 * source that is not a public https URL with a real, past check date.
 * Idempotent on slug.
 *
 * Seeds profiles only. Reported interview questions are never seeded: they
 * exist only when a student reports one and an admin approves it.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import { COMPANY_SECTORS, isPracticeHref, sourceProblems, validateOfficialLinks } from "../src/lib/companies";
import { COMPANIES } from "./content/companies";

config({ path: ".env.local" });
config({ path: ".env" });

/** Pay, cut-offs and percentages. Word-bounded, or "rs" matches inside "years". */
const STALE_FIGURES = /(₹|\brs\.?\s?\d|\blpa\b|\blakhs?\b|\bcrores?\b|\bcgpa\b|\bcut-?offs?\b|\d+(\.\d+)?\s?%)/i;

/**
 * When the profile text was written. Stored in `reviewed_on`, but it is not a
 * verification date: a profile counts as checked only through its `sources`.
 */
const WRITTEN_ON = "2026-09-13";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const problems: string[] = [];
  const slugs = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);

  for (const c of COMPANIES) {
    const say = (m: string) => problems.push(`${c.slug}: ${m}`);
    if (!/^[a-z0-9-]+$/.test(c.slug)) say("slug must be lowercase letters, digits and hyphens");
    if (slugs.has(c.slug)) say("duplicate slug");
    slugs.add(c.slug);
    if (!COMPANY_SECTORS.includes(c.sector)) say(`unknown sector ${c.sector}`);
    if (c.rounds.length === 0) say("no rounds");
    if (c.lookFor.length === 0) say("nothing to look for");
    if (c.practice.length === 0) say("no practice links");
    for (const p of c.practice) {
      if (!isPracticeHref(p.href)) say(`practice link ${p.href} is not a section of this platform`);
    }
    for (const problem of sourceProblems(c.sources ?? [], today)) say(problem);

    /**
     * The host check that keeps this column first-party. Without it,
     * official_links is just a place for prep-vendor links to accumulate,
     * and the entire value of the feature is that the material is the
     * firm's own.
     */
    for (const problem of validateOfficialLinks(c.officialLinks ?? [], c.officialDomain ?? null)) {
      say(problem);
    }
    // Numbers that go stale: a profile must not state them.
    const text = JSON.stringify([c.summary, c.rounds, c.lookFor]);
    if (STALE_FIGURES.test(text)) {
      say("mentions pay, cut-offs or percentages, which change every year");
    }
  }

  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const checked = COMPANIES.filter((c) => (c.sources ?? []).length > 0).length;
  const linked = COMPANIES.filter((c) => (c.officialLinks ?? []).length > 0).length;
  const linkCount = COMPANIES.reduce((n, c) => n + (c.officialLinks ?? []).length, 0);
  console.log(`Validated ${COMPANIES.length} company profiles (${checked} checked against sources, ${COMPANIES.length - checked} unverified).`);
  console.log(`${linked} carry official first-party links (${linkCount} links), every host checked against the firm's own domain.`);
  if (dryRun) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  const admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.from("companies").upsert(
    COMPANIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      sector: c.sector,
      roles: c.roles,
      summary: c.summary,
      rounds: c.rounds,
      look_for: c.lookFor,
      practice: c.practice,
      reviewed_on: WRITTEN_ON,
      sources: c.sources ?? [],
      official_links: c.officialLinks ?? [],
      official_domain: c.officialDomain ?? null,
      is_published: true,
    })),
    { onConflict: "slug" },
  );
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`Seeded ${COMPANIES.length} companies.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
