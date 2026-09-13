import type { Database } from "../../src/lib/types/database";

export type ObjectiveTrack =
  Database["public"]["Enums"] extends { objective_track: infer T } ? T : string;

/** One auto-marked question. `track` is attached by the seeder, not repeated per row. */
export interface ObjectiveSeed {
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  /** Shared passage or table. Several questions may repeat the same string; the seeder does not deduplicate it, because a student reads it per question anyway. */
  context?: string;
  stem: string;
  options: string[];
  /**
   * The correct option, written out in full rather than as an index.
   *
   * Indices were the original design and produced three wrong answer keys in
   * one authoring session: the options and the index are written separately,
   * so nothing catches it when the options are reordered or the working ends
   * up pointing somewhere else. A wrong key is the worst failure this product
   * has — the student is told they are wrong when they are right, with no
   * appeal on a multiple-choice mark. Written as text, the key cannot drift
   * from the options, and the seeder refuses anything that does not match one
   * exactly.
   */
  answer: string;
  explanation: string;
  source?: string;
}
