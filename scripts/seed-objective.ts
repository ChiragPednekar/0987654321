/**
 * Seeds the objective practice bank (aptitude, concepts, current affairs).
 *
 *   npm run seed:objective
 *   npm run seed:objective -- --dry-run
 *
 * Idempotent on (track, stem): re-running updates a question in place rather
 * than duplicating it, so fixing a wrong answer key is a one-line edit plus a
 * re-run. That pairing is the natural key — the same stem under two tracks is
 * a different question, and stems are unique within a track in practice.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database";
import type { ObjectiveSeed } from "./content/types";
import { QUANT } from "./content/objective-quant";
import { DATA_INTERPRETATION } from "./content/objective-di";
import { LOGICAL_REASONING, VERBAL } from "./content/objective-reasoning";
import {
  ACCOUNTING,
  CURRENT_AFFAIRS,
  FINANCE_CONCEPTS,
  MARKETING_CONCEPTS,
} from "./content/objective-domain";

config({ path: ".env.local" });
config({ path: ".env" });

type Track = Database["public"]["Tables"]["objective_questions"]["Row"]["track"];

const BANKS: [Track, ObjectiveSeed[]][] = [
  ["quant", QUANT],
  ["data_interpretation", DATA_INTERPRETATION],
  ["logical_reasoning", LOGICAL_REASONING],
  ["verbal", VERBAL],
  ["finance_concepts", FINANCE_CONCEPTS],
  ["accounting", ACCOUNTING],
  ["marketing_concepts", MARKETING_CONCEPTS],
  ["current_affairs", CURRENT_AFFAIRS],
];

const dryRun = process.argv.includes("--dry-run");

/**
 * Rotates the options so the answer is not always first.
 *
 * The banks are authored with the correct option written first, because that
 * is far easier to review — you read the stem, the answer, then the
 * distractors. Seeding them verbatim put the answer at A for all 47 questions,
 * which a first run caught immediately: clicking A ten times scored 10/10.
 *
 * Rotated by a hash of the stem rather than at random, so the same question
 * lands on the same option on every re-seed. A random shuffle would move the
 * answer under existing `objective_sessions` rows, silently rewriting whether
 * past sittings were right.
 */
function rotateOptions(q: ObjectiveSeed): { options: string[]; correct_index: number } {
  let hash = 0;
  for (let i = 0; i < q.stem.length; i++) {
    hash = (hash * 31 + q.stem.charCodeAt(i)) | 0;
  }
  const n = q.options.length;
  const shift = ((hash % n) + n) % n;

  // Rotation preserves the relative order of the distractors, which matters
  // where options are numeric and were authored in a deliberate sequence.
  const options = q.options.map((_, i) => q.options[(i - shift + n * n) % n]);
  return { options, correct_index: (q.correct_index + shift) % n };
}

/**
 * Catches the failure that matters most in a bank like this: a key pointing at
 * an option that does not exist, or a question with duplicate options where
 * two answers are defensible. A wrong key is worse than a missing question,
 * because the student is told they are wrong when they are right.
 */
function validate(track: Track, q: ObjectiveSeed): string[] {
  const problems: string[] = [];
  const where = `${track}: "${q.stem.slice(0, 50)}…"`;

  if (q.options.length < 2 || q.options.length > 6) {
    problems.push(`${where} has ${q.options.length} options (need 2-6)`);
  }
  if (q.correct_index < 0 || q.correct_index >= q.options.length) {
    problems.push(`${where} correct_index ${q.correct_index} is out of range`);
  }
  const seen = new Set(q.options.map((o) => o.trim().toLowerCase()));
  if (seen.size !== q.options.length) {
    problems.push(`${where} has duplicate options`);
  }
  if (!q.explanation.trim()) {
    problems.push(`${where} has no explanation`);
  }
  return problems;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const problems = BANKS.flatMap(([track, bank]) =>
    bank.flatMap((q) => validate(track, q)),
  );
  if (problems.length > 0) {
    console.error(`${problems.length} problem(s) in the bank:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const total = BANKS.reduce((n, [, bank]) => n + bank.length, 0);
  const spread = BANKS.flatMap(([, bank]) => bank.map((q) => rotateOptions(q).correct_index))
    .reduce<Record<number, number>>((acc, i) => {
      acc[i] = (acc[i] ?? 0) + 1;
      return acc;
    }, {});

  console.log(`${total} questions across ${BANKS.length} tracks, all valid.`);
  console.log(
    "  answer position spread: " +
      Object.entries(spread)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([i, n]) => `${String.fromCharCode(65 + Number(i))}:${n}`)
        .join(" "),
  );
  for (const [track, bank] of BANKS) {
    const byDifficulty = bank.reduce<Record<string, number>>((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `  ${track.padEnd(20)} ${String(bank.length).padStart(3)}  ` +
        Object.entries(byDifficulty).map(([d, n]) => `${d}:${n}`).join(" "),
    );
  }

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  let inserted = 0;
  let updated = 0;

  for (const [track, bank] of BANKS) {
    for (const q of bank) {
      const rotated = rotateOptions(q);
      const row = {
        track,
        topic: q.topic,
        difficulty: q.difficulty,
        context: q.context ?? null,
        stem: q.stem,
        options: rotated.options,
        correct_index: rotated.correct_index,
        explanation: q.explanation,
        source: q.source ?? null,
        is_published: true,
      };

      const { data: existing } = await admin
        .from("objective_questions")
        .select("id")
        .eq("track", track)
        .eq("stem", q.stem)
        .maybeSingle();

      if (existing) {
        const { error } = await admin
          .from("objective_questions")
          .update(row)
          .eq("id", existing.id);
        if (error) throw new Error(`update failed: ${error.message}`);
        updated++;
      } else {
        const { error } = await admin.from("objective_questions").insert(row);
        if (error) throw new Error(`insert failed: ${error.message}`);
        inserted++;
      }
    }
  }

  console.log(`\nInserted ${inserted}, updated ${updated}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
