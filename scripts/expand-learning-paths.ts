import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database, Difficulty } from "../src/lib/types/database";

config({ path: ".env.local" });
config({ path: ".env" });

async function expandPaths() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key);

  console.log("Fetching learning paths and cases...");
  const [{ data: paths }, { data: cases }] = await Promise.all([
    supabase.from("learning_paths").select("id, slug, domain, title"),
    supabase
      .from("cases")
      .select("id, slug, title, domain, difficulty")
      .eq("is_published", true),
  ]);

  if (!paths || !cases) {
    console.error("Could not fetch paths or cases.");
    process.exit(1);
  }

  const casesByDomain: Record<string, typeof cases> = {};
  for (const c of cases) {
    if (!casesByDomain[c.domain]) casesByDomain[c.domain] = [];
    casesByDomain[c.domain].push(c);
  }

  const difficultyWeight: Record<Difficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
  };

  for (const path of paths) {
    console.log(`Populating ${path.title} (${path.slug})...`);
    // Delete existing steps
    await supabase.from("learning_path_steps").delete().eq("path_id", path.id);

    // Get matching cases for this path's domain
    let domainCases = casesByDomain[path.domain] || [];
    if (domainCases.length < 20) {
      // supplement with general cases
      domainCases = [...domainCases, ...(casesByDomain["strategy"] || [])];
    }

    // Sort by difficulty: easy -> medium -> hard, then deterministically by slug
    const sorted = [...domainCases].sort((a, b) => {
      const diffA = difficultyWeight[a.difficulty as Difficulty] ?? 2;
      const diffB = difficultyWeight[b.difficulty as Difficulty] ?? 2;
      if (diffA !== diffB) return diffA - diffB;
      return a.slug.localeCompare(b.slug);
    });

    // Pick 20 questions
    const selected = sorted.slice(0, 20);

    const steps = selected.map((c, index) => ({
      path_id: path.id,
      case_id: c.id,
      step_order: index + 1,
      title: c.title,
      unlock_threshold: 60,
    }));

    const { error } = await supabase.from("learning_path_steps").insert(steps);
    if (error) {
      console.error(`  Error inserting steps for ${path.slug}:`, error.message);
    } else {
      console.log(`  Successfully added ${steps.length} questions to ${path.title}`);
    }
  }

  console.log("All learning paths expanded with additional questions!");
}

expandPaths().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
