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
  correct_index: number;
  explanation: string;
  source?: string;
}
